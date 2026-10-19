import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireUser("ADMIN");
  if (user.role !== "ADMIN") redirect("/");
  return <Shell user={user} nav="ADMIN">{children}</Shell>;
}
