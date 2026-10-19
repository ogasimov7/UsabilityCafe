// Business rules from the project plan: pricing, points and levels.

export const PLANS = {
  PAYG: { name: "Pay as you go", monthlyCents: 0, included: 0, sessionCents: 1200 },
  STARTER: { name: "Starter", monthlyCents: 4900, included: 5, sessionCents: 1000 },
  PRO: { name: "Pro", monthlyCents: 14900, included: 20, sessionCents: 800 },
} as const;
export type PlanKey = keyof typeof PLANS;

export const BASE_FEE_CENTS = 500;
export const SPECIALIST_PRICE_CENTS = 2500;
export const SPECIALIST_FEE_CENTS = 1500;
export const MIN_PAYOUT_CENTS = 1000;
export const AUTO_ACCEPT_HOURS = 72;
export const FREE_CREDITS_FOR_NEW_DESIGNERS = 5;
export const FREE_CREDIT_DESIGNER_LIMIT = 100;

export const POINTS_PER_APPROVED = 10;
export const REJECTION_PENALTY = 5;

export function ratingBonus(rating: number | null | undefined) {
  if (!rating) return 0;
  if (rating >= 5) return 5;
  if (rating === 4) return 3;
  return 0;
}

export const LEVELS = [
  { key: "ESPRESSO", name: "Espresso", min: 0, bonus: 0, emoji: "☕" },
  { key: "LATTE", name: "Latte", min: 100, bonus: 0.1, emoji: "🥛" },
  { key: "CAPPUCCINO", name: "Cappuccino", min: 500, bonus: 0.15, emoji: "🫖" },
  { key: "BARISTA", name: "Barista", min: 1500, bonus: 0.2, emoji: "🏆" },
] as const;

export function levelFor(points: number) {
  let current: (typeof LEVELS)[number] = LEVELS[0];
  for (const l of LEVELS) if (points >= l.min) current = l;
  const idx = LEVELS.findIndex((l) => l.key === current.key);
  const next = LEVELS[idx + 1] ?? null;
  return { ...current, index: idx, next };
}

// Higher levels see new tests first: hours a level waits after a test opens.
export const EARLY_ACCESS_DELAY_HOURS = [6, 3, 1, 0];
// Specialist tests need Cappuccino or a verified specialist profile.
export const SPECIALIST_MIN_LEVEL = 2;

export function priceForSession(plan: PlanKey, specialist: boolean) {
  if (specialist) return SPECIALIST_PRICE_CENTS;
  return PLANS[plan].sessionCents;
}

export function money(cents: number) {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

export const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Germany", "France", "Netherlands",
  "Spain", "Italy", "Poland", "Azerbaijan", "Turkey", "India", "Australia", "Brazil", "Other",
];
export const DEVICES = ["DESKTOP", "MOBILE", "TABLET"] as const;

export function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3600_000);
}

export function daysAgo(days: number) {
  return hoursAgo(days * 24);
}
