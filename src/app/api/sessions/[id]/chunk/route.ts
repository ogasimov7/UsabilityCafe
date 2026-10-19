import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { appendChunk, STORAGE_ROOT } from "@/lib/storage";

const MAX_CHUNK = 20 * 1024 * 1024;

export async function POST(req: Request, ctx: RouteContext<"/api/sessions/[id]/chunk">) {
  const { id } = await ctx.params;
  const user = await getUser();
  const s = await db.session.findUnique({ where: { id } });
  if (!user || !s || s.testerId !== user.id) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (s.status !== "IN_PROGRESS") return Response.json({ error: "Session closed" }, { status: 400 });

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") === "camera" ? "camera" : "screen";
  const index = Number(url.searchParams.get("index"));
  if (!Number.isInteger(index) || index < 0) return Response.json({ error: "Bad index" }, { status: 400 });
  const mime = req.headers.get("content-type")?.startsWith("video/mp4") ? "video/mp4" : "video/webm";
  const rel = path.join("sessions", s.id, `${kind}.${mime === "video/mp4" ? "mp4" : "webm"}`);

  // Idempotent resume: remember the last chunk written so retried chunks are not appended twice.
  const marker = path.join(STORAGE_ROOT, "sessions", s.id, `${kind}.idx`);
  const last = Number(await readFile(marker, "utf8").catch(() => "-1"));
  if (index <= last) return Response.json({ ok: true, duplicate: true });
  if (index !== last + 1) return Response.json({ error: `Expected chunk ${last + 1}` }, { status: 409 });

  const data = await req.arrayBuffer();
  if (data.byteLength > MAX_CHUNK) return Response.json({ error: "Chunk too large" }, { status: 400 });
  await appendChunk(rel, data, index === 0);
  await writeFile(marker, String(index));
  if (index === 0) {
    await db.session.update({
      where: { id: s.id },
      data: kind === "screen" ? { screenPath: rel, screenMime: mime } : { cameraPath: rel, cameraMime: mime },
    });
  }
  return Response.json({ ok: true });
}
