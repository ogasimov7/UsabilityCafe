"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { COUNTED, eligibility } from "@/lib/market";
import { AUTO_ACCEPT_HOURS, MIN_PAYOUT_CENTS } from "@/lib/rules";
import { removeFolder } from "@/lib/storage";
import type { FormState } from "./auth";

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("TESTER");
  const country = String(form.get("country") ?? "");
  const device = String(form.get("device") ?? "");
  const profession = String(form.get("profession") ?? "").trim();
  if (!["DESKTOP", "MOBILE", "TABLET"].includes(device)) return { error: "Choose a device" };
  await db.user.update({
    where: { id: user.id },
    data: { country, device, profession, name: String(form.get("name") ?? user.name).trim() || user.name },
  });
  revalidatePath("/tester");
  return { ok: "Profile saved" };
}

export async function startSession(form: FormData) {
  const user = await requireUser("TESTER");
  const testId = String(form.get("testId"));
  const test = await db.test.findUnique({ where: { id: testId } });
  if (!test || test.status !== "OPEN") redirect("/tester");
  const existing = await db.session.findUnique({ where: { testId_testerId: { testId, testerId: user.id } } });
  if (existing) {
    if (existing.status === "IN_PROGRESS") redirect(`/tester/run/${existing.id}`);
    redirect("/tester/sessions");
  }
  if (!eligibility(user, test).ok) redirect("/tester");
  const taken = await db.session.count({ where: { testId, status: { in: COUNTED } } });
  if (taken >= test.sessionsWanted) redirect("/tester?full=1");
  const s = await db.session.create({ data: { testId, testerId: user.id } });
  redirect(`/tester/run/${s.id}`);
}

export async function abandonSession(form: FormData) {
  const user = await requireUser("TESTER");
  const s = await db.session.findUnique({ where: { id: String(form.get("sessionId")) } });
  if (s && s.testerId === user.id && s.status === "IN_PROGRESS")
    await db.session.update({ where: { id: s.id }, data: { status: "ABANDONED" } });
  redirect("/tester");
}

export async function disputeSession(form: FormData) {
  const user = await requireUser("TESTER");
  const s = await db.session.findUnique({ where: { id: String(form.get("sessionId")) } });
  const reason = String(form.get("reason") ?? "").trim();
  if (!s || s.testerId !== user.id || s.status !== "REJECTED" || !reason || s.disputeReason) return;
  if (s.decidedAt && Date.now() - s.decidedAt.getTime() > AUTO_ACCEPT_HOURS * 3600_000) return;
  await db.session.update({ where: { id: s.id }, data: { status: "DISPUTED", disputeReason: reason } });
  revalidatePath("/tester/sessions");
}

export async function deleteRecording(form: FormData) {
  const user = await requireUser("TESTER");
  const s = await db.session.findUnique({ where: { id: String(form.get("sessionId")) } });
  if (!s || s.testerId !== user.id) return;
  await removeFolder(`sessions/${s.id}`);
  await db.session.update({ where: { id: s.id }, data: { screenPath: null, cameraPath: null } });
  revalidatePath("/tester/sessions");
}

export async function requestPayout(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("TESTER");
  const amountCents = Math.round(Number(form.get("amount")) * 100);
  const method = form.get("method") === "PAYPAL" ? "PAYPAL" : "STRIPE";
  const destination = String(form.get("destination") ?? "").trim();
  if (!destination) return { error: "Add your payout account or PayPal email" };
  if (!Number.isFinite(amountCents) || amountCents < MIN_PAYOUT_CENTS) return { error: "Minimum withdrawal is $10" };
  if (amountCents > user.balanceCents) return { error: "Amount is more than your balance" };
  const pending = await db.payout.count({ where: { userId: user.id, status: "REQUESTED" } });
  if (pending) return { error: "You already have a payout waiting for approval" };
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { balanceCents: { decrement: amountCents } } }),
    db.payout.create({ data: { userId: user.id, amountCents, method, destination } }),
    db.transaction.create({ data: { userId: user.id, kind: "PAYOUT", amountCents: -amountCents, memo: `Payout requested (${method.toLowerCase()})` } }),
  ]);
  revalidatePath("/tester/wallet");
  return { ok: "Payout requested — usually approved within 1 business day." };
}
