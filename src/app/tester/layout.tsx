import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/auth";

export default async function TesterLayout({ children }: LayoutProps<"/tester">) {
  const user = await requireUser("TESTER");
  return <Shell user={user} nav="TESTER">{children}</Shell>;
}
