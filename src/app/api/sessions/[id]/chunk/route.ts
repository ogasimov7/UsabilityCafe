import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { putChunk } from "@/lib/storage";

// Keep each part under the 4.5 MB request limit of Vercel Functions.
const MAX_CHUNK = 4 * 1024 * 1024;

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
  const rel = `sessions/${s.id}/${kind}.${mime === "video/mp4" ? "mp4" : "webm"}`;

  const data = await req.arrayBuffer();
  if (data.byteLength > MAX_CHUNK) return Response.json({ error: "Chunk too large" }, { status: 400 });
  // Idempotent resume: retried parts are ignored, and a gap means an earlier part is still on its way.
  const result = await putChunk(rel, index, data);
  if (result === "duplicate") return Response.json({ ok: true, duplicate: true });
  if (result === "out-of-order") return Response.json({ error: `Expected chunk before ${index}` }, { status: 409 });
  if (index === 0) {
    await db.session.update({
      where: { id: s.id },
      data: kind === "screen" ? { screenPath: rel, screenMime: mime } : { cameraPath: rel, cameraMime: mime },
    });
  }
  return Response.json({ ok: true });
}
