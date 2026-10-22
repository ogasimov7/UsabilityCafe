"use client";

import { useActionState, useState } from "react";
import { login, signup, joinWaitlist, type FormState } from "@/app/actions/auth";
import { COUNTRIES } from "@/lib/rules";

function Msg({ state }: { state: FormState }) {
  if (state?.error) return <p role="alert" className="rounded-[14px] bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>;
  if (state?.ok) return <p className="rounded-[14px] bg-ok/10 px-3 py-2 text-sm text-ok">{state.ok}</p>;
  return null;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <Msg state={state} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function SignupForm({ initialRole }: { initialRole: "DESIGNER" | "TESTER" }) {
  const [role, setRole] = useState(initialRole);
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-full bg-surface-2 p-1 text-sm">
        {(["DESIGNER", "TESTER"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`rounded-full py-2 font-medium ${role === r ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            {r === "DESIGNER" ? "I'm a designer" : "I'm a tester"}
          </button>
        ))}
      </div>
      <input type="hidden" name="role" value={role} />
      <div>
        <label className="label" htmlFor="name">Full name</label>
        <input className="input" id="name" name="name" autoComplete="name" required />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>

      {role === "TESTER" && (
        <fieldset className="space-y-4 rounded-2xl border border-line p-4">
          <legend className="px-1 text-sm font-medium">Screener profile</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="birthYear">Birth year</label>
              <input className="input" id="birthYear" name="birthYear" type="number" min={1900} max={new Date().getFullYear() - 18} required />
              <p className="hint mt-1">You must be 18 or older.</p>
            </div>
            <div>
              <label className="label" htmlFor="country">Country</label>
              <select className="input" id="country" name="country" required defaultValue="">
                <option value="" disabled>Choose…</option>
                {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="device">Main device</label>
              <select className="input" id="device" name="device" defaultValue="DESKTOP">
                <option value="DESKTOP">Desktop / laptop</option>
                <option value="MOBILE">Phone</option>
                <option value="TABLET">Tablet</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="profession">Profession</label>
              <input className="input" id="profession" name="profession" placeholder="e.g. Nurse, Developer" required />
            </div>
          </div>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" name="consent" required className="mt-1" />
            <span>I consent to recording my screen, camera and voice during tests. I can delete my recordings at any time.</span>
          </label>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" name="nda" required className="mt-1" />
            <span>I accept the tester NDA: I won&apos;t share, screenshot or copy designers&apos; unreleased concepts.</span>
          </label>
        </fieldset>
      )}
      <Msg state={state} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
    </form>
  );
}

export function WaitlistForm() {
  const [state, action, pending] = useActionState(joinWaitlist, undefined);
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      <input className="input sm:max-w-xs" name="email" type="email" placeholder="you@example.com" required aria-label="Email" />
      <select className="input sm:w-40" name="role" aria-label="I am a">
        <option value="TESTER">I want to test</option>
        <option value="DESIGNER">I&apos;m a designer</option>
      </select>
      <button className="btn-brand" disabled={pending}>Join waitlist</button>
      <div className="sm:basis-full"><Msg state={state} /></div>
    </form>
  );
}
