import { db } from "@/lib/db";
import { toggleSpecialist, toggleSuspend } from "@/app/actions/admin";
import { Badge, PageHeader } from "@/components/ui";
import { levelFor, money } from "@/lib/rules";

export default async function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const users = await db.user.findMany({
    where: query ? { OR: [{ email: { contains: query, mode: "insensitive" } }, { name: { contains: query, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <>
      <PageHeader title="Users" sub="Search accounts, verify specialist testers, and suspend anyone abusing the platform." />
      <form className="mb-4"><input className="input max-w-sm !rounded-full" name="q" defaultValue={query} placeholder="Search name or email" aria-label="Search users" /></form>
      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted"><tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Details</th><th className="p-3" /></tr></thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id} className={u.suspended ? "opacity-60" : ""}>
                <td className="p-3">{u.name}<div className="text-xs text-muted">{u.email}</div></td>
                <td className="p-3"><Badge tone={u.role === "ADMIN" ? "brand" : u.role === "DESIGNER" ? "info" : "ok"}>{u.role.toLowerCase()}</Badge></td>
                <td className="p-3 text-muted">
                  {u.role === "TESTER" ? `${levelFor(u.points).name} · ${u.points} pts · ${money(u.balanceCents)} · ${u.country ?? ""}${u.specialist ? " · specialist" : ""}` : ""}
                </td>
                <td className="p-3">
                  {u.role !== "ADMIN" && (
                    <div className="flex justify-end gap-2">
                      {u.role === "TESTER" && (
                        <form action={toggleSpecialist}><input type="hidden" name="userId" value={u.id} /><button className="btn-ghost !py-1">{u.specialist ? "Unverify" : "Verify specialist"}</button></form>
                      )}
                      <form action={toggleSuspend}><input type="hidden" name="userId" value={u.id} /><button className={u.suspended ? "btn-ghost !py-1" : "btn-danger !py-1"}>{u.suspended ? "Restore" : "Suspend"}</button></form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
