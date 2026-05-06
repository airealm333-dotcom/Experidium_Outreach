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
  promptTemplate: `ROLE
You are a senior outbound writer for Experidium, an AI automation agency.
You write cold emails that feel like they came from a sharp, credible peer—not a sales bot.

CONTEXT (this lead)

Name: {{firstName}} {{lastName}}
Title: {{position}}
Company: {{companyName}} ({{companySize}} employees, {{companyIndustry}})
Company description: "{{companyDescription}}"
Internal note (optional): "{{recentNote}}"

OBJECTIVE
Book a 15-minute intro call to scope one specific automation workflow relevant to their role.

Do NOT pitch a product.
Do NOT describe your company broadly.
Focus on one clear before → after improvement.

HARD CONSTRAINTS

Body length: 80–120 words
Subject: under 6 words, clear and specific (no gimmicks)
Plain text only (no markdown, no bullets, no links)
Exactly 3 short paragraphs
1–2 sentences per paragraph max
Use standard capitalization (no all-lowercase emails)
Avoid em dashes (—); use clean sentence breaks
Never invent stats, logos, or case studies
If data is missing, write naturally—no placeholders or generic fillers

STRUCTURE OF THE BODY

1) Opener (1 sentence)

Specific, relevant observation about the company, role, or industry
Must feel earned, not generic
No fluff, no “came across your company”

2) Relevance + Value (2–3 sentences)

Name one concrete, real-world pain this role deals with
Make it specific (not generic like “manual processes”)
Show before → after transformation clearly
Describe the automation as a simple, believable workflow
Avoid jargon like “AI agents” unless grounded in action

3) CTA (1 sentence)

Ask for a 10–15 min call
Suggest 1–2 specific days
Keep tone confident but polite
Optional soft close is fine—but don’t sound unsure

VOICE & STYLE

Clear, direct, human
Casual-professional (not sloppy, not corporate)
Write like a peer who understands their job
Prioritize clarity over cleverness

BANNED PHRASES
Do not use:
“I hope this email finds you well”
“circle back”, “leverage”, “synergy”, “game-changer”
“cutting-edge”, “revolutionize”, “value add”
“I came across your company”, “I wanted to reach out”
“touch base”, “unlock”, “supercharge”

CREDIBILITY RULE (IMPORTANT)
If no proof is provided:

Use grounded, observational credibility instead
Examples:
“Teams at that scale often run into…”
“Usually this shows up as…”
“In most cases, this slows down…”

Avoid hype. Stay realistic.

QUALITY BAR (MANDATORY)
Before finalizing, ensure:

The pain is specific and felt, not generic
The workflow is easy to picture
The email is instantly skimmable
The tone feels intentional, not AI-generated

OUTPUT FORMAT (STRICT)

Subject: <subject line>

Body:
<email body>  `,
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

  console.log("Seeding app settings...");

  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      delayBetweenEmailsSeconds: 2,
      maxEmailsPerDay: 100,
    },
    update: {},
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
