import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const hash = await bcrypt.hash("password123", 10);

async function user(email, data) {
  return db.user.upsert({ where: { email }, update: {}, create: { email, passwordHash: hash, ...data } });
}

await user("admin@usability.cafe", { name: "Cafe Admin", role: "ADMIN" });
const designer = await user("designer@usability.cafe", { name: "Dana Designer", role: "DESIGNER", sessionCredits: 5 });
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
      priceCents: 1200,
      minSeconds: 60,
    },
  });
}
console.log("Seeded. Logins (password123): admin@usability.cafe, designer@usability.cafe, tester@usability.cafe");
await db.$disconnect();
