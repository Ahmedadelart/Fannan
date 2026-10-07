import { NextResponse, type NextRequest } from "next/server";
import { checkLocalSignature, writeLocal } from "@/lib/server/storage";

// Stand-in for Cloud Storage signed upload links during local development and tests only.
// Refuses everything unless FIREBASE_ENV=emulator.

const MAX = 60 * 1024 * 1024;

export async function PUT(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const path = q.get("path") ?? "";
  const exp = Number(q.get("exp"));
  const type = q.get("type") ?? "";
  if (!checkLocalSignature("put", path, exp, q.get("sig") ?? "", type)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if ((req.headers.get("content-type") ?? "") !== type) {
    return NextResponse.json({ error: "wrong-type" }, { status: 400 });
  }
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length > MAX) return NextResponse.json({ error: "too-big" }, { status: 413 });
  await writeLocal(path, body);
  return new NextResponse(null, { status: 200 });
}
