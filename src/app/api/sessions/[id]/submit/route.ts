import { after } from "next/server";
import { z } from "zod";
import { db, parse } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { analyzeSession } from "@/lib/analysis";
import { finalizeRecording } from "@/lib/storage";

const body = z.object({
  duration: z.number().min(0).max(4 * 3600),
  transcript: z.array(z.object({ t: z.number(), text: z.string().max(5000) })).max(5000),
  events: z.array(z.object({ t: z.number(), type: z.enum(["TASK_START", "TASK_END"]), task: z.number().int(), success: z.boolean().optional() })).max(500),
  notes: z.array(z.object({ t: z.number(), text: z.string().max(2000) })).max(200),
  answers: z.array(z.object({ prompt: z.string(), answer: z.string().max(5000) })).max(50),
  attention: z.string().max(500),
});

export async function POST(req: Request, ctx: RouteContext<"/api/sessions/[id]/submit">) {
  const { id } = await ctx.params;
  const user = await getUser();
  const s = await db.session.findUnique({ where: { id }, include: { test: true } });
  if (!user || !s || s.testerId !== user.id) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (s.status !== "IN_PROGRESS") return Response.json({ error: "Already submitted" }, { status: 400 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid session data" }, { status: 400 });
  const d = parsed.data;
  if (!s.screenPath) return Response.json({ error: "No recording was received. Check your connection and try again." }, { status: 400 });

  const expected = parse<{ answer?: string }>(s.test.attention, {}).answer;
  const attentionOk = expected ? d.attention.trim().toLowerCase() === expected.trim().toLowerCase() : null;
  await db.session.update({
    where: { id },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      durationSec: Math.round(d.duration),
      transcript: JSON.stringify(d.transcript),
      events: JSON.stringify(d.events),
      notes: JSON.stringify(d.notes),
      answers: JSON.stringify(d.answers),
      attentionOk,
    },
  });
  after(async () => {
    // Join the uploaded parts into playable files, then analyze.
    for (const [rel, mime] of [[s.screenPath, s.screenMime], [s.cameraPath, s.cameraMime]] as const)
      if (rel) await finalizeRecording(rel, mime ?? "video/webm").catch((e) => console.error("finalize failed", rel, e));
    await analyzeSession(id).catch((e) => console.error("analysis failed", e));
  });
  return Response.json({ ok: true });
}
