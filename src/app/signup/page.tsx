import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/forms";
import { Logo, Note } from "@/components/ui";
import { getUser, homeFor, type Role } from "@/lib/auth";

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const user = await getUser();
  if (user) redirect(homeFor(user.role as Role));
  const { role } = await searchParams;
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
      <div className="flex justify-center"><Logo /></div>
      <Note tone="peach" className="mt-8" panelClassName="!bg-surface !border-line">
        <h1 className="h2">Create your account</h1>
        <p className="mb-5 mt-1 text-sm text-muted">Designers run tests. Testers get paid to try them. Pick your side below.</p>
        <SignupForm initialRole={role === "tester" ? "TESTER" : "DESIGNER"} />
      </Note>
      <p className="mt-5 text-center text-sm text-muted">
        Already have an account? <Link className="font-medium text-brand underline" href="/login">Sign in</Link>
      </p>
    </div>
  );
}
