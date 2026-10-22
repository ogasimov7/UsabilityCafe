import "server-only";
import { db, parse } from "./db";
import {
  AUTO_ACCEPT_HOURS,
  EARLY_ACCESS_DELAY_HOURS,
  POINTS_PER_APPROVED,
  REJECTION_PENALTY,
  SPECIALIST_MIN_LEVEL,
  levelFor,
  platformFee,
  ratingBonus,
  testerNet,
} from "./rules";
import type { User, Test } from "@prisma/client";
import { buildReport } from "./analysis";

const HOUR = 3600_000;
export const COUNTED = ["IN_PROGRESS", "SUBMITTED", "ANALYZING", "READY", "ACCEPTED", "DISPUTED"];

export function eligibility(tester: User, test: Test, now = new Date()) {
  const reasons: string[] = [];
  const level = levelFor(tester.points);
  const age = tester.birthYear ? now.getFullYear() - tester.birthYear : null;
  if (test.ageMin && (age === null || age < test.ageMin)) reasons.push(`Age ${test.ageMin}+`);
  if (test.ageMax && (age === null || age > test.ageMax)) reasons.push(`Age up to ${test.ageMax}`);
  const countries = parse<string[]>(test.countries, []);
  if (countries.length && !countries.includes(tester.country ?? "")) reasons.push("Country");
  const devices = parse<string[]>(test.devices, []);
  if (devices.length && !devices.includes(tester.device ?? "")) reasons.push("Device");
  if (test.profession && !(tester.profession ?? "").toLowerCase().includes(test.profession.toLowerCase()))
    reasons.push(`Profession: ${test.profession}`);
  if (test.specialist && !tester.specialist && level.index < SPECIALIST_MIN_LEVEL)
    reasons.push("Specialist or Cappuccino level");
  const delay = EARLY_ACCESS_DELAY_HOURS[level.index] ?? 0;
  const opensAt = test.publishedAt ? new Date(test.publishedAt.getTime() + delay * HOUR) : null;
  const early = opensAt ? opensAt > now : true;
  return { ok: reasons.length === 0 && !early, reasons, opensAt, early };
}

/** What the tester receives for an accepted session of this test. */
export function testerFee(test: Pick<Test, "priceCents">) {
  return testerNet(test.priceCents);
}

export async function acceptSession(sessionId: string, rating: number | null, memo = "Session accepted") {
  const s = await db.session.findUnique({ where: { id: sessionId }, include: { test: true, tester: true } });
  if (!s || !["READY", "SUBMITTED", "ANALYZING", "DISPUTED"].includes(s.status)) return;
  const fee = testerFee(s.test);
  const points = POINTS_PER_APPROVED + ratingBonus(rating);
  await db.$transaction([
    db.session.update({
      where: { id: s.id },
      data: { status: "ACCEPTED", rating, decidedAt: new Date(), paidCents: fee, feeCents: platformFee(s.test.priceCents), pointsAwarded: points },
    }),
    db.user.update({
      where: { id: s.testerId },
      data: { balanceCents: { increment: fee }, points: { increment: points } },
    }),
    db.transaction.create({
      data: { userId: s.testerId, kind: "FEE", amountCents: fee, points, memo: `${memo}: ${s.test.title}`, sessionId: s.id },
    }),
  ]);
  await maybeComplete(s.testId);
  await buildReport(s.testId);
}

export async function rejectSession(sessionId: string, reason: string) {
  const s = await db.session.findUnique({ where: { id: sessionId }, include: { tester: true, test: true } });
  if (!s || !["READY", "SUBMITTED", "ANALYZING"].includes(s.status)) return;
  const penalty = Math.min(REJECTION_PENALTY, s.tester.points);
  await db.$transaction([
    db.session.update({ where: { id: s.id }, data: { status: "REJECTED", rejectReason: reason, decidedAt: new Date() } }),
    db.user.update({ where: { id: s.testerId }, data: { points: { decrement: penalty } } }),
    db.transaction.create({
      data: { userId: s.testerId, kind: "POINTS", points: -penalty, memo: `Session rejected: ${s.test.title}`, sessionId: s.id },
    }),
  ]);
  await buildReport(s.testId);
}

export async function upholdRejection(sessionId: string, note: string) {
  await db.session.update({ where: { id: sessionId }, data: { status: "REJECTED", adminNote: note } });
}

async function maybeComplete(testId: string) {
  const test = await db.test.findUnique({ where: { id: testId } });
  if (!test) return;
  const accepted = await db.session.count({ where: { testId, status: "ACCEPTED" } });
  if (accepted >= test.sessionsWanted && test.status === "OPEN")
    await db.test.update({ where: { id: testId }, data: { status: "COMPLETED" } });
}

/** Pays testers whose sessions were not reviewed within 72 hours. */
export async function autoAcceptDue() {
  const cutoff = new Date(Date.now() - AUTO_ACCEPT_HOURS * HOUR);
  const due = await db.session.findMany({
    where: { status: "READY", submittedAt: { lt: cutoff }, flagged: false },
    select: { id: true },
  });
  for (const s of due) await acceptSession(s.id, null, "Auto-accepted after 72h");
  return due.length;
}

// ---------- Payments ----------

/** The designer funds every session up front; testers get the reward minus the platform fee. */
export function quoteTest(test: Pick<Test, "priceCents" | "sessionsWanted">) {
  return {
    unit: test.priceCents,
    amountCents: test.priceCents * test.sessionsWanted,
    testerGets: testerNet(test.priceCents),
    fee: platformFee(test.priceCents),
  };
}

export async function markPaymentPaid(paymentId: string, providerRef?: string) {
  const p = await db.payment.findUnique({ where: { id: paymentId } });
  if (!p || p.status === "PAID") return p;
  await db.payment.update({ where: { id: p.id }, data: { status: "PAID", providerRef } });
  if (p.testId) await db.test.update({ where: { id: p.testId }, data: { status: "OPEN", publishedAt: new Date() } });
  return p;
}

export async function startCheckout(paymentId: string, description: string) {
  const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const key = process.env.STRIPE_SECRET_KEY;
  const base = process.env.APP_URL ?? "http://localhost:3000";
  if (p.amountCents === 0) {
    await markPaymentPaid(p.id);
    return p.testId ? `/designer/tests/${p.testId}` : "/designer/payments";
  }
  if (!key) return `/checkout/${p.id}`;
  const body = new URLSearchParams({
    mode: "payment",
    success_url: `${base}/api/payments/stripe/return?payment=${p.id}&cs={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/checkout/${p.id}?cancelled=1`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(p.amountCents),
    "line_items[0][price_data][product_data][name]": description,
    client_reference_id: p.id,
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as { id?: string; url?: string; error?: { message: string } };
  if (!res.ok || !json.url) throw new Error(json.error?.message ?? "Stripe checkout failed");
  await db.payment.update({ where: { id: p.id }, data: { provider: "STRIPE", providerRef: json.id } });
  return json.url;
}

export async function verifyStripe(paymentId: string, checkoutSessionId: string) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return false;
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${checkoutSessionId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const json = (await res.json()) as { payment_status?: string; client_reference_id?: string };
  if (json.payment_status === "paid" && json.client_reference_id === paymentId) {
    await markPaymentPaid(paymentId, checkoutSessionId);
    return true;
  }
  return false;
}
