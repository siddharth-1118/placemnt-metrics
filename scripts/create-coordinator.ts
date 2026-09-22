/**
 * Create or update a coordinator account.
 *
 *   npx tsx scripts/create-coordinator.ts <email> <password> [fullName] [assigned]
 *
 * assigned: "true" (default) → can open the evaluation dashboard,
 *           "false" → signs in but sees no batch data.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const [email, password, fullName, assigned] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-coordinator.ts <email> <password> [fullName] [assigned]");
    process.exit(1);
  }

  const evaluatorAssigned = assigned !== "false";
  const reg = `COORD-${email.split("@")[0].toUpperCase().replace(/[^A-Z0-9]/g, "-").slice(0, 24)}`;

  const c = await prisma.student.upsert({
    where: { email: email.toLowerCase() },
    create: {
      registerNumber: reg,
      fullName: fullName ?? `Coordinator (${email.split("@")[0]})`,
      email: email.toLowerCase(),
      tenthPercent: 0,
      twelfthPercent: 0,
      cgpa: 0,
      role: "COORDINATOR",
      evaluatorAssigned,
      passwordHash: hashPassword(password),
    },
    update: {
      role: "COORDINATOR",
      evaluatorAssigned,
      passwordHash: hashPassword(password),
    },
    select: { id: true, email: true, fullName: true, evaluatorAssigned: true },
  });

  console.log(`Coordinator ready: ${c.email} (${c.fullName}) — evaluatorAssigned: ${c.evaluatorAssigned}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
