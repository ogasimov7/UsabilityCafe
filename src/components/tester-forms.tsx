"use client";

import { useActionState } from "react";
import { requestPayout, updateProfile } from "@/app/actions/tester";
import { COUNTRIES } from "@/lib/rules";

function Msg({ state }: { state: { error?: string; ok?: string } | undefined }) {
  if (state?.error) return <p role="alert" className="rounded-[14px] bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>;
  if (state?.ok) return <p className="rounded-[14px] bg-ok/10 px-3 py-2 text-sm text-ok">{state.ok}</p>;
  return null;
}

export function PayoutForm({ max }: { max: number }) {
  const [state, action, pending] = useActionState(requestPayout, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="amount">Amount (USD)</label>
          <input className="input" id="amount" name="amount" type="number" step="0.01" min={10} max={max / 100} defaultValue={(max / 100).toFixed(2)} />
        </div>
        <div>
          <label className="label" htmlFor="method">Method</label>
          <select className="input" id="method" name="method">
            <option value="STRIPE">Bank (Stripe Connect)</option>
            <option value="PAYPAL">PayPal</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="destination">Account / PayPal email</label>
          <input className="input" id="destination" name="destination" required />
        </div>
      </div>
      <Msg state={state} />
      <button className="btn-primary" disabled={pending || max < 1000}>Request payout</button>
      <p className="hint">Minimum withdrawal $10. Identity and tax details are collected by the payout provider.</p>
    </form>
  );
}

export function ProfileForm({ user }: { user: { name: string; country: string | null; device: string | null; profession: string | null } }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="card max-w-xl space-y-4">
      <div>
        <label className="label" htmlFor="name">Name</label>
        <input className="input" id="name" name="name" defaultValue={user.name} />
      </div>
      <div>
        <label className="label" htmlFor="country">Country</label>
        <select className="input" id="country" name="country" defaultValue={user.country ?? ""}>
          {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="device">Main device</label>
        <select className="input" id="device" name="device" defaultValue={user.device ?? "DESKTOP"}>
          <option value="DESKTOP">Desktop / laptop</option>
          <option value="MOBILE">Phone</option>
          <option value="TABLET">Tablet</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="profession">Profession</label>
        <input className="input" id="profession" name="profession" defaultValue={user.profession ?? ""} />
      </div>
      <Msg state={state} />
      <button className="btn-primary" disabled={pending}>Save profile</button>
    </form>
  );
}
