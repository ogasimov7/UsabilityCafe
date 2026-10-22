import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
// Set SEED_PASSWORD when seeding a public deployment; the default is for local development only.
const password = process.env.SEED_PASSWORD ?? "password123";
const hash = await bcrypt.hash(password, 10);

async function user(email, data) {
  return db.user.upsert({ where: { email }, update: {}, create: { email, passwordHash: hash, ...data } });
}

await user("admin@usability.cafe", { name: "Cafe Admin", role: "ADMIN" });
const designer = await user("designer@usability.cafe", { name: "Dana Designer", role: "DESIGNER" });
await user("tester@usability.cafe", {
  name: "Toni Tester",
  role: "TESTER",
  birthYear: 1994,
  country: "Azerbaijan",
  device: "DESKTOP",
  profession: "Accountant",
  consentAt: new Date(),
  ndaAt: new Date(),
  points: 120,
});

if (!(await db.project.findFirst({ where: { ownerId: designer.id } }))) {
  const project = await db.project.create({ data: { name: "Coffee ordering app", ownerId: designer.id } });
  await db.test.create({
    data: {
      projectId: project.id,
      title: "Order a flat white for pickup",
      description: "Imagine you're on your way to work and want to order coffee ahead so it's ready when you arrive. This is an early prototype.",
      status: "OPEN",
      publishedAt: new Date(Date.now() - 24 * 3600_000),
      conceptType: "LINK",
      conceptUrl: "https://example.com",
      tasks: JSON.stringify([
        { title: "Find a flat white", instructions: "Find a flat white on the menu and customise it with oat milk." },
        { title: "Order for pickup", instructions: "Place the order for pickup at the nearest cafe in 15 minutes." },
      ]),
      questions: JSON.stringify([
        { prompt: "What was your overall impression?", kind: "TEXT" },
        { prompt: "How easy was it? (1–5)", kind: "RATING" },
      ]),
      attention: JSON.stringify({ prompt: "Type the word “coffee” to show you're paying attention.", answer: "coffee" }),
      sessionsWanted: 5,
      priceCents: 600,
      minSeconds: 60,
    },
  });
}
// Demo listings so the job board isn't empty. Only added once.
const demoJobs = [
  ["Banking app", "Send money to a friend in a new banking app", "You just had dinner with a friend and want to pay them back your share. Try the new transfer flow and tell us what feels safe or risky.", "IMAGES", 800, 8, ["MOBILE"], [], null],
  ["Banking app", "Find and understand your monthly spending", "You want to know how much you spent on food last month. Use the new insights screen and talk us through what you understand.", "LINK", 600, 5, [], [], null],
  ["Travel booking", "Book a weekend hotel in Baku", "You're planning a weekend trip for two. Find a hotel that fits a mid-range budget and get to the payment step.", "LINK", 700, 10, ["DESKTOP"], ["Azerbaijan", "Turkey"], null],
  ["Clinic portal", "Book a follow-up appointment as a nurse", "This portal is used by clinic staff. Schedule a follow-up for a patient and check the reminders are right.", "PDF", 2500, 4, ["DESKTOP"], [], "Nurse"],
  ["Fitness app", "Set up a 4-week running plan", "You want to start running three times a week. Set up a plan in this fitness app concept and say whether you'd stick with it.", "VIDEO", 500, 6, ["MOBILE", "TABLET"], [], null],
];
if ((await db.test.count({ where: { project: { ownerId: designer.id } } })) < 2) {
  for (const [i, [projectName, title, description, conceptType, priceCents, sessionsWanted, devices, countries, profession]] of demoJobs.entries()) {
    const project =
      (await db.project.findFirst({ where: { ownerId: designer.id, name: projectName } })) ??
      (await db.project.create({ data: { name: projectName, ownerId: designer.id } }));
    await db.test.create({
      data: {
        projectId: project.id,
        title,
        description,
        status: "OPEN",
        publishedAt: new Date(Date.now() - (i + 1) * 5 * 3600_000),
        conceptType,
        conceptUrl: conceptType === "LINK" ? "https://example.com" : null,
        tasks: JSON.stringify([
          { title: "First look", instructions: "Look around and describe what you think this screen is for." },
          { title: "Main task", instructions: description },
        ]),
        questions: JSON.stringify([{ prompt: "What would you change?", kind: "TEXT" }]),
        attention: JSON.stringify({ prompt: "Type the word “coffee” to show you're paying attention.", answer: "coffee" }),
        devices: JSON.stringify(devices),
        countries: JSON.stringify(countries),
        profession,
        sessionsWanted,
        priceCents,
        minSeconds: 90,
      },
    });
  }
}

console.log(`Seeded. Logins (${process.env.SEED_PASSWORD ? "SEED_PASSWORD" : "password123"}): admin@usability.cafe, designer@usability.cafe, tester@usability.cafe`);
await db.$disconnect();
