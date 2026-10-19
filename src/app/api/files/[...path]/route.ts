import path from "node:path";
import { Readable } from "node:stream";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { fileInfo, MIME, readStream } from "@/lib/storage";

// Serves uploaded concepts and recordings to the people allowed to see them.
export async function GET(req: Request, ctx: RouteContext<"/api/files/[...path]">) {
  const { path: parts } = await ctx.params;
  const rel = parts.join("/");
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const [area, id] = parts;

  let allowed = user.role === "ADMIN";
  if (!allowed && area === "tests") {
    const test = await db.test.findUnique({ where: { id }, include: { project: true } });
    if (test?.project.ownerId === user.id) allowed = true;
    else if (test && user.role === "TESTER")
      allowed = Boolean(await db.session.findFirst({ where: { testId: id, testerId: user.id, status: "IN_PROGRESS" } }));
  } else if (!allowed && area === "sessions") {
    const s = await db.session.findUnique({ where: { id }, include: { test: { include: { project: true } } } });
    allowed = Boolean(s && (s.testerId === user.id || s.test.project.ownerId === user.id));
  }
  if (!allowed) return new Response("Forbidden", { status: 403 });

  let info;
  try {
    info = await fileInfo(rel);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const type = MIME[path.extname(rel).toLowerCase()] ?? "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
  };
  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start >= info.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
    const stream = Readable.toWeb(readStream(info.full, start, end)) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${info.size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(readStream(info.full)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(info.size) } });
}
