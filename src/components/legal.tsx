import type { ReactNode } from "react";
import { Logo } from "./ui";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <Logo />
      <h1 className="h1 mt-8">{title}</h1>
      <p className="mt-3 rounded-[14px] border border-peach-line bg-peach p-3 text-sm text-warn">Draft for the closed beta — to be reviewed by a lawyer before launch.</p>
      <div className="card mt-6 space-y-4 !p-6 text-sm leading-relaxed [&_h2]:mt-6 [&_h2]:font-semibold">{children}</div>
    </div>
  );
}
