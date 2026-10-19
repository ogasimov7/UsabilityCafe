"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, homeFor, verifyPassword, type Role } from "@/lib/auth";
import { FREE_CREDITS_FOR_NEW_DESIGNERS, FREE_CREDIT_DESIGNER_LIMIT } from "@/lib/rules";

export type FormState = { error?: string; ok?: string } | undefined;

const signupSchema = z.object({
  role: z.enum(["DESIGNER", "TESTER"]),
  name: z.string().trim().min(2, "Enter your name"),
  email: z.email("Enter a valid email").transform((e) => e.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const testerSchema = z.object({
  birthYear: z.coerce.number().int().min(1900),
  country: z.string().min(1, "Choose your country"),
  device: z.enum(["DESKTOP", "MOBILE", "TABLET"]),
  profession: z.string().trim().min(2, "Enter your profession"),
  consent: z.literal("on", { error: "Recording consent is required" }),
  nda: z.literal("on", { error: "You must accept the tester NDA" }),
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { role, name, email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return { error: "An account with this email already exists" };

  let extra = {};
  if (role === "TESTER") {
    const t = testerSchema.safeParse(Object.fromEntries(form));
    if (!t.success) return { error: t.error.issues[0].message };
    if (new Date().getFullYear() - t.data.birthYear < 18) return { error: "Testers must be 18 or older" };
    extra = {
      birthYear: t.data.birthYear,
      country: t.data.country,
      device: t.data.device,
      profession: t.data.profession,
      consentAt: new Date(),
      ndaAt: new Date(),
    };
  } else {
    const designers = await db.user.count({ where: { role: "DESIGNER" } });
    const student = form.get("student") === "on";
    if (designers < FREE_CREDIT_DESIGNER_LIMIT || student) extra = { sessionCredits: FREE_CREDITS_FOR_NEW_DESIGNERS };
  }

  const user = await db.user.create({
    data: { role, name, email, passwordHash: await hashPassword(password), ...extra },
  });
  await createSession(user.id);
  redirect(homeFor(role as Role));
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: "Wrong email or password" };
  if (user.suspended) return { error: "This account is suspended. Contact support." };
  await createSession(user.id);
  redirect(homeFor(user.role as Role));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function joinWaitlist(_: FormState, form: FormData): Promise<FormState> {
  const email = z.email().safeParse(String(form.get("email") ?? "").toLowerCase());
  if (!email.success) return { error: "Enter a valid email" };
  const role = form.get("role") === "DESIGNER" ? "DESIGNER" : "TESTER";
  await db.waitlist.upsert({
    where: { email: email.data },
    create: { email: email.data, role, referrer: (form.get("ref") as string) || null },
    update: {},
  });
  return { ok: "You're on the list — we'll email you when your seat is ready." };
}
