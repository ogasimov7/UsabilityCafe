import Link from "next/link";
import { Logo } from "./ui";
import { NavLinks } from "./nav-links";
import { getUser, homeFor, type Role } from "@/lib/auth";

/** Floating header for the public pages: job board, job details and about. */
export async function PublicHeader() {
  const user = await getUser();
  return (
    <header className="sticky top-0 z-50 px-3 pt-3">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 rounded-[22px] border border-white bg-white/80 py-2 pr-2 pl-4 shadow-[0_8px_24px_-12px_rgba(24,24,27,0.18)] backdrop-blur-md">
        <Logo />
        <NavLinks items={[{ href: "/", label: "Find tests" }, { href: "/about", label: "About" }]} />
        <div className="ml-auto flex items-center gap-1">
          {user ? (
            <>
              {user.role !== "TESTER" && <Link className="btn-brand !px-3 !py-1.5 !text-[13px]" href="/designer/tests/new">+ Post a test</Link>}
              <Link className="btn-primary !px-3 !py-1.5 !text-[13px]" href={homeFor(user.role as Role)}>Dashboard</Link>
            </>
          ) : (
            <>
              <Link className="rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:text-ink" href="/login">Log in</Link>
              <Link className="btn-primary" href="/signup">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
