import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifyStripe } from "@/lib/market";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const paymentId = url.searchParams.get("payment") ?? "";
  const cs = url.searchParams.get("cs") ?? "";
  const ok = await verifyStripe(paymentId, cs);
  const p = await db.payment.findUnique({ where: { id: paymentId } });
  if (!ok || !p) redirect(`/checkout/${paymentId}?failed=1`);
  redirect(p.testId ? `/designer/tests/${p.testId}` : "/designer/payments");
}
