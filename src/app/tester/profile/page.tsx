import { requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/tester-forms";
import { Callout, PageHeader } from "@/components/ui";

export default async function Profile() {
  const user = await requireUser("TESTER");
  return (
    <>
      <PageHeader title="Your profile" sub="Designers choose who tests their concept. These details decide which tests you see." />
      <Callout title="Why this matters">
        Keep it honest and up to date. If your country, device or job doesn&apos;t match, the designer may reject the session.
      </Callout>
      <ProfileForm user={user} />
      <p className="hint mt-4">
        Recording consent given {user.consentAt?.toLocaleDateString("en-US") ?? "—"} · NDA accepted {user.ndaAt?.toLocaleDateString("en-US") ?? "—"}
        {user.specialist && " · Verified specialist"}
      </p>
    </>
  );
}
