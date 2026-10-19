import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { deleteRecording, disputeSession } from "@/app/actions/tester";
import { Callout, Empty, PageHeader, Status, fmtTime } from "@/components/ui";
import { AUTO_ACCEPT_HOURS, hoursAgo, money } from "@/lib/rules";

export default async function MySessions({ searchParams }: PageProps<"/tester/sessions">) {
  const user = await requireUser("TESTER");
  const { submitted } = await searchParams;
  const sessions = await db.session.findMany({
    where: { testerId: user.id, status: { not: "ABANDONED" } },
    orderBy: { startedAt: "desc" },
    include: { test: true },
  });
  return (
    <>
      <PageHeader title="My sessions" sub="Every test you've taken and what happened to it." />
      <Callout title="What happens after you submit">
        <b>Analyzing</b> → <b>Needs review</b> (the designer watches it) → <b>Accepted</b> (you&apos;re paid) or <b>Rejected</b>.
        If the designer doesn&apos;t decide within {AUTO_ACCEPT_HOURS} hours, it&apos;s accepted automatically. You can dispute an unfair rejection.
      </Callout>
      {submitted && <Callout tone="mint" title="Thanks! Your session was submitted.">It&apos;s being analyzed now. You&apos;ll see the designer&apos;s decision here.</Callout>}
      {sessions.length === 0 ? (
        <Empty>You haven&apos;t taken any tests yet. Find one under <a className="text-brand underline" href="/tester">Available tests</a>.</Empty>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const canDispute = s.status === "REJECTED" && !s.disputeReason && s.decidedAt && s.decidedAt > hoursAgo(AUTO_ACCEPT_HOURS);
            return (
              <div key={s.id} className="card">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{s.test.title}</div>
                    <div className="text-sm text-muted">
                      {s.startedAt.toLocaleDateString("en-US")} · {fmtTime(s.durationSec)}
                      {s.status === "ACCEPTED" && ` · earned ${money(s.paidCents)} + ${s.pointsAwarded} pts`}
                      {s.rating && ` · rated ${s.rating}★`}
                    </div>
                  </div>
                  <Status value={s.status} />
                  {s.status === "IN_PROGRESS" && <a className="btn-brand" href={`/tester/run/${s.id}`}>Resume</a>}
                </div>
                {s.rejectReason && <p className="mt-2 text-sm text-bad">Designer&apos;s reason: {s.rejectReason}</p>}
                {s.disputeReason && <p className="mt-2 text-sm text-warn">Your dispute: {s.disputeReason}{s.adminNote ? ` — Support: ${s.adminNote}` : ""}</p>}
                {canDispute && (
                  <form action={disputeSession} className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input type="hidden" name="sessionId" value={s.id} />
                    <input className="input flex-1" name="reason" required placeholder="Explain why this rejection is unfair" aria-label="Dispute reason" />
                    <button className="btn-ghost">Dispute</button>
                  </form>
                )}
                {(s.screenPath || s.cameraPath) && !["IN_PROGRESS", "SUBMITTED", "ANALYZING"].includes(s.status) && (
                  <form action={deleteRecording} className="mt-2">
                    <input type="hidden" name="sessionId" value={s.id} />
                    <button className="text-xs text-muted underline">Delete my recording</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
