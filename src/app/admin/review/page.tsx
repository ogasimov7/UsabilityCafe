import Link from "next/link";
import { db } from "@/lib/db";
import { resolveSession } from "@/app/actions/admin";
import { Callout, Empty, PageHeader, Status, fmtTime } from "@/components/ui";

export default async function ReviewQueue() {
  const items = await db.session.findMany({
    where: { OR: [{ status: "DISPUTED" }, { status: "READY", flagged: true }] },
    orderBy: { submittedAt: "asc" },
    include: { test: true, tester: true },
  });
  return (
    <>
      <PageHeader title="Review queue" sub="Sessions that need a human decision." />
      <Callout title="Two kinds of items land here">
        <b>Flagged</b>: the analysis thinks the session is low quality (silent, too short, failed attention check).{" "}
        <b>Disputed</b>: a tester thinks the designer rejected them unfairly. Watch the session, then decide.
      </Callout>
      {items.length === 0 ? (
        <Empty>Nothing to review — all clear. ✓</Empty>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <div key={s.id} className="card space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium">{s.test.title}</div>
                  <div className="text-sm text-muted">{s.tester.name} ({s.tester.email}) · {fmtTime(s.durationSec)} · quality {s.qualityScore ?? "—"}</div>
                </div>
                <Status value={s.status} />
                <Link className="btn-ghost !py-1" href={`/designer/tests/${s.testId}/sessions/${s.id}`}>Watch session</Link>
              </div>
              {s.flagReason && <p className="text-sm text-warn"><b>Why flagged:</b> {s.flagReason}</p>}
              {s.rejectReason && <p className="text-sm"><b>Designer said:</b> {s.rejectReason}</p>}
              {s.disputeReason && <p className="text-sm"><b>Tester said:</b> {s.disputeReason}</p>}
              <form action={resolveSession} className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="sessionId" value={s.id} />
                <input className="input flex-1" name="note" placeholder="Note to the tester" aria-label="Note" />
                <button className="btn-primary" name="decision" value="pay">{s.status === "DISPUTED" ? "Side with tester & pay" : "Clear flag"}</button>
                <button className="btn-danger" name="decision" value="reject">{s.status === "DISPUTED" ? "Uphold rejection" : "Reject session"}</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
