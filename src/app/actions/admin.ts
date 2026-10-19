"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { acceptSession, rejectSession, upholdRejection } from "@/lib/market";

async function admin() {
  const user = await requireUser("ADMIN");
  if (user.role !== "ADMIN") throw new Error("Forbidden");
  return user;
}

export async function toggleSuspend(form: FormData) {
  const me = await admin();
  const id = String(form.get("userId"));
  if (id === me.id) return;
  const u = await db.user.findUnique({ where: { id } });
  if (u) await db.user.update({ where: { id }, data: { suspended: !u.suspended } });
  revalidatePath("/admin/users");
}

export async function toggleSpecialist(form: FormData) {
  await admin();
  const id = String(form.get("userId"));
  const u = await db.user.findUnique({ where: { id } });
  if (u) await db.user.update({ where: { id }, data: { specialist: !u.specialist } });
  revalidatePath("/admin/users");
}

export async function moderateTest(form: FormData) {
  await admin();
  const id = String(form.get("testId"));
  const status = String(form.get("status"));
  const note = String(form.get("note") ?? "").trim() || null;
  if (!["OPEN", "PAUSED", "REJECTED"].includes(status)) return;
  await db.test.update({ where: { id }, data: { status, moderationNote: note } });
  revalidatePath("/admin/tests");
}

export async function resolveSession(form: FormData) {
  await admin();
  const id = String(form.get("sessionId"));
  const decision = String(form.get("decision"));
  const note = String(form.get("note") ?? "").trim() || "Reviewed by support";
  const s = await db.session.findUnique({ where: { id } });
  if (!s) return;
  if (s.status === "DISPUTED") {
    if (decision === "pay") {
      await db.session.update({ where: { id }, data: { adminNote: note } });
      await acceptSession(id, null, "Dispute resolved in your favor");
    } else await upholdRejection(id, note);
  } else if (decision === "pay") {
    await db.session.update({ where: { id }, data: { flagged: false, adminNote: note } });
  } else {
    await db.session.update({ where: { id }, data: { adminNote: note } });
    await rejectSession(id, `Quality review: ${note}`);
  }
  revalidatePath("/admin/review");
}

export async function decidePayout(form: FormData) {
  await admin();
  const id = String(form.get("payoutId"));
  const decision = String(form.get("decision"));
  const p = await db.payout.findUnique({ where: { id } });
  if (!p) return;
  if (decision === "approve" && p.status === "REQUESTED")
    await db.payout.update({ where: { id }, data: { status: "APPROVED", decidedAt: new Date() } });
  else if (decision === "paid" && p.status === "APPROVED")
    await db.payout.update({ where: { id }, data: { status: "PAID" } });
  else if (decision === "decline" && p.status === "REQUESTED")
    await db.$transaction([
      db.payout.update({ where: { id }, data: { status: "DECLINED", decidedAt: new Date() } }),
      db.user.update({ where: { id: p.userId }, data: { balanceCents: { increment: p.amountCents } } }),
      db.transaction.create({ data: { userId: p.userId, kind: "ADJUSTMENT", amountCents: p.amountCents, memo: "Payout declined — amount returned" } }),
    ]);
  revalidatePath("/admin/payouts");
}
