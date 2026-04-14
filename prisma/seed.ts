import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PIPELINE_STAGES = [
  { name: "Lead", order: 1, color: "#6366f1" },
  { name: "Contacted", order: 2, color: "#f59e0b" },
  { name: "Meeting", order: 3, color: "#3b82f6" },
  { name: "Proposal", order: 4, color: "#8b5cf6" },
  { name: "Won", order: 5, color: "#22c55e" },
  { name: "Lost", order: 6, color: "#ef4444" },
];

const DEFAULT_TEMPLATE = {
  name: "Default Cold Email",
  promptTemplate: `You are a cold email writer for Experidium, an AI automation agency.

Write a short cold email (under 100 words) for:
- Name: {{firstName}} {{lastName}}
- Company: {{companyName}} ({{companySize}} employees, {{companyIndustry}} industry)
- Their role: {{position}}
- Company description: "{{companyDescription}}"

Instructions:
- Reference their industry/business specifically
- Mention how AI automation can help them
- Keep it professional, direct, and helpful
- End with a clear CTA for a 5-minute chat
- Do NOT use buzzwords or generic filler

Output format:
Subject: <subject line>

Body:
<email body>`,
};

async function main() {
  console.log("Seeding pipeline stages...");

  for (const stage of PIPELINE_STAGES) {
    await prisma.pipelineStage.upsert({
      where: { name: stage.name },
      create: stage,
      update: { order: stage.order, color: stage.color },
    });
  }

  console.log(`Created ${PIPELINE_STAGES.length} pipeline stages.`);

  console.log("Seeding default email template...");

  await prisma.emailTemplate.upsert({
    where: { id: "default-template" },
    create: {
      id: "default-template",
      ...DEFAULT_TEMPLATE,
    },
    update: DEFAULT_TEMPLATE,
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
