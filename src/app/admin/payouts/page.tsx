import { db } from "@/lib/db";
import { decidePayout } from "@/app/actions/admin";
import { Empty, PageHeader, Status } from "@/components/ui";
import { money } from "@/lib/rules";

export default async function AdminPayouts() {
  const payouts = await db.payout.findMany({ orderBy: { createdAt: "desc" }, include: { user: true } });
  return (
    <>
      <PageHeader title="Payouts" sub="Tester withdrawal requests. 1) Approve or decline. 2) Send the money via Stripe Connect or PayPal. 3) Mark as paid." />
      {payouts.length === 0 ? <Empty>No payout requests right now.</Empty> : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted"><tr><th className="p-3">Tester</th><th className="p-3">Amount</th><th className="p-3">Destination</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y divide-line">
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td className="p-3">{p.user.name}<div className="text-xs text-muted">{p.user.email}</div></td>
                  <td className="p-3">{money(p.amountCents)}</td>
                  <td className="p-3">{p.method.toLowerCase()} · {p.destination}</td>
                  <td className="p-3"><Status value={p.status} /></td>
                  <td className="p-3">
                    <form action={decidePayout} className="flex justify-end gap-2">
                      <input type="hidden" name="payoutId" value={p.id} />
                      {p.status === "REQUESTED" && <><button className="btn-primary !py-1" name="decision" value="approve">Approve</button><button className="btn-ghost !py-1" name="decision" value="decline">Decline</button></>}
                      {p.status === "APPROVED" && <button className="btn-primary !py-1" name="decision" value="paid">Mark paid</button>}
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
