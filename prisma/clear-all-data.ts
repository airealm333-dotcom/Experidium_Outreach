/**
 * Wipes all application rows from Postgres. Schema stays intact.
 * Run: npx tsx prisma/clear-all-data.ts
 * Or:  npm run db:clear
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Clearing all data (child tables first)…");

  // Sequential deletes avoid interactive-transaction timeouts (P2028) on slow
  // or remote Postgres when using the driver adapter.
  await prisma.emailEvent.deleteMany();
  await prisma.emailSend.deleteMany();
  await prisma.emailDraft.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.emailTemplate.deleteMany();
  await prisma.appSettings.deleteMany();
  await prisma.pipelineStage.deleteMany();

  console.log("All transactional data removed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
