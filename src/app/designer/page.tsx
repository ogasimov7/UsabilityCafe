import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createProject } from "@/app/actions/designer";
import { Empty, PageHeader, Stat, Status, Steps } from "@/components/ui";
import { autoAcceptDue, COUNTED } from "@/lib/market";

export default async function DesignerHome() {
  const user = await requireUser("DESIGNER");
  await autoAcceptDue();
  const projects = await db.project.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { tests: { orderBy: { createdAt: "desc" }, include: { sessions: { select: { status: true } } } } },
  });
  const tests = projects.flatMap((p) => p.tests);
  const sessions = tests.flatMap((t) => t.sessions);
  const toReview = sessions.filter((s) => s.status === "READY").length;
  const firstReady = tests.find((t) => t.sessions.some((s) => s.status === "READY"));
  const unpaid = tests.find((t) => ["DRAFT", "PENDING_PAYMENT"].includes(t.status));
  const live = tests.some((t) => !["DRAFT", "PENDING_PAYMENT"].includes(t.status));
  const reviewed = sessions.some((s) => ["ACCEPTED", "REJECTED", "DISPUTED"].includes(s.status));
  const showGuide = !reviewed || toReview > 0;

  return (
    <>
      <PageHeader
        title={`Hi ${user.name.split(" ")[0]}`}
        sub="Here you create tests, follow their progress and review what testers found."
        actions={projects.length > 0 && <Link className="btn-primary" href="/designer/tests/new">New test</Link>}
      />
      {showGuide && (
        <Steps
          title={reviewed ? "Waiting for you" : "Your first test in 4 steps"}
          steps={[
            {
              title: "Create a project",
              text: "A folder for one product, e.g. “Banking app”.",
              done: projects.length > 0,
              href: "#new-project",
              cta: "Create project",
            },
            {
              title: "Describe the test",
              text: "Add your concept and 1–3 tasks for testers.",
              done: tests.length > 0,
              href: projects[0] ? `/designer/tests/new?project=${projects[0].id}` : undefined,
              cta: "New test",
            },
            {
              title: "Publish it",
              text: `Pay per session — your ${user.sessionCredits} free sessions are used first.`,
              done: live,
              href: unpaid ? `/designer/tests/${unpaid.id}` : undefined,
              cta: "Review & publish",
            },
            {
              title: "Review sessions",
              text: live && !firstReady && !reviewed
                ? "Testers are taking your test now. First sessions usually arrive within 24 hours."
                : "Watch recordings, accept good ones, then read the report.",
              done: reviewed && toReview === 0,
              href: firstReady ? `/designer/tests/${firstReady.id}` : undefined,
              cta: "Review now",
            },
          ]}
        />
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <Stat label="Tests" value={tests.length} />
        <Stat label="Live tests" value={tests.filter((t) => t.status === "OPEN").length} />
        <Stat label="Sessions received" value={sessions.filter((s) => !["IN_PROGRESS", "ABANDONED"].includes(s.status)).length} />
        <Stat label="Waiting for your review" value={toReview} hint={toReview ? "Accepted automatically after 72h" : "Nothing to review"} />
      </div>

      <form id="new-project" action={createProject} className="card mb-8 scroll-mt-28 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label" htmlFor="name">New project</label>
          <p className="hint mb-2">Group tests for the same product. You can add many tests to one project.</p>
          <input className="input" id="name" name="name" placeholder="e.g. Banking app onboarding" required />
        </div>
        <button className="btn-primary">Create project</button>
      </form>

      {projects.length === 0 ? (
        <Empty>Create your first project to start a test. You have {user.sessionCredits} free sessions.</Empty>
      ) : (
        <div className="space-y-6">
          {projects.map((p) => (
            <section key={p.id}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="h2">{p.name}</h2>
                <Link className="text-sm font-medium text-brand" href={`/designer/tests/new?project=${p.id}`}>+ Add test</Link>
              </div>
              {p.tests.length === 0 ? (
                <Empty>No tests in this project yet.</Empty>
              ) : (
                <div className="card divide-y divide-line overflow-hidden !p-0">
                  {p.tests.map((t) => {
                    const done = t.sessions.filter((s) => COUNTED.includes(s.status) && s.status !== "IN_PROGRESS").length;
                    return (
                      <Link key={t.id} href={`/designer/tests/${t.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-surface-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{t.title}</div>
                          <div className="text-sm text-muted">{done} / {t.sessionsWanted} sessions</div>
                        </div>
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-surface-2" title="Sessions received">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (done / t.sessionsWanted) * 100)}%` }} />
                        </div>
                        <Status value={t.status} />
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
