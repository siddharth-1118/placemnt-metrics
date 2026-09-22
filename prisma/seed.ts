/**
 * Seed ONLY the coordinator accounts. No demo students and no mock scrape
 * data — the portal shows exactly what real submissions + live scrapes
 * produce (stored in Supabase once DATABASE_URL points there).
 *
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const COORDINATORS = [
  {
    reg: "COORD-SV3824",
    name: "Coordinator (sv3824)",
    email: "sv3824@srmist.edu.in",
    password: "vSs@11182007",
    assigned: true,
  },
  {
    reg: "COORD-FACULTY-01",
    name: "Dr. Ramesh (Placement Coordinator)",
    email: "coordinator@srmist.edu.in",
    password: "evaluator123",
    assigned: true,
  },
];

async function main() {
  for (const c of COORDINATORS) {
    await prisma.student.upsert({
      where: { email: c.email },
      create: {
        registerNumber: c.reg,
        fullName: c.name,
        email: c.email,
        tenthPercent: 0,
        twelfthPercent: 0,
        cgpa: 0,
        role: "COORDINATOR",
        evaluatorAssigned: c.assigned,
        passwordHash: hashPassword(c.password),
      },
      update: {
        role: "COORDINATOR",
        evaluatorAssigned: c.assigned,
        passwordHash: hashPassword(c.password),
      },
      select: { id: true },
    });
    console.log(`Coordinator ready: ${c.email} (evaluatorAssigned: ${c.assigned})`);
  }

  const students = await prisma.student.count({ where: { role: { not: "COORDINATOR" } } });
  console.log(`Student submissions in DB: ${students}`);
  console.log("No demo/mock data seeded — all shown data is real (submitted + live-scraped).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
