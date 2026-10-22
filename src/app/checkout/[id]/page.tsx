import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { simulatePayment } from "@/app/actions/payments";
import { Logo, Note } from "@/components/ui";
import { money } from "@/lib/rules";

export default async function Checkout({ params }: PageProps<"/checkout/[id]">) {
  const user = await requireUser("DESIGNER");
  const { id } = await params;
  const p = await db.payment.findUnique({ where: { id }, include: { test: true } });
  if (!p || p.userId !== user.id) notFound();
  if (p.status === "PAID") redirect(p.testId ? `/designer/tests/${p.testId}` : "/designer/payments");
  const item = `${p.test?.title} — ${p.test?.sessionsWanted} sessions × ${money(p.test?.priceCents ?? 0)}`;
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <div className="flex justify-center"><Logo /></div>
      <Note tone="mint" className="mt-8" panelClassName="space-y-4 !bg-surface !border-line">
        <div className="badge bg-warn/15 text-warn">Development checkout</div>
        <h1 className="h2">Confirm payment</h1>
        <div className="flex justify-between text-sm"><span>{item}</span><span className="font-semibold">{money(p.amountCents)}</span></div>
        <p className="hint">Stripe is not configured, so this payment is simulated. Set STRIPE_SECRET_KEY to use real Stripe Checkout.</p>
        <form action={simulatePayment}>
          <input type="hidden" name="paymentId" value={p.id} />
          <button className="btn-brand w-full">Simulate successful payment</button>
        </form>
        <Link href="/designer" className="block text-center text-sm text-muted">Cancel</Link>
      </Note>
    </div>
  );
}
