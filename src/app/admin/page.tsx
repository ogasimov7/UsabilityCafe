import { db } from "@/lib/db";
import { PageHeader, Stat } from "@/components/ui";
import { autoAcceptDue } from "@/lib/market";
import { daysAgo, money } from "@/lib/rules";

const DAY = 86400_000;
// Rough per-session variable costs from the plan (video processing + AI analysis + payment fees).
const VIDEO_AI_COST_CENTS = 200;

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export default async function AdminHome() {
  await autoAcceptDue();
  const since30 = daysAgo(30);
  const [designers, testers, tests, sessions, payments, pendingPayouts, queue] = await Promise.all([
    db.user.count({ where: { role: "DESIGNER" } }),
    db.user.count({ where: { role: "TESTER" } }),
    db.test.findMany({ include: { project: true, sessions: { select: { submittedAt: true, status: true } } } }),
    db.session.findMany({ select: { status: true, testerId: true, submittedAt: true, paidCents: true } }),
    db.payment.findMany({ where: { status: "PAID" } }),
    db.payout.count({ where: { status: "REQUESTED" } }),
    db.session.count({ where: { OR: [{ status: "DISPUTED" }, { status: "READY", flagged: true }] } }),
  ]);

  const activeDesigners = new Set(tests.filter((t) => t.publishedAt && t.publishedAt > since30).map((t) => t.project.ownerId)).size;
  const byDesigner = new Map<string, Date[]>();
  for (const t of tests) if (t.publishedAt) byDesigner.set(t.project.ownerId, [...(byDesigner.get(t.project.ownerId) ?? []), t.publishedAt]);
  const withFirst = [...byDesigner.values()].map((d) => d.sort((a, b) => +a - +b));
  const retained = withFirst.filter((d) => d[1] && +d[1] - +d[0] <= 60 * DAY).length;
  const activeTesters = new Set(sessions.filter((s) => s.submittedAt && s.submittedAt > since30).map((s) => s.testerId)).size;
  const decided = sessions.filter((s) => ["ACCEPTED", "REJECTED"].includes(s.status));
  const acceptRate = decided.length ? decided.filter((s) => s.status === "ACCEPTED").length / decided.length : 0;
  const rated = tests.filter((t) => t.reportRating);
  const useful = rated.length ? rated.filter((t) => (t.reportRating ?? 0) >= 4).length / rated.length : 0;

  const hoursToFive = tests
    .filter((t) => t.publishedAt)
    .map((t) => {
      const times = t.sessions.filter((s) => s.submittedAt).map((s) => +s.submittedAt!).sort((a, b) => a - b);
      return times.length >= Math.min(5, t.sessionsWanted) ? (times[Math.min(5, t.sessionsWanted) - 1] - +t.publishedAt!) / 3600_000 : null;
    })
    .filter((x): x is number => x !== null)
    .sort((a, b) => a - b);
  const median = hoursToFive.length ? hoursToFive[Math.floor(hoursToFive.length / 2)] : null;

  const revenue = payments.reduce((n, p) => n + p.amountCents, 0);
  const paidSessions = sessions.filter((s) => s.status === "ACCEPTED");
  const payout = paidSessions.reduce((n, s) => n + s.paidCents, 0);
  const cost = payout + paidSessions.length * VIDEO_AI_COST_CENTS;
  const margin = revenue ? (revenue - cost) / revenue : 0;

  return (
    <>
      <PageHeader title="Operations overview" sub="How the marketplace is doing, compared with the targets in the project plan." />
      <h2 className="h2">Year-one goals</h2>
      <p className="hint mb-4 mt-1">Big number = now, small text = target.</p>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active designers (30d)" value={activeDesigners} hint="Target 500" />
        <Stat label="Designer 60-day retention" value={withFirst.length ? pct(retained / withFirst.length) : "—"} hint="Target 40%" />
        <Stat label="Median time to first 5 sessions" value={median !== null ? `${median.toFixed(1)}h` : "—"} hint="Target < 24h" />
        <Stat label="Active testers (30d)" value={activeTesters} hint="Target 3,000" />
        <Stat label="Sessions accepted" value={decided.length ? pct(acceptRate) : "—"} hint="Target 90%" />
        <Stat label="Reports rated useful" value={rated.length ? pct(useful) : "—"} hint="Target 75%" />
        <Stat label="Gross margin" value={revenue ? pct(margin) : "—"} hint="Target 35%" />
        <Stat label="Revenue collected" value={money(revenue)} />
      </div>
      <h2 className="h2">Right now</h2>
      <p className="hint mb-4 mt-1">Queues that need an admin.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Designers / testers" value={`${designers} / ${testers}`} />
        <Stat label="Live tests" value={tests.filter((t) => t.status === "OPEN").length} />
        <Stat label="Sessions to review" value={queue} hint={<a className="text-brand underline" href="/admin/review">Open review queue</a>} />
        <Stat label="Payouts to approve" value={pendingPayouts} hint={<a className="text-brand underline" href="/admin/payouts">Open payouts</a>} />
      </div>
    </>
  );
}
