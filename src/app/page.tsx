import Link from "next/link";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CONCEPT_LABEL, listJobs } from "@/lib/jobs";
import { COUNTRIES, PLATFORM_FEE_RATE, levelFor, money } from "@/lib/rules";
import { JobCard } from "@/components/job-card";
import { PublicHeader } from "@/components/public-header";
import { Logo, Note } from "@/components/ui";
import { Select } from "@/components/select";

const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function JobBoard({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const filters = { q: pick(sp.q), type: pick(sp.type), device: pick(sp.device), country: pick(sp.country), sort: pick(sp.sort) };
  const user = await getUser();
  const jobs = await listJobs(filters, user);
  const totalPay = jobs.reduce((n, j) => n + j.spotsLeft * j.netCents, 0);
  const myOpen = user?.role === "DESIGNER" ? await db.test.count({ where: { project: { ownerId: user.id }, status: "OPEN" } }) : 0;

  // Keep the other filters when switching the concept-type tab.
  const tabHref = (type?: string) => {
    const p = new URLSearchParams(Object.entries({ ...filters, type }).filter((e): e is [string, string] => Boolean(e[1])));
    const qs = p.toString();
    return qs ? `/?${qs}` : "/";
  };
  const level = user?.role === "TESTER" ? levelFor(user.points) : null;

  return (
    <div className="flex flex-col">
      <PublicHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-16">
        <div className="mb-6">
          <h1 className="headline text-[30px] leading-tight md:text-[42px]">Find usability tests</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Designers post concepts and pay per session. Pick a test, try the design while thinking out loud, and get paid when
            it&apos;s accepted.
          </p>
        </div>

        <form className="card mb-4 grid gap-2 !p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]" role="search">
          {filters.type && <input type="hidden" name="type" value={filters.type} />}
          <input className="input !rounded-full" name="q" defaultValue={filters.q} placeholder="Search tests, e.g. checkout, banking, onboarding" aria-label="Search tests" />
          <Select
            className="!rounded-full sm:w-40"
            name="device"
            defaultValue={filters.device ?? ""}
            aria-label="Device"
            options={[{ value: "", label: "Any device" }, { value: "DESKTOP", label: "Desktop" }, { value: "MOBILE", label: "Mobile" }, { value: "TABLET", label: "Tablet" }]}
          />
          <Select
            className="!rounded-full sm:w-44"
            name="country"
            defaultValue={filters.country ?? ""}
            aria-label="Country"
            options={[{ value: "", label: "Any country" }, ...COUNTRIES.map((c) => ({ value: c, label: c }))]}
          />
          <Select
            className="!rounded-full sm:w-40"
            name="sort"
            defaultValue={filters.sort ?? ""}
            aria-label="Sort"
            options={[{ value: "", label: "Newest" }, { value: "pay", label: "Highest pay" }]}
          />
          <button className="btn-primary">Search</button>
        </form>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <section>
            <nav className="mb-3 flex flex-wrap gap-1 text-sm" aria-label="Concept type">
              {[undefined, ...Object.keys(CONCEPT_LABEL)].map((t) => (
                <Link
                  key={t ?? "all"}
                  href={tabHref(t)}
                  className={`rounded-full px-3 py-1.5 font-medium ${filters.type === t ? "bg-ink text-white" : "text-muted hover:bg-white hover:text-ink"}`}
                >
                  {t ? CONCEPT_LABEL[t] : "All tests"}
                </Link>
              ))}
            </nav>
            <div className="card overflow-hidden !p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3 text-sm">
                <span className="font-medium">{jobs.length} open {jobs.length === 1 ? "test" : "tests"}</span>
                {totalPay > 0 && <span className="text-muted">{money(totalPay)} available to testers</span>}
              </div>
              {jobs.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-muted">
                  No tests match these filters.{" "}
                  <Link href="/" className="text-brand underline">Clear filters</Link>
                </div>
              ) : (
                <div className="divide-y divide-line">{jobs.map((j) => <JobCard key={j.id} job={j} />)}</div>
              )}
            </div>
          </section>

          <aside className="space-y-5">
            {!user && (
              <>
                <Note tone="lilac" title="Earn by testing designs">
                  <p className="mt-2 text-sm text-ink/70">Short think-aloud sessions in your browser. Paid to your wallet, cash out from $10.</p>
                  <Link href="/signup?role=tester" className="btn-primary mt-4 w-full">Become a tester</Link>
                </Note>
                <Note tone="peach" title="Need feedback on a design?" pin={false}>
                  <p className="mt-2 text-sm text-ink/70">Post a test like a job, set the pay per session, and get analyzed recordings back.</p>
                  <Link href="/signup?role=designer" className="btn-brand mt-4 w-full">Post a test</Link>
                </Note>
              </>
            )}
            {user?.role === "TESTER" && level && (
              <Note tone="lilac" title={`Hi ${user.name.split(" ")[0]}`}>
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted">Level</span><span>{level.emoji} {level.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Points</span><span>{user.points}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Balance</span><b className="text-ok">{money(user.balanceCents)}</b></div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link href="/tester/sessions" className="btn-ghost !px-2 !text-xs">My sessions</Link>
                  <Link href="/tester/profile" className="btn-ghost !px-2 !text-xs">Profile</Link>
                </div>
                {!user.country && <p className="hint mt-3">Complete your profile to see which tests you qualify for.</p>}
              </Note>
            )}
            {user?.role === "DESIGNER" && (
              <Note tone="peach" title="Your tests">
                <p className="mt-2 text-sm text-ink/70">You have {myOpen} live {myOpen === 1 ? "test" : "tests"} on the board.</p>
                <div className="mt-4 grid gap-2">
                  <Link href="/designer/tests/new" className="btn-brand">+ Post a test</Link>
                  <Link href="/designer" className="btn-ghost">My tests</Link>
                </div>
              </Note>
            )}
            <div className="card text-sm">
              <h2 className="font-semibold">How fees work</h2>
              <p className="mt-2 text-muted">
                Posting is free. The designer sets the pay per session; testers receive it minus a {PLATFORM_FEE_RATE * 100}% service
                fee. Example: a {money(600)} session pays the tester {money(540)}.
              </p>
              <Link href="/about#fees" className="mt-3 inline-block text-brand underline">Learn more</Link>
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-line bg-white/60">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted">
          <Logo />
          <span>
            © 2026 Usability Cafe · <Link href="/about" className="hover:text-ink">About</Link> ·{" "}
            <Link href="/legal/privacy" className="hover:text-ink">Privacy</Link> · <Link href="/legal/terms" className="hover:text-ink">Terms</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
