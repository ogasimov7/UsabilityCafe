import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PayoutForm } from "@/components/tester-forms";
import { Callout, Note, PageHeader, Stat, Status } from "@/components/ui";
import { levelFor, money } from "@/lib/rules";

export default async function Wallet() {
  const user = await requireUser("TESTER");
  const [tx, payouts] = await Promise.all([
    db.transaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.payout.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const earned = tx.filter((t) => t.kind === "FEE").reduce((n, t) => n + t.amountCents, 0);
  const level = levelFor(user.points);
  return (
    <>
      <PageHeader title="Wallet" sub="Your earnings, points and withdrawals." />
      <Callout tone="mint" title="How you get paid">
        When a designer accepts your session (or doesn&apos;t review it within 72 hours), the fee lands here as available balance.
        Once you have $10 or more, request a payout to your bank or PayPal.
      </Callout>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Available balance" value={money(user.balanceCents)} hint={user.balanceCents >= 1000 ? "Ready to withdraw" : `${money(1000 - user.balanceCents)} more to withdraw`} />
        <Stat label="Total earned" value={money(earned)} />
        <Stat label="Points" value={user.points} hint={`${level.emoji} ${level.name}${level.bonus ? ` · +${level.bonus * 100}% fees` : ""}`} />
      </div>
      <Note tone="mint" pin={user.balanceCents >= 1000} className="mb-10" panelClassName={user.balanceCents >= 1000 ? "" : "!bg-surface !border-line"}>
        <h2 className="h2 mb-3">Withdraw money</h2>
        <PayoutForm max={user.balanceCents} />
      </Note>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="h2 mb-3">Earnings & points</h2>
          <ul className="card divide-y divide-line !p-0 text-sm">
            {tx.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-3">
                <div><div>{t.memo}</div><div className="text-xs text-muted">{t.createdAt.toLocaleString("en-US")}</div></div>
                <div className="text-right">
                  {t.amountCents !== 0 && <div className={t.amountCents > 0 ? "text-ok" : ""}>{t.amountCents > 0 ? "+" : ""}{money(t.amountCents)}</div>}
                  {t.points !== 0 && <div className="text-xs text-muted">{t.points > 0 ? "+" : ""}{t.points} pts</div>}
                </div>
              </li>
            ))}
            {tx.length === 0 && <li className="p-3 text-muted">Nothing yet — take a test from Available tests to start earning.</li>}
          </ul>
        </section>
        <section>
          <h2 className="h2 mb-3">Withdrawals</h2>
          <ul className="card divide-y divide-line !p-0 text-sm">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between p-3">
                <div><div>{money(p.amountCents)} · {p.method.toLowerCase()}</div><div className="text-xs text-muted">{p.createdAt.toLocaleDateString("en-US")}</div></div>
                <Status value={p.status} />
              </li>
            ))}
            {payouts.length === 0 && <li className="p-3 text-muted">No payouts yet.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
