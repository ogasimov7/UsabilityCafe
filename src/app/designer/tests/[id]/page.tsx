import Link from "next/link";
import { notFound } from "next/navigation";
import { db, parse } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { checkoutTest, rateReport, setTestStatus } from "@/app/actions/designer";
import { Badge, Callout, Empty, Note, PageHeader, Severity, Stat, Status, fmtTime } from "@/components/ui";
import { autoAcceptDue, quoteTest } from "@/lib/market";
import { levelFor, money } from "@/lib/rules";
import type { Report, TaskDef } from "@/lib/analysis";

export default async function TestPage({ params }: PageProps<"/designer/tests/[id]">) {
  const user = await requireUser("DESIGNER");
  const { id } = await params;
  await autoAcceptDue();
  const test = await db.test.findUnique({
    where: { id },
    include: { project: true, sessions: { orderBy: { startedAt: "asc" }, include: { tester: true } } },
  });
  if (!test || (test.project.ownerId !== user.id && user.role !== "ADMIN")) notFound();
  const tasks = parse<TaskDef[]>(test.tasks, []);
  const report = parse<Report | null>(test.report, null);
  const quote = quoteTest(user, test);
  const delivered = test.sessions.filter((s) => !["IN_PROGRESS", "ABANDONED"].includes(s.status));
  const countries = parse<string[]>(test.countries, []);
  const devices = parse<string[]>(test.devices, []);

  return (
    <>
      <PageHeader
        back={{ href: "/designer", label: "My tests" }}
        title={test.title}
        sub={<>{test.project.name} · <Status value={test.status} /></>}
        actions={
          <>
            {test.status === "OPEN" && (
              <form action={setTestStatus}><input type="hidden" name="testId" value={test.id} /><input type="hidden" name="status" value="PAUSED" /><button className="btn-ghost">Pause</button></form>
            )}
            {test.status === "PAUSED" && (
              <form action={setTestStatus}><input type="hidden" name="testId" value={test.id} /><input type="hidden" name="status" value="OPEN" /><button className="btn-ghost">Resume</button></form>
            )}
            {report && report.sessions > 0 && <Link className="btn-primary" href={`/designer/tests/${test.id}/report`}>Full report & PDF</Link>}
          </>
        }
      />

      {test.moderationNote && (
        <div className="mb-6 rounded-[14px] bg-warn/10 p-4 text-sm text-warn">Moderator note: {test.moderationNote}</div>
      )}

      {["DRAFT", "PENDING_PAYMENT"].includes(test.status) && (
        <Note tone="peach" className="mb-8">
        <form action={checkoutTest} className="flex flex-wrap items-center gap-4">
          <input type="hidden" name="testId" value={test.id} />
          <div className="flex-1">
            <div className="font-semibold">Last step: publish your test</div>
            <div className="text-sm text-ink/70">Testers can&apos;t see it until it&apos;s published.</div>
            <div className="text-sm text-muted">
              {test.sessionsWanted} sessions × {money(quote.unit)}
              {quote.creditsUsed > 0 && ` · ${quote.creditsUsed} free credit(s) applied`}
            </div>
          </div>
          <div className="font-display text-2xl font-semibold">{money(quote.amountCents)}</div>
          <button className="btn-brand">{quote.amountCents ? "Pay & publish" : "Publish with free credits"}</button>
        </form>
        </Note>
      )}

      {test.sessions.some((s) => s.status === "READY") && (
        <Callout tone="peach" title="You have sessions to review">
          Open each session marked <b>Needs review</b>, watch the highlights, then accept it (the tester gets paid) or reject it with a
          reason. Sessions you don&apos;t review are accepted automatically after 72 hours.
        </Callout>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Sessions delivered" value={`${delivered.length} / ${test.sessionsWanted}`} />
        <Stat label="Accepted" value={test.sessions.filter((s) => s.status === "ACCEPTED").length} />
        <Stat label="Critical issues" value={report?.severityCounts.critical ?? 0} hint="Problems that stop people finishing" />
        <Stat label="Mood" value={report ? `${report.sentiment.positive}👍 ${report.sentiment.negative}👎` : "—"} hint="Positive vs negative comments" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section>
            <h2 className="h2">Sessions</h2>
            <p className="hint mb-3 mt-1">One row per tester. Open a session to watch it and decide.</p>
            {delivered.length === 0 ? (
              <Empty>{test.status === "OPEN" ? "Testers are being matched. First sessions usually arrive within 24 hours." : "No sessions yet."}</Empty>
            ) : (
              <div className="card overflow-x-auto !p-0">
                <table className="w-full text-sm">
                  <thead className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
                    <tr><th className="p-3">Tester</th><th className="p-3">Length</th><th className="p-3" title="0–100, based on how much the tester talked and followed the tasks">Quality</th><th className="p-3">Status</th><th className="p-3" /></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {test.sessions.map((s, i) =>
                      ["IN_PROGRESS", "ABANDONED"].includes(s.status) ? null : (
                        <tr key={s.id}>
                          <td className="p-3">
                            <div className="font-medium">Tester {i + 1}</div>
                            <div className="text-xs text-muted">{levelFor(s.tester.points).name} · {s.tester.country} · {s.tester.device?.toLowerCase()}</div>
                          </td>
                          <td className="p-3">{fmtTime(s.durationSec)}</td>
                          <td className="p-3">
                            {s.qualityScore ?? "—"}
                            {s.flagged && <span className="ml-1"><span title="The analysis thinks this session may be low quality"><Badge tone="bad">check quality</Badge></span></span>}
                          </td>
                          <td className="p-3"><Status value={s.status} /></td>
                          <td className="p-3 text-right">
                            <Link className="font-medium text-brand" href={`/designer/tests/${test.id}/sessions/${s.id}`}>
                              {s.status === "READY" ? "Review →" : "Open"}
                            </Link>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {report && report.sessions > 0 && (
            <section className="card">
              <h2 className="h2">Top problems so far</h2>
              <p className="mt-1 text-sm text-muted">{report.summary}</p>
              <ul className="mt-4 space-y-2">
                {report.themes.slice(0, 5).map((t) => (
                  <li key={t.theme} className="flex items-center justify-between rounded-[14px] bg-surface-2 px-3 py-2 text-sm">
                    <span className="font-medium">{t.theme}</span>
                    <span className="flex items-center gap-2"><Severity value={t.worst} /> {t.count}</span>
                  </li>
                ))}
              </ul>
              <form action={rateReport} className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <input type="hidden" name="testId" value={test.id} />
                <span className="text-muted">Was this analysis useful?</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} name="rating" value={n} className={`btn-ghost !px-3 !py-1 ${test.reportRating === n ? "!border-accent !bg-peach" : ""}`}>{n}</button>
                ))}
              </form>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card text-sm">
            <h3 className="mb-2 font-semibold">Tasks testers do</h3>
            <ol className="list-decimal space-y-2 pl-5">
              {tasks.map((t, i) => {
                const st = report?.taskStats[i];
                return (
                  <li key={i}>
                    <div className="font-medium">{t.title}</div>
                    {st && st.successRate !== null && (
                      <div className="text-xs text-muted">{Math.round(st.successRate * 100)}% finished · avg {st.avgSeconds ? fmtTime(st.avgSeconds) : "—"}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="card space-y-1 text-sm">
            <h3 className="mb-2 font-semibold">Who can take it</h3>
            <div><span className="text-muted">Age:</span> {test.ageMin ?? 18}–{test.ageMax ?? "any"}</div>
            <div><span className="text-muted">Countries:</span> {countries.length ? countries.join(", ") : "any"}</div>
            <div><span className="text-muted">Devices:</span> {devices.length ? devices.join(", ").toLowerCase() : "any"}</div>
            {test.profession && <div><span className="text-muted">Profession:</span> {test.profession}</div>}
            {test.specialist && <Badge tone="brand">Specialist</Badge>}
          </div>
          <div className="card text-sm">
            <h3 className="mb-2 font-semibold">What testers see</h3>
            <div className="text-muted">{{ LINK: "Prototype link", IMAGES: "Images", PDF: "PDF", VIDEO: "Video" }[test.conceptType] ?? test.conceptType}</div>
            {test.conceptUrl && <a className="break-all text-brand underline" href={test.conceptUrl} target="_blank" rel="noreferrer">{test.conceptUrl}</a>}
            {parse<string[]>(test.assets, []).length > 0 && <div>{parse<string[]>(test.assets, []).length} file(s)</div>}
          </div>
        </aside>
      </div>
    </>
  );
}
