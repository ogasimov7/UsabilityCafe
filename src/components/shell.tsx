import Link from "next/link";
import type { ReactNode } from "react";
import type { User } from "@prisma/client";
import { Logo } from "./ui";
import { NavLinks } from "./nav-links";
import { logout } from "@/app/actions/auth";
import { levelFor, money } from "@/lib/rules";

const NAV: Record<string, { href: string; label: string }[]> = {
  DESIGNER: [
    { href: "/designer", label: "My tests" },
    { href: "/", label: "Job board" },
    { href: "/designer/payments", label: "Payments" },
  ],
  TESTER: [
    { href: "/", label: "Find tests" },
    { href: "/tester", label: "Matched for you" },
    { href: "/tester/sessions", label: "My sessions" },
    { href: "/tester/wallet", label: "Wallet" },
    { href: "/tester/profile", label: "Profile" },
  ],
  ADMIN: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/review", label: "Review queue" },
    { href: "/admin/tests", label: "Tests" },
    { href: "/admin/payouts", label: "Payouts" },
    { href: "/admin/users", label: "Users" },
  ],
};

export function Shell({ user, nav, children }: { user: User; nav: keyof typeof NAV; children: ReactNode }) {
  const level = levelFor(user.points);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-20 px-3 pt-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 rounded-[22px] border border-white bg-white/80 px-4 py-2.5 shadow-[0_8px_24px_-12px_rgba(24,24,27,0.18)] backdrop-blur-md">
          <Logo />
          <NavLinks items={NAV[nav]} />
          <div className="ml-auto flex items-center gap-3 text-sm">
            {user.role === "TESTER" && (
              <span className="hidden rounded-full bg-surface-2 px-3 py-1 text-muted md:inline" title="Level · points · wallet balance">
                {level.emoji} {level.name} · {user.points} pts · <b className="text-ok">{money(user.balanceCents)}</b>
              </span>
            )}
            {user.role === "DESIGNER" && (
              <Link href="/designer/tests/new" className="btn-brand hidden !px-3 !py-1.5 !text-[13px] md:inline-flex">+ Post a test</Link>
            )}
            <span className="font-medium">{user.name}</span>
            <form action={logout}>
              <button className="btn-ghost !px-3 !py-1.5 !text-[13px]">Log out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
