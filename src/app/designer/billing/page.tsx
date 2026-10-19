import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { buyPlan } from "@/app/actions/designer";
import { Callout, Note, PageHeader, Stat, Status } from "@/components/ui";
import { PLANS, SPECIALIST_PRICE_CENTS, money, type PlanKey } from "@/lib/rules";

export default async function Billing() {
  const user = await requireUser("DESIGNER");
  const payments = await db.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { test: true } });
  const plan = PLANS[user.plan as PlanKey];
  return (
    <>
      <PageHeader title="Plan & billing" sub="Choose how you pay for sessions and see your payment history." />
      <Callout title="How billing works">
        You pay per session — one session is one tester trying your concept. Free credits are used first. A monthly plan
        includes sessions and lowers the price of extra ones.
        {!process.env.STRIPE_SECRET_KEY && " (Development mode: payments are simulated.)"}
      </Callout>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Current plan" value={plan.name} />
        <Stat label="Sessions left to use" value={user.sessionCredits} hint="Used before you pay" />
        <Stat label="Price per extra session" value={money(plan.sessionCents)} hint={`Specialists ${money(SPECIALIST_PRICE_CENTS)}`} />
      </div>
      <div className="mb-10 grid gap-4 md:grid-cols-3">
        {(Object.keys(PLANS) as PlanKey[]).map((k) => (
          <Note key={k} tone="peach" pin={user.plan === k} panelClassName={user.plan === k ? "" : "!bg-surface !border-line"}>
          <form action={buyPlan} className="flex h-full flex-col">
            <input type="hidden" name="plan" value={k} />
            <div className="flex items-center justify-between">
              <span className="font-semibold">{PLANS[k].name}</span>
              {user.plan === k && <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-brand">Your plan</span>}
            </div>
            <div className="mt-1 font-display text-2xl font-semibold">
              {PLANS[k].monthlyCents ? `${money(PLANS[k].monthlyCents)}/mo` : `${money(PLANS[k].sessionCents)}/session`}
            </div>
            <p className="mt-2 flex-1 text-sm text-muted">
              {PLANS[k].included ? `${PLANS[k].included} sessions included, extra ${money(PLANS[k].sessionCents)}` : "Pay only for what you run"}
              {k === "PRO" && ", custom screeners"}
            </p>
            <button className={user.plan === k ? "btn-ghost mt-4" : "btn-primary mt-4"} disabled={user.plan === k && k === "PAYG"}>
              {user.plan === k ? (k === "PAYG" ? "Current plan" : "Renew month") : `Switch to ${PLANS[k].name}`}
            </button>
          </form>
          </Note>
        ))}
      </div>
      <h2 className="h2 mb-3">Payment history</h2>
      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted"><tr><th className="p-3">Date</th><th className="p-3">Item</th><th className="p-3">Free sessions used</th><th className="p-3">Amount</th><th className="p-3">Status</th></tr></thead>
          <tbody className="divide-y divide-line">
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="p-3">{p.createdAt.toLocaleDateString("en-US")}</td>
                <td className="p-3">{p.kind === "PLAN" ? `${PLANS[p.plan as PlanKey]?.name} plan` : p.test?.title ?? "Test"}</td>
                <td className="p-3">{p.creditsUsed}</td>
                <td className="p-3">{money(p.amountCents)}</td>
                <td className="p-3"><Status value={p.status} /></td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td className="p-3 text-muted" colSpan={5}>No payments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
