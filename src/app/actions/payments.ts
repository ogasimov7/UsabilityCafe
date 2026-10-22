"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { markPaymentPaid } from "@/lib/market";

/** Dev-mode checkout used when no Stripe key is configured. */
export async function simulatePayment(form: FormData) {
  if (process.env.STRIPE_SECRET_KEY) throw new Error("Dev checkout is disabled when Stripe is configured");
  const user = await requireUser("DESIGNER");
  const p = await db.payment.findUnique({ where: { id: String(form.get("paymentId")) } });
  if (!p || p.userId !== user.id) throw new Error("Not found");
  await markPaymentPaid(p.id, "dev");
  redirect(p.testId ? `/designer/tests/${p.testId}` : "/designer/payments");
}
