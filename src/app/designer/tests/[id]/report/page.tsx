import Link from "next/link";
import { notFound } from "next/navigation";
import { db, parse } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { buildReport, type Report } from "@/lib/analysis";
import { Note, SEVERITY, Severity, fmtTime, type NoteTone } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export default async function ReportPage({ params }: PageProps<"/designer/tests/[id]/report">) {
  const user = await requireUser("DESIGNER");
  const { id } = await params;
  const test = await db.test.findUnique({ where: { id }, include: { project: true } });
  if (!test || (test.project.ownerId !== user.id && user.role !== "ADMIN")) notFound();
  const report = (await buildReport(id)) ?? parse<Report | null>(test.report, null);
  if (!report) notFound();
  const sev = report.severityCounts;

  return (
    <article className="mx-auto max-w-4xl space-y-6">
      <div className="no-print flex items-center justify-between">
        <Link href={`/designer/tests/${id}`} className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-sm text-muted shadow-sm hover:text-ink">← Back to test</Link>
        <PrintButton />
      </div>
      <Note tone="sky">
        <div className="text-sm text-ink/60">Usability Cafe report · {test.project.name}</div>
        <h1 className="h1 mt-1">{test.title}</h1>
        <h2 className="mt-5 text-sm font-semibold">In short</h2>
        <p className="mt-1">{report.summary}</p>
        <p className="hint mt-3">Generated {new Date(report.generatedAt).toLocaleString("en-US")} · based on {report.sessions} {report.sessions === 1 ? "session" : "sessions"}</p>
      </Note>

      <p className="text-sm text-muted">
        <b className="text-ink">How to read this report:</b> start with the critical problems — they stop people from finishing.
        Every finding links to the exact moment in the recording, so you can see it happen.
      </p>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["critical", "major", "minor", "positive"] as const).map((k) => (
          <Note key={k} tone={({ critical: "peach", major: "lilac", minor: "sky", positive: "mint" } as Record<string, NoteTone>)[k]} pin={false} panelClassName="!p-4">
            <div className="font-display text-3xl font-semibold">{sev[k]}</div>
            <div className="mt-1 font-medium">{SEVERITY[k].label}</div>
            <div className="hint">{SEVERITY[k].help}</div>
          </Note>
        ))}
      </section>

      <section className="card">
        <h2 className="h2">Did people finish the tasks?</h2>
        <p className="hint mb-4 mt-1">Share of testers who completed each task, and how long it took on average.</p>
        <div className="space-y-3">
          {report.taskStats.map((t) => (
            <div key={t.title}>
              <div className="flex justify-between text-sm">
                <span className="font-medium">{t.title}</span>
                <span className="text-muted">
                  {t.successRate === null ? "no data" : `${Math.round(t.successRate * 100)}% finished`} · avg {t.avgSeconds !== null ? fmtTime(t.avgSeconds) : "—"}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-ok" style={{ width: `${(t.successRate ?? 0) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="h2">How did people feel?</h2>
        <p className="hint mb-4 mt-1">Tone of everything testers said out loud.</p>
        <div className="flex h-4 overflow-hidden rounded-full">
          {(["positive", "neutral", "negative"] as const).map((k) => {
            const total = report.sentiment.positive + report.sentiment.neutral + report.sentiment.negative || 1;
            const color = k === "positive" ? "bg-ok" : k === "negative" ? "bg-bad" : "bg-muted/40";
            return <div key={k} className={color} style={{ width: `${(report.sentiment[k] / total) * 100}%` }} />;
          })}
        </div>
        <div className="mt-2 flex gap-4 text-sm text-muted">
          <span>{report.sentiment.positive} positive</span><span>{report.sentiment.neutral} neutral</span><span>{report.sentiment.negative} negative</span>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="h2">What people struggled with</h2>
          <p className="hint mt-1">Findings grouped by topic. Click the time to watch that moment.</p>
        </div>
        {report.themes.map((t) => (
          <div key={t.theme} className="card">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{t.theme}</h3>
              <span className="flex items-center gap-2 text-sm text-muted"><Severity value={t.worst} /> {t.count} {t.count === 1 ? "finding" : "findings"}</span>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {t.findings.map((f, i) => (
                <li key={i} className="flex gap-3 rounded-[14px] bg-surface-2 p-3">
                  <Severity value={f.severity} />
                  <div className="flex-1">
                    <div className="font-medium">{f.title}</div>
                    {f.quote ? <div className="italic text-muted">“{f.quote}”</div> : <div className="text-muted">{f.detail}</div>}
                  </div>
                  <Link href={`/designer/tests/${id}/sessions/${f.sessionId}`} className="whitespace-nowrap text-xs font-medium text-brand">
                    ▶ {f.tester} · {fmtTime(f.t)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </article>
  );
}
