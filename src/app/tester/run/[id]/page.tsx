import { notFound, redirect } from "next/navigation";
import { db, parse } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Recorder } from "@/components/recorder";
import type { TaskDef } from "@/lib/analysis";

export default async function RunPage({ params }: PageProps<"/tester/run/[id]">) {
  const user = await requireUser("TESTER");
  const { id } = await params;
  const s = await db.session.findUnique({ where: { id }, include: { test: true } });
  if (!s || s.testerId !== user.id) notFound();
  if (s.status !== "IN_PROGRESS") redirect("/tester/sessions");
  const t = s.test;
  const attention = parse<{ prompt?: string }>(t.attention, {});
  return (
    <Recorder
      sessionId={s.id}
      title={t.title}
      description={t.description}
      conceptType={t.conceptType as "LINK" | "IMAGES" | "PDF" | "VIDEO"}
      conceptUrl={t.conceptUrl}
      assets={parse<string[]>(t.assets, []).map((a) => `/api/files/${a}`)}
      tasks={parse<TaskDef[]>(t.tasks, [])}
      questions={parse<{ prompt: string; kind: "TEXT" | "RATING" }[]>(t.questions, [])}
      attentionPrompt={attention.prompt ?? null}
      minSeconds={t.minSeconds}
    />
  );
}
