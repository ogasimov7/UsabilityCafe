import { notFound } from "next/navigation";
import { db, parse } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { decideSession } from "@/app/actions/designer";
import { SessionPlayer } from "@/components/session-player";
import { Badge, Callout, Note, PageHeader, Status, fmtTime } from "@/components/ui";
import type { Analysis, Answer, Ev, Seg, TaskDef } from "@/lib/analysis";
import { levelFor } from "@/lib/rules";

export default async function SessionPage({ params }: PageProps<"/designer/tests/[id]/sessions/[sid]">) {
  const user = await requireUser("DESIGNER");
  const { id, sid } = await params;
  const s = await db.session.findUnique({ where: { id: sid }, include: { test: { include: { project: true } }, tester: true } });
  if (!s || s.testId !== id || (s.test.project.ownerId !== user.id && user.role !== "ADMIN")) notFound();
  const index = (await db.session.count({ where: { testId: id, startedAt: { lt: s.startedAt } } })) + 1;
  const tasks = parse<TaskDef[]>(s.test.tasks, []);
  const analysis = parse<Analysis | null>(s.analysis, null);
  const answers = parse<Answer[]>(s.answers, []);

  return (
    <>
      <PageHeader
        back={{ href: `/designer/tests/${id}`, label: s.test.title }}
        title={`Tester ${index}`}
        sub={<>{levelFor(s.tester.points).name} · {s.tester.country} · {s.tester.device?.toLowerCase()} · {fmtTime(s.durationSec)} · <Status value={s.status} /></>}
      />
      {["SUBMITTED", "ANALYZING"].includes(s.status) && (
        <Callout title="Analysis is running">Transcription and findings usually take a minute. Refresh the page shortly.</Callout>
      )}
      {s.status === "READY" && (
        <Callout tone="peach" title="How to review this session">
          1. Watch the video — click a finding on the right to jump to that moment. 2. Check the task results below.
          3. Accept if the tester tried honestly (they get paid), or reject with a reason if they didn&apos;t.
        </Callout>
      )}
      <SessionPlayer
        screenSrc={s.screenPath ? `/api/files/${s.screenPath}` : null}
        cameraSrc={s.cameraPath ? `/api/files/${s.cameraPath}` : null}
        watermark={user.email}
        transcript={parse<Seg[]>(s.transcript, [])}
        findings={analysis?.findings ?? []}
        events={parse<Ev[]>(s.events, [])}
        notes={parse<Seg[]>(s.notes, [])}
        tasks={tasks.map((t) => t.title)}
        duration={s.durationSec}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="h2">Summary</h2>
          <p className="mt-2 text-sm">{analysis?.summary ?? "Not analyzed yet."}</p>
          {analysis && (
            <>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <Badge tone={analysis.sentiment === "positive" ? "ok" : analysis.sentiment === "negative" ? "bad" : "neutral"}>Overall mood: {analysis.sentiment}</Badge>
                <span title="How much the tester talked and followed the tasks"><Badge tone="neutral">Quality {analysis.qualityScore}/100</Badge></span>
                <Badge tone="neutral">{analysis.engine === "llm" ? "AI analysis" : "Rule-based analysis"}</Badge>
              </div>
              {analysis.qualityIssues.length > 0 && (
                <>
                  <p className="mt-3 text-sm font-medium text-warn">Possible problems with this session:</p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-warn">{analysis.qualityIssues.map((q) => <li key={q}>{q}</li>)}</ul>
                </>
              )}
              <table className="mt-4 w-full text-sm">
                <thead className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted"><tr><th className="py-1">Task</th><th>Result</th><th>Time</th></tr></thead>
                <tbody>
                  {analysis.tasks.map((t) => (
                    <tr key={t.task} className="border-t border-line">
                      <td className="py-2">{t.title}</td>
                      <td>{t.success === null ? <Badge>Skipped</Badge> : t.success ? <Badge tone="ok">Completed</Badge> : <Badge tone="bad">Couldn&apos;t finish</Badge>}</td>
                      <td>{t.seconds !== null ? fmtTime(t.seconds) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {answers.length > 0 && (
            <>
              <h3 className="mt-6 font-semibold">Answers to your questions</h3>
              <dl className="mt-2 space-y-3 text-sm">
                {answers.map((a, i) => (
                  <div key={i}><dt className="text-muted">{a.prompt}</dt><dd>{a.answer || "—"}</dd></div>
                ))}
              </dl>
            </>
          )}
        </section>

        <Note tone={s.status === "READY" ? "peach" : "sky"} pin={s.status === "READY"} className="self-start" panelClassName={s.status === "READY" ? "" : "!bg-surface !border-line"}>
          <h2 className="h2">Your decision</h2>
          {s.status === "READY" ? (
            <div className="mt-3 space-y-4">
              <form action={decideSession} className="space-y-3">
                <input type="hidden" name="sessionId" value={s.id} />
                <input type="hidden" name="decision" value="accept" />
                <fieldset>
                  <legend className="label">How helpful was this tester?</legend>
                  <p className="hint mb-2">Good ratings give the tester bonus points.</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n} className="cursor-pointer">
                        <input type="radio" name="rating" value={n} className="peer sr-only" defaultChecked={n === 4} />
                        <span className="btn-ghost !px-3 peer-checked:!border-accent peer-checked:!bg-peach">{n}★</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button className="btn-brand w-full">Accept & pay tester</button>
              </form>
              <form action={decideSession} className="space-y-2 border-t border-line pt-4">
                <input type="hidden" name="sessionId" value={s.id} />
                <input type="hidden" name="decision" value="reject" />
                <label className="label" htmlFor="reason">Or reject it</label>
                <p className="hint">You won&apos;t be charged. Tell the tester what went wrong.</p>
                <textarea id="reason" name="reason" className="input" required placeholder="e.g. Tester was silent and skipped tasks" />
                <button className="btn-danger w-full">Reject session</button>
                <p className="hint">The tester can dispute a rejection; our team reviews disputes.</p>
              </form>
            </div>
          ) : (
            <div className="mt-3 space-y-1 text-sm">
              <Status value={s.status} />
              {s.rating && <div>Your rating: {s.rating}★</div>}
              {s.rejectReason && <div className="text-muted">Reason: {s.rejectReason}</div>}
              {s.disputeReason && <div className="text-warn">Tester dispute: {s.disputeReason}</div>}
              {s.status === "READY" || <p className="hint">Unreviewed sessions are auto-accepted 72 hours after submission.</p>}
            </div>
          )}
        </Note>
      </div>
    </>
  );
}
