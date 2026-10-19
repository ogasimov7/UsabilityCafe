import { LegalPage } from "@/components/legal";

export default function Terms() {
  return (
    <LegalPage title="Terms of service">
      <h2>Designers</h2>
      <p>You own the concepts you upload and receive a licence to use session recordings for product research. Unreviewed sessions are accepted automatically 72 hours after submission.</p>
      <h2>Testers</h2>
      <p>Testers must be 18 or older and act as independent contractors. Fees are paid to your wallet once a session is accepted; the minimum withdrawal is $10. Tax forms are collected by the payout provider.</p>
      <h2>Confidentiality (tester NDA)</h2>
      <p>Concepts are confidential. Sharing, screenshotting or copying them leads to account suspension and forfeiture of unpaid earnings.</p>
      <h2>Quality</h2>
      <p>Sessions must follow the tasks with continuous think-aloud. Rejected sessions cost points; testers may dispute a rejection within 72 hours.</p>
    </LegalPage>
  );
}
