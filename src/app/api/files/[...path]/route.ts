import path from "node:path";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { MIME, readStored } from "@/lib/storage";

// Serves uploaded concepts and recordings to the people allowed to see them.
export async function GET(req: Request, ctx: RouteContext<"/api/files/[...path]">) {
  const { path: parts } = await ctx.params;
  const rel = parts.join("/");
  if (parts.some((p) => p === ".." || p === "." || p.endsWith(".parts"))) return new Response("Not found", { status: 404 });
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

  const m = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  const range = m ? { start: m[1] ? Number(m[1]) : 0, end: m[2] ? Number(m[2]) : undefined } : undefined;
  const file = await readStored(rel, range).catch(() => null);
  if (!file) return new Response("Not found", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": MIME[path.extname(rel).toLowerCase()] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
  };
  if (file.partial) {
    if (file.start >= file.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } });
    return new Response(file.stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${file.start}-${file.end}/${file.size}`, "Content-Length": String(file.end - file.start + 1) },
    });
  }
  return new Response(file.stream, { headers: { ...headers, "Content-Length": String(file.size) } });
}
