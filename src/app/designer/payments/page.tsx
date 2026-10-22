import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Callout, PageHeader, Stat, Status } from "@/components/ui";
import { PLATFORM_FEE_RATE, money } from "@/lib/rules";

export default async function Payments() {
  const user = await requireUser("DESIGNER");
  const payments = await db.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { test: true } });
  const paid = payments.filter((p) => p.status === "PAID");
  const spent = paid.reduce((n, p) => n + p.amountCents, 0);
  return (
    <>
      <PageHeader title="Payments" sub="What you've paid to run your tests." />
      <Callout title="How paying works">
        Posting a test is free. You choose how much each session pays and fund the sessions when you publish. Testers receive that
        amount minus Usability Cafe&apos;s {PLATFORM_FEE_RATE * 100}% service fee — there are no plans or subscriptions.
        {!process.env.STRIPE_SECRET_KEY && " (Development mode: payments are simulated.)"}
      </Callout>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Total paid" value={money(spent)} />
        <Stat label="Tests funded" value={paid.length} />
        <Stat label="Service fee" value={`${PLATFORM_FEE_RATE * 100}%`} hint="Taken from tester earnings" />
      </div>
      <h2 className="h2 mb-3">Payment history</h2>
      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
            <tr><th className="p-3">Date</th><th className="p-3">Test</th><th className="p-3">Amount</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="p-3">{p.createdAt.toLocaleDateString("en-US")}</td>
                <td className="p-3">
                  {p.testId ? <Link className="hover:underline" href={`/designer/tests/${p.testId}`}>{p.test?.title ?? "Test"}</Link> : "—"}
                  {p.test && <div className="text-xs text-muted">{p.test.sessionsWanted} sessions × {money(p.test.priceCents)}</div>}
                </td>
                <td className="p-3">{money(p.amountCents)}</td>
                <td className="p-3"><Status value={p.status} /></td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td className="p-3 text-muted" colSpan={4}>No payments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
