import Link from "next/link";
import type { ReactNode } from "react";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-[18px] leading-7 text-ink">
      <svg aria-hidden viewBox="0 0 32 32" className="size-8 drop-shadow-[0_4px_8px_rgba(232,71,14,0.45)]">
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff7a3d" />
            <stop offset="1" stopColor="#e8430c" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#logo-g)" />
        <path d="M9 12h11v5a5.5 5.5 0 0 1-11 0v-5Z" fill="#fff" />
        <path d="M20 13.5h1.5a2.5 2.5 0 0 1 0 5H20" fill="none" stroke="#fff" strokeWidth="1.8" />
        <path d="M8 24h14" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="whitespace-nowrap font-display font-semibold tracking-[-0.6px]">Usability Cafe</span>
    </Link>
  );
}

export type NoteTone = "peach" | "sky" | "lilac" | "mint";

const pinColor: Record<NoteTone, string> = {
  peach: "from-[#ff8a5c] to-[#e8430c] shadow-[0_6px_10px_-2px_rgba(232,67,12,0.6)]",
  sky: "from-[#6b8cff] to-[#2f55e8] shadow-[0_6px_10px_-2px_rgba(47,85,232,0.6)]",
  lilac: "from-[#a68bff] to-[#6a3ff0] shadow-[0_6px_10px_-2px_rgba(106,63,240,0.6)]",
  mint: "from-[#5fd99a] to-[#16a35a] shadow-[0_6px_10px_-2px_rgba(22,163,90,0.6)]",
};

const panelTone: Record<NoteTone, string> = {
  peach: "bg-peach border-peach-line",
  sky: "bg-sky border-sky-line",
  lilac: "bg-lilac border-lilac-line",
  mint: "bg-mint border-mint-line",
};

const numTone: Record<NoteTone, string> = {
  peach: "text-[#e8430c]",
  sky: "text-[#2f55e8]",
  lilac: "text-[#6a3ff0]",
  mint: "text-[#16a35a]",
};

/** Glossy push-pin that sits on top of a note. */
export function Pin({ tone = "peach" }: { tone?: NoteTone }) {
  return (
    <span aria-hidden className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
      <span className={`block size-6 rounded-full bg-gradient-to-br ${pinColor[tone]}`}>
        <span className="absolute top-1 left-1.5 size-2 rounded-full bg-white/60 blur-[1px]" />
      </span>
    </span>
  );
}

/** Pinned note card: white frame, pastel inner panel, optional handwritten number. */
export function Note({
  tone = "peach",
  n,
  title,
  children,
  pin = true,
  className = "",
  panelClassName = "",
}: {
  tone?: NoteTone;
  n?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  pin?: boolean;
  className?: string;
  panelClassName?: string;
}) {
  return (
    <div className={`note ${className}`}>
      {pin && <Pin tone={tone} />}
      <div className={`note-panel h-full ${panelTone[tone]} ${panelClassName}`}>
        {n !== undefined && <div className={`font-hand text-4xl leading-none ${numTone[tone]}`}>{n}</div>}
        {title && <h3 className={`font-display text-lg font-semibold tracking-[-0.4px] ${n !== undefined ? "mt-3" : ""}`}>{title}</h3>}
        {children}
      </div>
    </div>
  );
}

/** Plain-language guidance box. */
export function Callout({ tone = "sky", title, children }: { tone?: NoteTone; title?: ReactNode; children: ReactNode }) {
  return (
    <div className={`mb-6 rounded-[18px] border p-4 text-sm ${panelTone[tone]}`}>
      {title && <div className="mb-0.5 font-semibold">{title}</div>}
      <div className="text-ink/75">{children}</div>
    </div>
  );
}

export type Step = { title: string; text: string; done?: boolean; href?: string; cta?: string };

/** Numbered "what to do next" checklist made of small notes. The first unfinished step is highlighted. */
export function Steps({ steps, title = "How it works" }: { steps: Step[]; title?: string }) {
  const current = steps.findIndex((s) => !s.done);
  const tones: NoteTone[] = ["peach", "sky", "lilac", "mint", "peach"];
  return (
    <section className="mb-10">
      <h2 className="h2 mb-5">{title}</h2>
      <ol className={`grid gap-5 sm:grid-cols-2 ${steps.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {steps.map((s, i) => (
          <li key={s.title}>
            <Note
              tone={tones[i % tones.length]}
              pin={i === current}
              className={`h-full ${i === current ? "" : "shadow-[0_1px_2px_rgba(24,24,27,0.05)]"} ${s.done ? "opacity-70" : ""}`}
              panelClassName={i === current ? "" : "!bg-surface !border-line"}
            >
              <div className="flex items-center justify-between">
                <span className={`font-hand text-3xl leading-none ${i === current ? numTone[tones[i % tones.length]] : "text-muted"}`}>0{i + 1}</span>
                {s.done ? <Badge tone="ok">✓ Done</Badge> : i === current ? <Badge tone="brand">Next step</Badge> : null}
              </div>
              <div className="mt-3 font-semibold">{s.title}</div>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
              {i === current && s.href && (
                <Link href={s.href} className="btn-primary mt-4">{s.cta ?? "Start"} →</Link>
              )}
            </Note>
          </li>
        ))}
      </ol>
    </section>
  );
}

const tones: Record<string, string> = {
  neutral: "bg-surface-2 text-muted",
  ok: "bg-ok/15 text-ok",
  warn: "bg-warn/15 text-warn",
  bad: "bg-bad/15 text-bad",
  info: "bg-info/15 text-info",
  brand: "bg-[#ffe7da] text-brand",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones | string; children: ReactNode }) {
  return <span className={`badge ${tones[tone] ?? tones.neutral}`}>{children}</span>;
}

const statusTone: Record<string, string> = {
  DRAFT: "neutral",
  PENDING_PAYMENT: "warn",
  OPEN: "ok",
  PAUSED: "warn",
  COMPLETED: "info",
  REJECTED: "bad",
  IN_PROGRESS: "info",
  SUBMITTED: "info",
  ANALYZING: "info",
  READY: "brand",
  ACCEPTED: "ok",
  DISPUTED: "warn",
  ABANDONED: "neutral",
  REQUESTED: "warn",
  APPROVED: "info",
  PAID: "ok",
  DECLINED: "bad",
  PENDING: "warn",
};

const statusLabel: Record<string, [string, string]> = {
  DRAFT: ["Draft", "Not published yet — pay to send it to testers"],
  PENDING_PAYMENT: ["Awaiting payment", "Finish checkout to publish the test"],
  OPEN: ["Live", "Testers can take this test now"],
  PAUSED: ["Paused", "Hidden from testers until you resume it"],
  COMPLETED: ["Completed", "All sessions are in"],
  REJECTED: ["Rejected", "Not accepted"],
  IN_PROGRESS: ["In progress", "The tester is recording"],
  SUBMITTED: ["Submitted", "Uploaded, analysis starts shortly"],
  ANALYZING: ["Analyzing", "AI is transcribing and finding issues"],
  READY: ["Needs review", "Watch it and accept or reject"],
  ACCEPTED: ["Accepted", "Approved and paid"],
  DISPUTED: ["Disputed", "Support is reviewing the rejection"],
  ABANDONED: ["Abandoned", "The tester left before finishing"],
  REQUESTED: ["Requested", "Waiting for approval"],
  APPROVED: ["Approved", "Will be paid out soon"],
  PAID: ["Paid", "Money sent"],
  DECLINED: ["Declined", "Not approved"],
  PENDING: ["Pending", "Waiting"],
};

export function Status({ value }: { value: string }) {
  const [label, help] = statusLabel[value] ?? [value.replace(/_/g, " ").toLowerCase(), ""];
  return (
    <span title={help}>
      <Badge tone={statusTone[value] ?? "neutral"}>
        <span className="mr-1.5 size-1.5 rounded-full bg-current" />
        {label}
      </Badge>
    </span>
  );
}

export const sevTone: Record<string, string> = { critical: "bad", major: "warn", minor: "info", positive: "ok" };

export const SEVERITY: Record<string, { label: string; help: string }> = {
  critical: { label: "Critical", help: "Stopped people from finishing a task" },
  major: { label: "Major", help: "Slowed people down or caused frustration" },
  minor: { label: "Minor", help: "Small annoyance, easy to fix" },
  positive: { label: "Works well", help: "Something people liked" },
};

export function Severity({ value }: { value: string }) {
  return (
    <span title={SEVERITY[value]?.help}>
      <Badge tone={sevTone[value]}>{SEVERITY[value]?.label ?? value}</Badge>
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold tracking-[-0.6px]">{value}</div>
      {hint && <div className="hint mt-1">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-[22px] border-2 border-dashed border-[#d6d6dc] bg-white/50 p-8 text-center text-sm text-muted">{children}</div>;
}

export function PageHeader({ title, sub, actions, back }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back && (
          <Link href={back.href} className="no-print mb-3 inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-sm text-muted shadow-sm hover:text-ink">
            ← {back.label}
          </Link>
        )}
        <h1 className="h1">{title}</h1>
        {sub && <p className="mt-1 text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function fmtTime(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
