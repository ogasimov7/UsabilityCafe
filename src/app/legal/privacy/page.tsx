import { LegalPage } from "@/components/legal";

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy">
      <p>Usability Cafe records testers&apos; screen, camera and voice only during a test the tester chooses to start, and only after explicit consent.</p>
      <h2>What we collect</h2>
      <p>Account details, screener profile (birth year, country, device, profession), session recordings, transcripts, notes and answers, and payment and payout records.</p>
      <h2>How recordings are used</h2>
      <p>Recordings are shared only with the designer who ran the test and with our operations team for quality review. Playback is watermarked and downloads are disabled.</p>
      <h2>Your rights (GDPR / CCPA)</h2>
      <p>You can access, correct or delete your data. Testers can delete any of their recordings from “My sessions” at any time.</p>
      <h2>Retention</h2>
      <p>Raw video is deleted after 12 months unless the designer extends retention.</p>
    </LegalPage>
  );
}
