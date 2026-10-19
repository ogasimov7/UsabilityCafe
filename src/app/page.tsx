import Link from "next/link";
import { Logo, Note, type NoteTone } from "@/components/ui";
import { WaitlistForm } from "@/components/forms";
import { getUser, homeFor, type Role } from "@/lib/auth";
import { LEVELS, PLANS, money } from "@/lib/rules";

const steps: { who: string; title: string; text: string; tone: NoteTone }[] = [
  { who: "You, the designer", title: "Post your concept", text: "Paste a Figma link or upload images, a PDF or a video. Write 1–3 tasks like “Order a coffee for pickup”.", tone: "peach" },
  { who: "Real people", title: "Testers try it and think aloud", text: "Matched testers open your concept in the browser and say what they think while their screen, camera and voice are recorded.", tone: "sky" },
  { who: "Usability Cafe", title: "We analyze every session", text: "Each recording is transcribed and turned into findings: what confused people, how serious it is, and the exact moment it happened.", tone: "lilac" },
  { who: "You", title: "Read the report, fix the design", text: "One report per test with task success, top issues by severity and clickable quotes. Accept sessions and testers get paid.", tone: "peach" },
];

const faqs = [
  ["What is a think-aloud session?", "A short recording (usually 5–10 minutes) of a person using your design while saying out loud what they see, expect and feel. It shows you why people get stuck, not just where."],
  ["How fast do I get results?", "Most tests fill within 24–48 hours. Each session is analyzed automatically a few minutes after it's uploaded, so the report grows as sessions arrive."],
  ["Do testers need to install anything?", "No. Recording runs in a normal browser tab. Testers allow screen, camera and microphone access, and can delete their recording later."],
  ["What if a session is bad?", "You can reject it with a reason and you won't be charged for it. If you don't review a session within 72 hours, it's accepted automatically."],
];

function Arrow() {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="size-3 transition-transform group-hover:translate-x-0.5">
      <path d="M2 6h8M6.5 2.5 10 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Dashed curve linking two zig-zag notes, like string between pinned cards. */
function Connector({ flip }: { flip: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 400 80" preserveAspectRatio="none" className={`-my-6 hidden h-20 w-full md:block ${flip ? "-scale-x-100" : ""}`}>
      <path d="M120 0 C 160 70, 260 10, 290 80" fill="none" stroke="#b9b9c0" strokeWidth="1.5" strokeDasharray="6 7" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Eyebrow({ children }: { children: string }) {
  return <p className="font-hand text-3xl text-brand">{children}</p>;
}

export default async function Home() {
  const user = await getUser();
  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-50 px-3 pt-3">
        <div className="mx-auto flex max-w-6xl items-center rounded-full border border-white bg-white/80 py-2 pr-2 pl-4 shadow-[0_8px_24px_-12px_rgba(24,24,27,0.18)] backdrop-blur-md">
          <div className="flex flex-1"><Logo /></div>
          <nav className="hidden gap-1 lg:flex">
            {[["How it works", "#how"], ["Who it's for", "#who"], ["Pricing", "#pricing"], ["FAQ", "#faq"]].map(([label, href]) => (
              <a key={href} href={href} className="rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink">{label}</a>
            ))}
          </nav>
          <div className="flex flex-1 items-center justify-end gap-1">
            {user ? (
              <Link className="btn-primary" href={homeFor(user.role as Role)}>Open dashboard</Link>
            ) : (
              <>
                <Link className="rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:text-ink" href="/login">Log in</Link>
                <Link className="btn-primary" href="/signup">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-10 text-center md:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-white bg-white/70 px-3 py-1 text-xs font-medium text-muted shadow-sm">
          <span className="size-1.5 rounded-full bg-accent" /> Concept testing in 24–48 hours
        </span>
        <h1 className="headline mx-auto mt-6 max-w-4xl text-[34px] leading-[1.08] md:text-[60px] md:leading-[1.05]">
          See how real people use your design — for the price of a coffee
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          Upload an early concept. Real people try it while thinking out loud. You get a clear report of what
          confused them and why — no hours of raw video to watch.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/signup?role=designer" className="group btn-brand !px-6 !py-3 !text-base">
            I&apos;m a designer — run a test <Arrow />
          </Link>
          <Link href="/signup?role=tester" className="btn-ghost !px-6 !py-3 !text-base">I want to test & earn</Link>
        </div>
        <p className="mt-3 text-sm text-muted">First 5 sessions free · no card needed</p>
      </section>

      {/* Sample report */}
      <section className="mx-auto w-full max-w-3xl px-4 pb-16">
        <Note tone="sky" className="rotate-[-1.2deg]" panelClassName="!bg-surface !border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold">What you get: a report like this</span>
            <span className="rounded-full bg-sky px-2.5 py-0.5 text-xs text-info">Checkout redesign · 5 sessions</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[["60%", "finished the task"], ["3", "serious problems"], ["2:41", "average time"]].map(([v, l]) => (
              <div key={l} className="rounded-[14px] bg-surface-2 p-3">
                <div className="font-display text-xl font-semibold md:text-2xl">{v}</div>
                <div className="text-xs text-muted">{l}</div>
              </div>
            ))}
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              ["Critical", "bg-bad/10 text-bad", "“I can't find where to apply the promo code.”", "2:14"],
              ["Major", "bg-warn/10 text-warn", "Shipping cost appears too late — trust drops.", "3:02"],
              ["Works well", "bg-ok/10 text-ok", "“Paying with one tap is really easy.”", "4:40"],
            ].map(([sev, cls, text, t]) => (
              <li key={t} className="flex items-start gap-3 rounded-[14px] border border-line p-3 text-left">
                <span className={`badge shrink-0 ${cls}`}>{sev}</span>
                <span className="flex-1">{text}</span>
                <span className="shrink-0 text-xs text-muted">▶ {t}</span>
              </li>
            ))}
          </ul>
        </Note>
      </section>

      {/* How it works: zig-zag pinned notes */}
      <section id="how" className="mx-auto w-full max-w-5xl scroll-mt-24 px-4 py-16">
        <div className="text-center">
          <Eyebrow>how it works</Eyebrow>
          <h2 className="headline mt-1 text-[28px] leading-tight md:text-[44px]">From concept to findings in 4 steps</h2>
        </div>
        <ol className="mt-14 space-y-10 md:space-y-0">
          {steps.map((s, i) => (
            <li key={s.title}>
              {i > 0 && <Connector flip={i % 2 === 0} />}
              <div className={`flex ${i % 2 ? "md:justify-end" : "md:justify-start"}`}>
                <Note
                  tone={s.tone}
                  n={`0${i + 1}`}
                  title={s.title}
                  className={`w-full md:w-[46%] ${i % 2 ? "md:rotate-[2.5deg]" : "md:rotate-[-2.5deg]"}`}
                >
                  <p className="mt-2 text-sm leading-6 text-ink/70">{s.text}</p>
                  <p className="mt-3 text-xs font-medium uppercase tracking-[0.08em] text-ink/45">{s.who}</p>
                </Note>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Who it's for */}
      <section id="who" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-16">
        <div className="text-center">
          <Eyebrow>who it&apos;s for</Eyebrow>
          <h2 className="headline mt-1 text-[28px] leading-tight md:text-[44px]">Two sides, one café</h2>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <Note tone="peach" title="Designers & product teams">
            <p className="mt-2 text-sm text-ink/70">Check an idea before you build it.</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>✓ Test Figma prototypes, images, PDFs or videos</li>
              <li>✓ Choose testers by country, age, device or job</li>
              <li>✓ Get findings ranked by how serious they are</li>
              <li>✓ Pay only for sessions you accept</li>
            </ul>
            <Link href="/signup?role=designer" className="group btn-primary mt-6">Run a test — 5 free <Arrow /></Link>
          </Note>
          <Note tone="lilac" title="Testers">
            <p className="mt-2 text-sm text-ink/70">Get paid to try new apps and say what you think.</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>✓ {money(500)} per accepted session, about 10 minutes each</li>
              <li>✓ Everything happens in your browser</li>
              <li>✓ Level up for earlier access and up to 20% more pay</li>
              <li>✓ Cash out from {money(1000)}</li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <span key={l.key} className="rounded-full border border-lilac-line bg-white px-2.5 py-1 text-xs">
                  {l.emoji} {l.name} · {l.min}+ pts{l.bonus ? ` · +${l.bonus * 100}%` : ""}
                </span>
              ))}
            </div>
            <Link href="/signup?role=tester" className="group btn-primary mt-6">Become a tester <Arrow /></Link>
          </Note>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-16">
        <div className="text-center">
          <Eyebrow>pricing</Eyebrow>
          <h2 className="headline mt-1 text-[28px] leading-tight md:text-[44px]">Simple, per-session pricing</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">One session = one person testing your concept. Pay as you go or save with a plan.</p>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((k) => {
            const p = PLANS[k];
            const featured = k === "STARTER";
            return (
              <Note key={k} tone={featured ? "peach" : "sky"} pin={featured} panelClassName={`flex flex-col ${featured ? "" : "!bg-surface !border-line"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{p.name}</span>
                  {featured && <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-brand">Most popular</span>}
                </div>
                <div className="mt-4 font-display text-3xl font-semibold tracking-[-1px]">
                  {p.monthlyCents ? money(p.monthlyCents) : money(p.sessionCents)}
                  <span className="ml-1 font-sans text-sm font-normal text-muted">{p.monthlyCents ? "/ month" : "/ session"}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-2 text-sm text-ink/75">
                  {p.included > 0 && <li>✓ {p.included} sessions included</li>}
                  <li>✓ {p.monthlyCents ? `Extra sessions ${money(p.sessionCents)}` : "No commitment"}</li>
                  <li>✓ Analyzed report with every test</li>
                  {k === "PRO" && <li>✓ Choose testers by profession</li>}
                </ul>
                <Link href="/signup?role=designer" className={`mt-6 ${featured ? "btn-brand" : "btn-ghost"}`}>Get started</Link>
              </Note>
            );
          })}
        </div>
        <p className="mt-6 text-center text-sm text-muted">Need doctors, developers or other specialists? Specialist sessions from $25.</p>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-24 px-4 py-16">
        <div className="text-center">
          <Eyebrow>questions</Eyebrow>
          <h2 className="headline mt-1 text-[28px] leading-tight md:text-[44px]">Good to know</h2>
        </div>
        <div className="mt-10 space-y-3">
          {faqs.map(([q, a]) => (
            <details key={q} className="card group !p-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium">
                {q}
                <span className="text-xl text-muted transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-6 text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Waitlist */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-8 pb-20">
        <Note tone="mint">
          <h3 className="font-display text-xl font-semibold tracking-[-0.4px]">Join the waitlist</h3>
          <p className="mb-5 mt-2 text-sm text-ink/70">Public launch July 2027. Early testers get a sign-up bonus.</p>
          <WaitlistForm />
        </Note>
      </section>

      <footer className="border-t border-line bg-white/60">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted">
          <Logo />
          <span>
            © 2026 Usability Cafe · <Link href="/legal/privacy" className="hover:text-ink">Privacy</Link> ·{" "}
            <Link href="/legal/terms" className="hover:text-ink">Terms</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
