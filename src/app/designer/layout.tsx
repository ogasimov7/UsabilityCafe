import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/auth";

export default async function DesignerLayout({ children }: LayoutProps<"/designer">) {
  const user = await requireUser("DESIGNER");
  return <Shell user={user} nav="DESIGNER">{children}</Shell>;
}
