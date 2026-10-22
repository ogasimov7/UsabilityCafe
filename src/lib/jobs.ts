import "server-only";
import type { Prisma, User } from "@prisma/client";
import { db, parse } from "./db";
import { COUNTED, eligibility, testerFee } from "./market";
import type { TaskDef } from "./analysis";

export const CONCEPT_LABEL: Record<string, string> = { LINK: "Prototype link", IMAGES: "Images", PDF: "PDF", VIDEO: "Video" };

export type JobFilters = { q?: string; type?: string; device?: string; country?: string; sort?: string };

const include = {
  project: { include: { owner: { select: { id: true, name: true, createdAt: true } } } },
  sessions: { select: { status: true, testerId: true } },
} satisfies Prisma.TestInclude;

type JobRow = Prisma.TestGetPayload<{ include: typeof include }>;

/** Rough session length shown to testers. */
export function estMinutes(minSeconds: number, tasks: number) {
  return Math.max(5, Math.round(minSeconds / 60) + tasks * 2);
}

function toJob(t: JobRow, viewer: User | null) {
  const tasks = parse<TaskDef[]>(t.tasks, []);
  const taken = t.sessions.filter((s) => COUNTED.includes(s.status)).length;
  const mine = viewer ? t.sessions.find((s) => s.testerId === viewer.id) : undefined;
  const fit = viewer?.role === "TESTER" ? eligibility(viewer, t) : null;
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    conceptType: t.conceptType,
    rewardCents: t.priceCents,
    netCents: testerFee(t),
    spotsLeft: Math.max(0, t.sessionsWanted - taken),
    sessionsWanted: t.sessionsWanted,
    publishedAt: t.publishedAt ?? t.createdAt,
    minutes: estMinutes(t.minSeconds, tasks.length),
    taskCount: tasks.length,
    devices: parse<string[]>(t.devices, []),
    countries: parse<string[]>(t.countries, []),
    ageMin: t.ageMin,
    ageMax: t.ageMax,
    profession: t.profession,
    specialist: t.specialist,
    project: t.project.name,
    client: { id: t.project.owner.id, name: t.project.owner.name, since: t.project.owner.createdAt },
    /** For a signed-in tester: whether they can start it now, and why not. */
    fit: fit && { ok: fit.ok && !mine, reasons: fit.reasons, early: fit.early, opensAt: fit.opensAt },
    mySession: mine ? mine.status : null,
  };
}

export type Job = ReturnType<typeof toJob>;

/** Open, funded tests that still have spots, newest first (or best paid). */
export async function listJobs(filters: JobFilters, viewer: User | null) {
  const q = filters.q?.trim();
  const where: Prisma.TestWhereInput = {
    status: "OPEN",
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}),
    ...(filters.type && CONCEPT_LABEL[filters.type] ? { conceptType: filters.type } : {}),
  };
  const rows = await db.test.findMany({
    where,
    include,
    orderBy: filters.sort === "pay" ? [{ priceCents: "desc" }, { publishedAt: "desc" }] : { publishedAt: "desc" },
    take: 200,
  });
  return rows
    .map((t) => toJob(t, viewer))
    .filter((j) => j.spotsLeft > 0 || j.mySession)
    .filter((j) => !filters.device || !j.devices.length || j.devices.includes(filters.device))
    .filter((j) => !filters.country || !j.countries.length || j.countries.includes(filters.country));
}

export async function getJob(id: string, viewer: User | null) {
  const t = await db.test.findUnique({ where: { id }, include });
  if (!t || !["OPEN", "COMPLETED", "PAUSED"].includes(t.status)) return null;
  const clientStats = await db.test.findMany({
    where: { project: { ownerId: t.project.owner.id }, publishedAt: { not: null } },
    select: { _count: { select: { sessions: { where: { status: "ACCEPTED" } } } } },
  });
  return {
    ...toJob(t, viewer),
    status: t.status,
    clientTests: clientStats.length,
    clientPaidSessions: clientStats.reduce((n, x) => n + x._count.sessions, 0),
  };
}

export function timeAgo(d: Date) {
  const m = Math.round((Date.now() - +d) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const days = Math.round(h / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
