import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms";
import { Logo, Note } from "@/components/ui";
import { getUser, homeFor, type Role } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect(homeFor(user.role as Role));
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <div className="flex justify-center"><Logo /></div>
      <Note tone="sky" className="mt-8" panelClassName="!bg-surface !border-line">
        <h1 className="h2">Welcome back</h1>
        <p className="mb-5 mt-1 text-sm text-muted">Log in to see your tests, sessions and reports.</p>
        <LoginForm />
      </Note>
      <p className="mt-5 text-center text-sm text-muted">
        New here? <Link className="font-medium text-brand underline" href="/signup">Create an account</Link>
      </p>
    </div>
  );
}
