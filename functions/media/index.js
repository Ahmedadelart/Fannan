// Fannan media processor (Cloud Functions 2nd gen, HTTP).
// The app server calls it after an upload; it never talks to Firestore, only to storage.
//
// Request:  { bucket, source, dest, kind: "image"|"svg"|"gif"|"loop"|"pdf", crop?: {x,y,w,h} (0..1) }
// Response: { width, height, variants: { webp: {400: path, ...}, avif: {...} }, loop?, duration?, pages? }
//
// Never serves originals: everything the site shows comes from these variants.
// Output images carry no EXIF (so no GPS location), and are rotated upright first.

import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import functions from "@google-cloud/functions-framework";
import sharp from "sharp";

const run = promisify(execFile);
const WIDTHS = [400, 800, 1600, 2560];
const MAX_LOOP_SECONDS = 30.5;
sharp.concurrency(2);

/* ---------- storage: Google Cloud Storage, or a local folder for development ---------- */

const LOCAL_ROOT = process.env.LOCAL_STORAGE_ROOT;
let gcs;
async function bucketFile(bucket, path) {
  if (!gcs) {
    const { Storage } = await import("@google-cloud/storage");
    gcs = new Storage();
  }
  return gcs.bucket(bucket).file(path);
}
async function readObject(bucket, path) {
  if (LOCAL_ROOT) return readFile(join(LOCAL_ROOT, bucket, path));
  const [buf] = await (await bucketFile(bucket, path)).download();
  return buf;
}
async function writeObject(bucket, path, data, contentType) {
  if (LOCAL_ROOT) {
    const full = join(LOCAL_ROOT, bucket, path);
    await mkdir(dirname(full), { recursive: true });
    return writeFile(full, data);
  }
  await (await bucketFile(bucket, path)).save(data, {
    contentType,
    resumable: false,
    metadata: { cacheControl: "private, max-age=31536000, immutable" },
  });
}

/* ---------- images ---------- */

function cropBox(meta, crop) {
  if (!crop) return null;
  const clamp = (v) => Math.min(1, Math.max(0, Number(v) || 0));
  const left = Math.round(clamp(crop.x) * meta.width);
  const top = Math.round(clamp(crop.y) * meta.height);
  const width = Math.max(1, Math.min(meta.width - left, Math.round(clamp(crop.w) * meta.width)));
  const height = Math.max(1, Math.min(meta.height - top, Math.round(clamp(crop.h) * meta.height)));
  return { left, top, width, height };
}

/** Upright, cropped, metadata-free base image (still full size). */
async function prepare(input, { crop, animated = false, density } = {}) {
  const opts = { failOn: "none", limitInputPixels: 120_000_000, animated, ...(density ? { density } : {}) };
  // Rotate once into a buffer so width/height reflect the upright image.
  const upright = animated ? input : await sharp(input, opts).rotate().toBuffer();
  const meta = await sharp(upright, opts).metadata();
  const height = animated ? meta.pageHeight || meta.height : meta.height;
  const box = cropBox({ width: meta.width, height }, crop);
  let img = sharp(upright, opts);
  if (box && !animated) img = img.extract(box);
  const out = await img.toBuffer({ resolveWithObject: true });
  return { buffer: out.data, width: box && !animated ? box.width : meta.width, height: box && !animated ? box.height : height };
}

async function writeVariants({ bucket, dest, base, width, height, animated = false, avif = true }) {
  const sizes = WIDTHS.filter((w) => w < width);
  if (!sizes.length || sizes.at(-1) < Math.min(width, 2560)) sizes.push(Math.min(width, 2560));
  const variants = { webp: {}, avif: {} };
  for (const w of sizes) {
    const resized = sharp(base, { animated, failOn: "none", limitInputPixels: 120_000_000 }).resize({ width: w, withoutEnlargement: true });
    const webp = await resized.clone().webp({ quality: 82, effort: 4 }).toBuffer();
    const webpPath = `${dest}/${w}.webp`;
    await writeObject(bucket, webpPath, webp, "image/webp");
    variants.webp[w] = webpPath;
    if (avif && !animated) {
      const av = await resized.clone().avif({ quality: 55, effort: 2 }).toBuffer();
      const avifPath = `${dest}/${w}.avif`;
      await writeObject(bucket, avifPath, av, "image/avif");
      variants.avif[w] = avifPath;
    }
  }
  return { width, height, variants };
}

/* ---------- handlers per kind ---------- */

async function processImage(req, input) {
  const p = await prepare(input, { crop: req.crop });
  return writeVariants({ ...req, base: p.buffer, width: p.width, height: p.height });
}

async function processSvg(req, input) {
  // SVGs can hide scripts: we only ever publish a rasterised copy.
  const meta = await sharp(input, { failOn: "none" }).metadata();
  const density = Math.min(600, Math.max(72, Math.round((2560 / Math.max(1, meta.width || 2560)) * 72)));
  const p = await prepare(input, { crop: req.crop, density });
  return writeVariants({ ...req, base: p.buffer, width: p.width, height: p.height });
}

async function processGif(req, input) {
  // Keeps the animation: animated WebP in every size, plus a still poster.
  const p = await prepare(input, { animated: true });
  const anim = await writeVariants({ ...req, base: input, width: p.width, height: p.height, animated: true });
  const still = await sharp(input, { failOn: "none" }).png().toBuffer();
  const poster = await writeVariants({ ...req, dest: `${req.dest}/poster`, base: still, width: p.width, height: p.height });
  return { ...anim, poster: poster.variants };
}

async function binaries() {
  const ffmpeg = (await import("ffmpeg-static")).default;
  const ffprobe = (await import("ffprobe-static")).default.path;
  return { ffmpeg, ffprobe };
}

async function processLoop(req, input) {
  const dir = await mkdtemp(join(tmpdir(), "loop-"));
  try {
    const { ffmpeg, ffprobe } = await binaries();
    const src = join(dir, "in.mp4");
    await writeFile(src, input);
    const probe = JSON.parse(
      (await run(ffprobe, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", src])).stdout,
    );
    const video = probe.streams.find((s) => s.codec_type === "video");
    const duration = Number(probe.format?.duration ?? 0);
    if (!video) return { error: "not-a-video" };
    if (duration > MAX_LOOP_SECONDS) return { error: "too-long", duration };
    // Loops play muted: drop the sound and move the index to the front so they start instantly.
    const out = join(dir, "loop.mp4");
    await run(ffmpeg, ["-y", "-i", src, "-an", "-c:v", "copy", "-movflags", "+faststart", out]);
    const loopPath = `${req.dest}/loop.mp4`;
    await writeObject(req.bucket, loopPath, await readFile(out), "video/mp4");
    const posterFile = join(dir, "poster.png");
    await run(ffmpeg, ["-y", "-ss", String(Math.min(0.5, duration / 2)), "-i", src, "-frames:v", "1", posterFile]);
    const still = await readFile(posterFile);
    const meta = await sharp(still).metadata();
    const poster = await writeVariants({ ...req, dest: `${req.dest}/poster`, base: still, width: meta.width, height: meta.height });
    return { width: meta.width, height: meta.height, variants: poster.variants, loop: loopPath, duration };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function processPdf(req, input) {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(input, "application/pdf");
  const pages = doc.countPages();
  const page = doc.loadPage(0);
  const [x0, y0, x1, y1] = page.getBounds();
  const scale = 1600 / Math.max(1, x1 - x0);
  const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
  const png = Buffer.from(pixmap.asPNG());
  const thumb = await writeVariants({
    ...req,
    dest: `${req.dest}/cover`,
    base: png,
    width: Math.round((x1 - x0) * scale),
    height: Math.round((y1 - y0) * scale),
  });
  return { ...thumb, pages };
}

const handlers = { image: processImage, svg: processSvg, gif: processGif, loop: processLoop, pdf: processPdf };

functions.http("processMedia", async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("POST only");
  const { bucket, source, dest, kind } = req.body ?? {};
  const handler = handlers[kind];
  if (!bucket || !source || !dest || !handler) return res.status(400).json({ error: "bad-request" });
  try {
    const input = await readObject(bucket, source);
    const result = await handler(req.body, input);
    res.status(result.error ? 422 : 200).json(result);
  } catch (e) {
    console.error("processMedia failed", kind, source, e);
    res.status(422).json({ error: "unreadable" });
  }
});
