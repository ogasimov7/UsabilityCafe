# Usability Cafe

A two-sided marketplace for concept testing: designers post concepts, testers record think-aloud sessions in the browser, and designers get the results already analyzed.

## Getting started

```bash
npm install
npm run setup      # creates the SQLite database and seeds demo data
npm run dev        # http://localhost:3000
```

Demo accounts (password `password123`):

| Role     | Email                    |
|----------|--------------------------|
| Designer | designer@usability.cafe  |
| Tester   | tester@usability.cafe    |
| Admin    | admin@usability.cafe     |

## What's in the MVP

- **Designers**: sign-up (5 free sessions for the first 100 designers and for students), projects, a test builder (prototype link / images / PDF / video, tasks, follow-up questions, attention check, targeting by age, country, device, profession, specialists), checkout, a results dashboard, a session player (screen + camera, transcript, findings timeline, highlight clips), accept/reject with rating, an aggregated report with PDF export (print), and plans (Pay as you go $12, Starter $49, Pro $149).
- **Testers**: sign-up with screener profile, 18+ check, recording consent and NDA, a matched test feed with early access by level, in-browser recording of screen, camera and voice with chunked, resumable upload, live transcription (Web Speech API), in-session notes, wallet, payouts (min $10), disputes, deleting recordings.
- **Analysis**: per-session findings (theme, severity, timestamp, quote), sentiment, task success and time on task, quality score; aggregated report per test. Uses an LLM through Vercel AI Gateway when `AI_GATEWAY_API_KEY` is set, otherwise a rule-based analyzer.
- **Rewards**: $5 per accepted session, 10 points + up to 5 rating bonus, −5 for a rejection, levels Espresso / Latte (100) / Cappuccino (500) / Barista (1,500) with 10–20% fee bonuses. Unreviewed sessions are accepted automatically after 72h (`/api/cron/auto-accept`, hourly in `vercel.json`).
- **Admin**: live KPIs from the plan, review queue (flagged sessions and disputes), test moderation, payout approval, user management and specialist verification.

## Production notes

- **Database**: switch `provider` in `prisma/schema.prisma` to `postgresql` and set `DATABASE_URL`.
- **Video storage**: `src/lib/storage.ts` writes to local disk (`./storage`). Swap for object storage plus a managed video service (e.g. Mux) before deploying to serverless.
- **Payments**: set `STRIPE_SECRET_KEY` for real Stripe Checkout. Without it, `/checkout/[id]` simulates payments. Tester payouts are approved in the admin panel; wiring them to Stripe Connect or PayPal Payouts is the next step.
- **Transcription**: done in the browser (Chrome, Edge, Safari). For Firefox and higher accuracy, add server-side speech-to-text.
