import { db, parse } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { startSession } from "@/app/actions/tester";
import { Badge, Empty, PageHeader, Steps } from "@/components/ui";
import { COUNTED, eligibility, testerFee } from "@/lib/market";
import { LEVELS, levelFor, money } from "@/lib/rules";

export default async function TesterFeed({ searchParams }: PageProps<"/tester">) {
  const user = await requireUser("TESTER");
  const { full } = await searchParams;
  const level = levelFor(user.points);
  const open = await db.test.findMany({
    where: { status: "OPEN" },
    orderBy: { publishedAt: "desc" },
    include: { sessions: { select: { status: true, testerId: true } } },
  });
  const feed = open
    .filter((t) => !t.sessions.some((s) => s.testerId === user.id))
    .filter((t) => t.sessions.filter((s) => COUNTED.includes(s.status)).length < t.sessionsWanted)
    .map((t) => ({ t, e: eligibility(user, t) }))
    .filter(({ e }) => e.reasons.length === 0);
  const ready = feed.filter(({ e }) => e.ok);
  const soon = feed.filter(({ e }) => e.early);
  const inProgress = await db.session.findMany({ where: { testerId: user.id, status: "IN_PROGRESS" }, include: { test: true } });
  const done = await db.session.count({ where: { testerId: user.id, status: { notIn: ["IN_PROGRESS", "ABANDONED"] } } });
  const profileDone = Boolean(user.country && user.device);
  const progress = level.next ? ((user.points - level.min) / (level.next.min - level.min)) * 100 : 100;

  return (
    <>
      <PageHeader title="Available tests" sub="Pick a test, try the design while saying what you think out loud, and get paid when the designer accepts it." />
      {done === 0 && (
        <Steps
          title="How to earn"
          steps={[
            { title: "Complete your profile", text: "Country, device and job decide which tests you see.", done: profileDone, href: "/tester/profile", cta: "Open profile" },
            { title: "Take a test", text: "Allow screen, camera and mic. Do the tasks and talk while you do them.", done: false, href: "#tests", cta: "See tests" },
            { title: "Get accepted", text: "The designer reviews within 72 hours — otherwise it's accepted automatically." },
            { title: "Cash out", text: "Money lands in your wallet. Withdraw from $10." },
          ]}
        />
      )}
      {full && <div className="mb-4 rounded-[14px] bg-warn/10 p-3 text-sm text-warn">That test just filled up — try another one.</div>}

      <div className="card mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm text-muted">Your level — earn points for every accepted session</div>
            <div className="font-display text-2xl font-semibold">{level.emoji} {level.name}</div>
            <div className="text-sm text-muted">{level.bonus ? `+${level.bonus * 100}% fee bonus · ` : ""}{user.points} points</div>
          </div>
          <div className="w-full max-w-sm">
            <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} /></div>
            <div className="mt-1 text-xs text-muted">
              {level.next ? `${level.next.min - user.points} points to ${level.next.name}` : "Top level reached"}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {LEVELS.map((l) => <Badge key={l.key} tone={l.key === level.key ? "brand" : "neutral"}>{l.emoji} {l.name} {l.min}+</Badge>)}
        </div>
      </div>

      {inProgress.length > 0 && (
        <div className="mb-6 space-y-2">
          {inProgress.map((s) => (
            <a key={s.id} href={`/tester/run/${s.id}`} className="card flex items-center justify-between !py-3 hover:bg-surface-2">
              <span>Continue: <b>{s.test.title}</b></span><span className="text-brand">Resume →</span>
            </a>
          ))}
        </div>
      )}

      <h2 id="tests" className="h2 mb-4 scroll-mt-28">Tests for you ({ready.length})</h2>
      {ready.length === 0 ? (
        <Empty>No tests match your profile right now. New tests appear throughout the day — higher levels see them first.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {ready.map(({ t }) => {
            const tasks = parse<unknown[]>(t.tasks, []);
            return (
              <form key={t.id} action={startSession} className="card flex flex-col">
                <input type="hidden" name="testId" value={t.id} />
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{t.title}</h2>
                  <div className="shrink-0 text-right">
                    <div className="font-display text-xl font-semibold text-ok">{money(testerFee(t, user))}</div>
                    <div className="hint">you earn</div>
                  </div>
                </div>
                <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted">{t.description}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge>{tasks.length} {tasks.length === 1 ? "task" : "tasks"}</Badge>
                  <Badge>~{Math.max(5, Math.round(t.minSeconds / 60) + 3)} min</Badge>
                  <Badge>{{ LINK: "Prototype link", IMAGES: "Images", PDF: "PDF", VIDEO: "Video" }[t.conceptType] ?? t.conceptType}</Badge>
                  {t.specialist && <Badge tone="brand">specialist</Badge>}
                </div>
                <button className="btn-brand mt-4">Start test →</button>
              </form>
            );
          })}
        </div>
      )}
      {soon.length > 0 && (
        <p className="mt-6 text-sm text-muted">
          {soon.length} more test(s) open to you soon — higher levels get early access.
        </p>
      )}
    </>
  );
}
