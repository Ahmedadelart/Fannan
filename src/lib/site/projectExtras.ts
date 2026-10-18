// Extra project fields every artist can fill in (added for richer project pages): the network or
// channel, a video link, detail rows (Episodes, Dates, Type...), credits, special thanks and tools.
// Pure: used by the server when saving and publishing, and by the editors when showing them.

export interface LabelValue {
  label: string;
  value: string;
}

export interface ProjectExtras {
  network?: string;
  /** YouTube or Vimeo link for the project's main video. */
  video?: string;
  details?: LabelValue[];
  credits?: LabelValue[];
  thanks?: LabelValue[];
  tools?: string[];
}

/** How one project media item is used: in the gallery (default), as a header logo, or as a festival laurel. */
export type MediaUse = "gallery" | "logo" | "laurel";

const clean = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .replace(/[<>]/g, "")
        .trim()
        .slice(0, max)
    : "";

/** "Label: value" lines (one per line) ↔ rows. A line without a colon is all value. */
export function parseRows(text: string, max = 20): LabelValue[] {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const at = line.search(/[:：]/);
      return at > 0 ? { label: clean(line.slice(0, at), 60), value: clean(line.slice(at + 1), 200) } : { label: "", value: clean(line, 200) };
    })
    .filter((r) => r.label || r.value)
    .slice(0, max);
}

export const rowsText = (rows: LabelValue[] | undefined) => (rows ?? []).map((r) => (r.label ? `${r.label}: ${r.value}` : r.value)).join("\n");

const rows = (v: unknown): LabelValue[] =>
  Array.isArray(v)
    ? v
        .slice(0, 20)
        .map((r) => ({ label: clean((r as LabelValue)?.label, 60), value: clean((r as LabelValue)?.value, 200) }))
        .filter((r) => r.label || r.value)
    : [];

/** Only safe YouTube / Vimeo (or other https) links. */
export function cleanVideo(v: unknown): string {
  const s = clean(v, 300);
  return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : "";
}

/** Clean whatever was stored or sent; empty fields are left out. */
export function cleanExtras(raw: Partial<Record<keyof ProjectExtras, unknown>> | undefined): ProjectExtras {
  const r = raw ?? {};
  const out: ProjectExtras = {};
  const network = clean(r.network, 120);
  if (network) out.network = network;
  const video = cleanVideo(r.video);
  if (video) out.video = video;
  for (const k of ["details", "credits", "thanks"] as const) {
    const list = rows(r[k]);
    if (list.length) out[k] = list;
  }
  const tools = Array.isArray(r.tools) ? r.tools.map((t) => clean(t, 60)).filter(Boolean).slice(0, 30) : [];
  if (tools.length) out.tools = tools;
  return out;
}
