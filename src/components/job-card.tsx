import Link from "next/link";
import type { Job } from "@/lib/jobs";
import { CONCEPT_LABEL, timeAgo } from "@/lib/jobs";
import { money } from "@/lib/rules";

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink/75">{children}</span>;
}

/** Shared bits of a job's eligibility label for a signed-in tester. */
export function FitLabel({ job }: { job: Job }) {
  if (job.mySession) return <span className="text-xs font-medium text-info">You took this test</span>;
  if (!job.fit) return null;
  if (job.fit.ok) return <span className="text-xs font-medium text-ok">✓ You qualify</span>;
  if (job.fit.reasons.length) return <span className="text-xs text-muted">Not a match: {job.fit.reasons.join(", ")}</span>;
  if (job.fit.early && job.fit.opensAt)
    return <span className="text-xs text-warn">Opens for your level {job.fit.opensAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>;
  return null;
}

/** One listing on the job board, styled after Upwork's job feed. */
export function JobCard({ job }: { job: Job }) {
  const tags = [
    CONCEPT_LABEL[job.conceptType],
    ...(job.devices.length ? job.devices.map((d) => d[0] + d.slice(1).toLowerCase()) : ["Any device"]),
    ...(job.countries.length ? job.countries.slice(0, 3) : ["Worldwide"]),
    ...(job.countries.length > 3 ? [`+${job.countries.length - 3} countries`] : []),
    ...(job.profession ? [job.profession] : []),
    ...(job.specialist ? ["Specialists"] : []),
  ];
  return (
    <article className="group relative px-5 py-5 transition-colors hover:bg-surface-2/60">
      <div className="text-xs text-muted">Posted {timeAgo(job.publishedAt)}</div>
      <h2 className="mt-1 text-lg font-semibold leading-snug group-hover:text-brand">
        <Link href={`/jobs/${job.id}`} className="after:absolute after:inset-0">{job.title}</Link>
      </h2>
      <div className="mt-1 text-sm text-muted">
        Fixed price · <b className="text-ink">{money(job.rewardCents)}</b> per session · Est. {job.minutes} min · {job.taskCount}{" "}
        {job.taskCount === 1 ? "task" : "tasks"}
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink/80">{job.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="text-ok">✓ Payment funded</span>
        <span>{job.client.name} · {job.project}</span>
        <span>
          <b className="text-ink">{job.spotsLeft}</b> of {job.sessionsWanted} spots left
        </span>
        <span className="ml-auto"><FitLabel job={job} /></span>
      </div>
    </article>
  );
}
