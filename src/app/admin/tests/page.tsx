import Link from "next/link";
import { db } from "@/lib/db";
import { moderateTest } from "@/app/actions/admin";
import { PageHeader, Status } from "@/components/ui";
import { money } from "@/lib/rules";

export default async function AdminTests() {
  const tests = await db.test.findMany({ orderBy: { createdAt: "desc" }, include: { project: { include: { owner: true } }, _count: { select: { sessions: true } } } });
  return (
    <>
      <PageHeader title="Test moderation" sub="Every test on the platform. Pause or take down anything that breaks the rules; the note is shown to the designer." />
      <div className="space-y-3">
        {tests.map((t) => (
          <div key={t.id} className="card">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <Link href={`/designer/tests/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
                <div className="text-sm text-muted">{t.project.owner.email} · {t._count.sessions}/{t.sessionsWanted} sessions · {money(t.priceCents)}/session</div>
              </div>
              <Status value={t.status} />
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-muted">{t.description}</p>
            <form action={moderateTest} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="testId" value={t.id} />
              <input className="input flex-1" name="note" defaultValue={t.moderationNote ?? ""} placeholder="Moderation note to the designer" aria-label="Moderation note" />
              {t.status !== "OPEN" && t.publishedAt && <button className="btn-ghost" name="status" value="OPEN">Reopen</button>}
              {t.status === "OPEN" && <button className="btn-ghost" name="status" value="PAUSED">Pause</button>}
              {t.status !== "REJECTED" && <button className="btn-danger" name="status" value="REJECTED">Take down</button>}
            </form>
          </div>
        ))}
      </div>
    </>
  );
}
