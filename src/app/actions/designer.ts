"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { saveUpload } from "@/lib/storage";
import { acceptSession, quoteTest, rejectSession, startCheckout } from "@/lib/market";
import { BASE_FEE_CENTS, PLANS, SPECIALIST_FEE_CENTS, priceForSession, type PlanKey } from "@/lib/rules";
import type { FormState } from "./auth";

async function ownTest(testId: string) {
  const user = await requireUser("DESIGNER");
  const test = await db.test.findUnique({ where: { id: testId }, include: { project: true } });
  if (!test || (test.project.ownerId !== user.id && user.role !== "ADMIN")) throw new Error("Not found");
  return { user, test };
}

export async function createProject(form: FormData) {
  const user = await requireUser("DESIGNER");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return;
  const p = await db.project.create({ data: { name, ownerId: user.id } });
  redirect(`/designer/tests/new?project=${p.id}`);
}

const testSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(3, "Give the test a title"),
  description: z.string().trim().min(10, "Describe the concept and context for testers (10+ characters)"),
  conceptType: z.enum(["LINK", "IMAGES", "PDF", "VIDEO"]),
  conceptUrl: z.string().trim().optional(),
  tasks: z.string(),
  questions: z.string(),
  attentionPrompt: z.string().trim().optional(),
  attentionAnswer: z.string().trim().optional(),
  ageMin: z.coerce.number().int().min(18).max(99).optional().or(z.literal("").transform(() => undefined)),
  ageMax: z.coerce.number().int().min(18).max(99).optional().or(z.literal("").transform(() => undefined)),
  profession: z.string().trim().optional(),
  sessionsWanted: z.coerce.number().int().min(1).max(50),
  minSeconds: z.coerce.number().int().min(30).max(1800),
});

export async function createTest(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("DESIGNER");
  const parsed = testSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const project = await db.project.findFirst({ where: { id: d.projectId, ownerId: user.id } });
  if (!project) return { error: "Choose a project" };

  const tasks = (JSON.parse(d.tasks) as { title: string; instructions: string }[]).filter((t) => t.title.trim());
  if (!tasks.length) return { error: "Add at least one task" };
  const questions = (JSON.parse(d.questions) as { prompt: string; kind: string }[]).filter((q) => q.prompt.trim());
  const files = form.getAll("assets").filter((f): f is File => f instanceof File && f.size > 0);
  if (d.conceptType === "LINK" && !d.conceptUrl) return { error: "Add the prototype link" };
  if (d.conceptType !== "LINK" && !files.length) return { error: "Upload the concept files" };
  if (d.conceptUrl && !/^https?:\/\//.test(d.conceptUrl)) return { error: "The prototype link must start with http(s)://" };

  const specialist = form.get("specialist") === "on";
  const plan = user.plan as PlanKey;
  // Custom profession screeners are a Pro feature, except for specialist tests.
  if (d.profession && plan !== "PRO" && !specialist)
    return { error: "Profession screeners need the Pro plan or a specialist test" };

  const test = await db.test.create({
    data: {
      projectId: project.id,
      title: d.title,
      description: d.description,
      conceptType: d.conceptType,
      conceptUrl: d.conceptUrl || null,
      tasks: JSON.stringify(tasks),
      questions: JSON.stringify(questions),
      attention: JSON.stringify(
        d.attentionPrompt && d.attentionAnswer ? { prompt: d.attentionPrompt, answer: d.attentionAnswer } : {},
      ),
      ageMin: d.ageMin ?? null,
      ageMax: d.ageMax ?? null,
      countries: JSON.stringify(form.getAll("countries").map(String)),
      devices: JSON.stringify(form.getAll("devices").map(String)),
      profession: d.profession || null,
      specialist,
      sessionsWanted: d.sessionsWanted,
      minSeconds: d.minSeconds,
      priceCents: priceForSession(plan, specialist),
      feeCents: specialist ? SPECIALIST_FEE_CENTS : BASE_FEE_CENTS,
    },
  });
  const assets: string[] = [];
  for (const f of files.slice(0, 20)) assets.push(await saveUpload(`tests/${test.id}`, f));
  await db.test.update({ where: { id: test.id }, data: { assets: JSON.stringify(assets) } });
  redirect(`/designer/tests/${test.id}`);
}

export async function checkoutTest(form: FormData) {
  const { user, test } = await ownTest(String(form.get("testId")));
  if (!["DRAFT", "PENDING_PAYMENT"].includes(test.status)) return;
  const q = quoteTest(user, test);
  const payment = await db.payment.create({
    data: {
      userId: user.id,
      testId: test.id,
      kind: "TEST",
      amountCents: q.amountCents,
      creditsUsed: q.creditsUsed,
      provider: process.env.STRIPE_SECRET_KEY ? "STRIPE" : "DEV",
    },
  });
  await db.test.update({ where: { id: test.id }, data: { status: "PENDING_PAYMENT", priceCents: q.unit } });
  redirect(await startCheckout(payment.id, `Usability Cafe test: ${test.title} (${test.sessionsWanted} sessions)`));
}

export async function buyPlan(form: FormData) {
  const user = await requireUser("DESIGNER");
  const plan = String(form.get("plan")) as PlanKey;
  if (!(plan in PLANS) || plan === "PAYG") {
    await db.user.update({ where: { id: user.id }, data: { plan: "PAYG" } });
    revalidatePath("/designer/billing");
    return;
  }
  const payment = await db.payment.create({
    data: {
      userId: user.id,
      kind: "PLAN",
      plan,
      amountCents: PLANS[plan].monthlyCents,
      provider: process.env.STRIPE_SECRET_KEY ? "STRIPE" : "DEV",
    },
  });
  redirect(await startCheckout(payment.id, `Usability Cafe ${PLANS[plan].name} plan — 1 month`));
}

export async function setTestStatus(form: FormData) {
  const { test } = await ownTest(String(form.get("testId")));
  const next = String(form.get("status"));
  if (test.status === "OPEN" && next === "PAUSED") await db.test.update({ where: { id: test.id }, data: { status: "PAUSED" } });
  if (test.status === "PAUSED" && next === "OPEN") await db.test.update({ where: { id: test.id }, data: { status: "OPEN" } });
  revalidatePath(`/designer/tests/${test.id}`);
}

export async function decideSession(form: FormData) {
  const sessionId = String(form.get("sessionId"));
  const s = await db.session.findUnique({ where: { id: sessionId } });
  if (!s) return;
  await ownTest(s.testId);
  const decision = String(form.get("decision"));
  if (decision === "accept") {
    const rating = Number(form.get("rating")) || null;
    await acceptSession(s.id, rating && rating >= 1 && rating <= 5 ? rating : null);
  } else {
    const reason = String(form.get("reason") ?? "").trim() || "Did not follow the tasks";
    await rejectSession(s.id, reason);
  }
  revalidatePath(`/designer/tests/${s.testId}`);
  redirect(`/designer/tests/${s.testId}`);
}

export async function rateReport(form: FormData) {
  const { test } = await ownTest(String(form.get("testId")));
  const rating = Number(form.get("rating"));
  if (rating >= 1 && rating <= 5) await db.test.update({ where: { id: test.id }, data: { reportRating: rating } });
  revalidatePath(`/designer/tests/${test.id}`);
}
