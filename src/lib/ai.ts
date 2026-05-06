import Groq from "groq-sdk";

let groq: Groq | null = null;

const MODEL = "llama-3.3-70b-versatile";
/** Lower temp = more disciplined output that respects the prompt's constraints. */
const DRAFT_TEMPERATURE = 0.4;
const REWRITE_TEMPERATURE = 0.3;

/**
 * Banned phrases the rewrite pass scans for. These are the phrases that make
 * generic AI cold emails feel like spam. Keep this list in sync with the
 * prompt template's banned list in `prisma/seed.ts`.
 */
const BANNED_PHRASES = [
  "i hope this email finds you well",
  "circle back",
  "synergy",
  "leverage",
  "in today's fast-paced",
  "game-changer",
  "revolutionize",
  "best-in-class",
  "cutting-edge",
  "i came across your company",
  "i wanted to reach out",
  "touch base",
  "value add",
  "thought leader",
  "transform your business",
  "unlock",
  "supercharge",
  "their company",
  "decision maker",
  "a growing business",
];

function toPlainText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getClient() {
  if (!groq) {
    const key = process.env.GROQ_API_KEY;
    if (!key || key === "your-groq-api-key") {
      throw new Error(
        "GROQ_API_KEY is not configured. Get a free key at https://console.groq.com"
      );
    }
    groq = new Groq({ apiKey: key });
  }
  return groq;
}

function parseSubjectAndBody(text: string): { subject: string; body: string } {
  const subjectMatch = text.match(/Subject:\s*(.*)/i);
  const bodyMatch = text.match(/Body:\s*([\s\S]*)/i);

  const subject = toPlainText(subjectMatch ? subjectMatch[1] : "Follow up")
    .replace(/\n+/g, " ")
    .trim();
  const body = toPlainText(bodyMatch ? bodyMatch[1] : text);

  return { subject, body };
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function hasBannedPhrase(s: string): boolean {
  const lower = s.toLowerCase();
  return BANNED_PHRASES.some((p) => lower.includes(p));
}

function hasDashLikePunctuation(s: string): boolean {
  return s.includes("—") || s.includes("–");
}

/**
 * Detects outputs that are effectively all-lowercase prose.
 * Keeps noise-tolerance for short strings and mixed-content tokens.
 */
function looksAllLowercase(s: string): boolean {
  if (s.length < 30) return false;
  let alpha = 0;
  let upper = 0;
  for (const ch of s) {
    if (/[a-z]/i.test(ch)) {
      alpha += 1;
      if (/[A-Z]/.test(ch)) upper += 1;
    }
  }
  if (alpha < 20) return false;
  return upper / alpha < 0.02;
}

/**
 * Returns true when the draft already meets the prompt's hard constraints, so
 * the second (critique-rewrite) pass can be skipped to save latency / quota.
 */
function passesQualityGate(subject: string, body: string): boolean {
  const wc = wordCount(body);
  if (wc < 80 || wc > 120) return false;
  if (subject.split(/\s+/).filter(Boolean).length > 6) return false;
  if (looksAllLowercase(subject) || looksAllLowercase(body)) return false;
  if (hasDashLikePunctuation(subject) || hasDashLikePunctuation(body)) return false;
  if (hasBannedPhrase(subject) || hasBannedPhrase(body)) return false;
  return true;
}

async function callGroq(
  prompt: string,
  temperature: number
): Promise<string> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: `${prompt}\n\nOutput requirements:\n- Plain text only\n- No HTML\n- No markdown\n- No code fences\n- No styling tags`,
      },
    ],
    temperature,
  });
  return completion.choices[0]?.message?.content || "";
}

/**
 * Two-stage generation:
 *   1) Draft once with the full prompt at low temperature.
 *   2) If the draft fails the quality gate (length, subject length,
 *      banned-phrase scan), run a critique-and-rewrite pass that asks the
 *      model to fix only the violated rules and re-output in the same
 *      Subject/Body format.
 *
 * Falls back to the first-pass draft if the rewrite call errors or returns
 * something we can't parse.
 */
export async function generateEmailCopy(
  prompt: string
): Promise<{ subject: string; body: string }> {
  try {
    const firstText = await callGroq(prompt, DRAFT_TEMPERATURE);
    const first = parseSubjectAndBody(firstText);

    if (passesQualityGate(first.subject, first.body)) {
      return first;
    }

    const rewritePrompt = [
      "Below is a cold-email draft. It violates one or more of these rules:",
      "- Body must be 80-120 words.",
      "- Subject must be under 6 words. No emojis. No 'quick question'. No 're:'.",
      "- Plain text only. No markdown, no code fences, no HTML.",
      "- Exactly 3 short paragraphs in the body.",
      "- Use standard capitalization. Do NOT write the email in all lowercase.",
      "- Do NOT use em dashes (—) or en dashes (–). Use clean sentence breaks.",
      "- Never use placeholder fallbacks verbatim ('their company', 'Decision Maker', 'a growing business', 'technology').",
      "- Banned phrases (any variant): " + BANNED_PHRASES.join(", ") + ".",
      "",
      "Rewrite the draft so it complies with EVERY rule. Keep the original",
      "intent and any specific facts the writer mentioned. Do not invent new",
      "stats or case studies. Output exactly this format and nothing else:",
      "",
      "Subject: <subject line>",
      "",
      "Body:",
      "<email body>",
      "",
      "DRAFT:",
      firstText,
    ].join("\n");

    try {
      const rewriteText = await callGroq(rewritePrompt, REWRITE_TEMPERATURE);
      const rewrite = parseSubjectAndBody(rewriteText);
      if (rewrite.subject && rewrite.body) {
        return rewrite;
      }
    } catch {
      // fall through to first-pass draft
    }

    return first;
  } catch (err) {
    const errStr = String(err);
    if (errStr.includes("429") || errStr.includes("rate_limit")) {
      throw new Error(
        "Groq API rate limit exceeded. Wait a minute and try again, or check your usage at https://console.groq.com"
      );
    }
    throw err;
  }
}

export function buildPrompt(
  template: string,
  contact: {
    firstName: string;
    lastName: string;
    position?: string | null;
  },
  company?: {
    name?: string | null;
    industry?: string | null;
    employeeCount?: number | null;
    description?: string | null;
  } | null,
  extras?: {
    recentNote?: string | null;
  }
): string {
  return template
    .replace(/\{\{firstName\}\}/g, contact.firstName)
    .replace(/\{\{lastName\}\}/g, contact.lastName)
    .replace(/\{\{position\}\}/g, contact.position || "Decision Maker")
    .replace(/\{\{companyName\}\}/g, company?.name || "their company")
    .replace(/\{\{companyIndustry\}\}/g, company?.industry || "technology")
    .replace(
      /\{\{companySize\}\}/g,
      String(company?.employeeCount || "unknown")
    )
    .replace(
      /\{\{companyDescription\}\}/g,
      company?.description || "a growing business"
    )
    .replace(/\{\{recentNote\}\}/g, (extras?.recentNote ?? "").trim());
}
