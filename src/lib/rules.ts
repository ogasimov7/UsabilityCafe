// Business rules: marketplace fee, rewards, points and levels.

// Designers set the reward per session; Usability Cafe keeps 10% of what testers earn (like Upwork's service fee).
export const PLATFORM_FEE_RATE = 0.1;
export const MIN_REWARD_CENTS = 200;
export const MAX_REWARD_CENTS = 50000;
export const DEFAULT_REWARD_CENTS = 500;

export function platformFee(rewardCents: number) {
  return Math.round(rewardCents * PLATFORM_FEE_RATE);
}

/** What a tester receives for an accepted session after the platform fee. */
export function testerNet(rewardCents: number) {
  return rewardCents - platformFee(rewardCents);
}

export const MIN_PAYOUT_CENTS = 1000;
export const AUTO_ACCEPT_HOURS = 72;

export const POINTS_PER_APPROVED = 10;
export const REJECTION_PENALTY = 5;

export function ratingBonus(rating: number | null | undefined) {
  if (!rating) return 0;
  if (rating >= 5) return 5;
  if (rating === 4) return 3;
  return 0;
}

export const LEVELS = [
  { key: "ESPRESSO", name: "Espresso", min: 0, emoji: "☕" },
  { key: "LATTE", name: "Latte", min: 100, emoji: "🥛" },
  { key: "CAPPUCCINO", name: "Cappuccino", min: 500, emoji: "🫖" },
  { key: "BARISTA", name: "Barista", min: 1500, emoji: "🏆" },
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
