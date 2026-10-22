import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { CONCEPT_LABEL, getJob, timeAgo } from "@/lib/jobs";
import { PLATFORM_FEE_RATE, money, platformFee } from "@/lib/rules";
import { startSession } from "@/app/actions/tester";
import { FitLabel } from "@/components/job-card";
import { PublicHeader } from "@/components/public-header";
import { Note } from "@/components/ui";

export async function generateMetadata({ params }: PageProps<"/jobs/[id]">) {
  const job = await getJob((await params).id, null);
  return { title: job ? `${job.title} — Usability Cafe` : "Test not found" };
}

export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const user = await getUser();
  const job = await getJob(id, user);
  if (!job) notFound();
  const closed = job.status !== "OPEN" || job.spotsLeft === 0;

  const requirements = [
    ["Device", job.devices.length ? job.devices.map((d) => d.toLowerCase()).join(", ") : "Any"],
    ["Location", job.countries.length ? job.countries.join(", ") : "Worldwide"],
    ["Age", job.ageMin || job.ageMax ? `${job.ageMin ?? 18}–${job.ageMax ?? "any"}` : "18+"],
    ...(job.profession ? [["Profession", job.profession]] : []),
    ...(job.specialist ? [["Experience", "Verified specialist or Cappuccino level"]] : []),
  ];

  let action;
  if (closed) action = <p className="text-sm text-muted">This test isn&apos;t accepting new testers.</p>;
  else if (!user)
    action = (
      <>
        <Link href={`/signup?role=tester`} className="btn-brand w-full">Sign up to take this test</Link>
        <p className="hint mt-2 text-center">Already a tester? <Link href="/login" className="underline">Log in</Link></p>
      </>
    );
  else if (user.role !== "TESTER") action = <p className="text-sm text-muted">Only tester accounts can take tests.</p>;
  else if (job.mySession === "IN_PROGRESS")
    action = (
      <form action={startSession}>
        <input type="hidden" name="testId" value={job.id} />
        <button className="btn-brand w-full">Continue test →</button>
      </form>
    );
  else if (job.mySession) action = <Link href="/tester/sessions" className="btn-ghost w-full">See your session</Link>;
  else if (job.fit?.ok)
    action = (
      <form action={startSession}>
        <input type="hidden" name="testId" value={job.id} />
        <button className="btn-brand w-full">Start test →</button>
        <p className="hint mt-2 text-center">You&apos;ll see the instructions before recording starts.</p>
      </form>
    );
  else action = <FitLabel job={job} />;

  return (
    <div className="flex flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-16">
        <Link href="/" className="mb-4 inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-sm text-muted shadow-sm hover:text-ink">
          ← All tests
        </Link>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <article className="card !p-0">
            <div className="border-b border-line p-6">
              <h1 className="font-display text-2xl font-semibold tracking-[-0.6px]">{job.title}</h1>
              <div className="mt-2 text-sm text-muted">Posted {timeAgo(job.publishedAt)} · {CONCEPT_LABEL[job.conceptType]}</div>
            </div>
            <section className="border-b border-line p-6">
              <h2 className="mb-2 font-semibold">The situation</h2>
              <p className="whitespace-pre-line text-sm leading-6 text-ink/80">{job.description}</p>
            </section>
            <section className="grid gap-4 border-b border-line p-6 sm:grid-cols-3">
              <div><div className="font-semibold">{money(job.rewardCents)}</div><div className="text-xs text-muted">Fixed price per session</div></div>
              <div><div className="font-semibold">~{job.minutes} min</div><div className="text-xs text-muted">{job.taskCount} {job.taskCount === 1 ? "task" : "tasks"} + a few questions</div></div>
              <div><div className="font-semibold">{job.spotsLeft} of {job.sessionsWanted}</div><div className="text-xs text-muted">Spots left</div></div>
            </section>
            <section className="border-b border-line p-6">
              <h2 className="mb-3 font-semibold">Who can take it</h2>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {requirements.map(([k, v]) => (
                  <div key={k}><dt className="text-muted">{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            </section>
            <section className="p-6">
              <h2 className="mb-2 font-semibold">What you&apos;ll do</h2>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-ink/80">
                <li>Allow screen, camera and microphone recording in your browser.</li>
                <li>Try the concept and do the {job.taskCount === 1 ? "task" : `${job.taskCount} tasks`} while saying what you think out loud.</li>
                <li>Answer a few short questions and submit.</li>
              </ol>
              <p className="hint mt-3">The tasks and design files are only shown once you start, and are covered by the tester NDA.</p>
            </section>
          </article>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <Note tone="mint" pin={!closed}>
              <div className="text-sm text-ink/70">You receive</div>
              <div className="font-display text-3xl font-semibold tracking-[-1px] text-ok">{money(job.netCents)}</div>
              <div className="mt-1 text-xs text-ink/60">
                {money(job.rewardCents)} per session − {money(platformFee(job.rewardCents))} service fee ({PLATFORM_FEE_RATE * 100}%)
              </div>
              <div className="mt-5">{action}</div>
            </Note>
            <div className="card text-sm">
              <h2 className="mb-3 font-semibold">About the client</h2>
              <div className="font-medium">{job.client.name}</div>
              <div className="text-muted">{job.project}</div>
              <div className="mt-3 space-y-1 text-muted">
                <div className="text-ok">✓ Payment funded</div>
                <div>{job.clientTests} {job.clientTests === 1 ? "test" : "tests"} posted</div>
                <div>{job.clientPaidSessions} sessions paid</div>
                <div>Member since {job.client.since.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
