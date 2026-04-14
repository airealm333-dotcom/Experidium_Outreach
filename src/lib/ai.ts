import Groq from "groq-sdk";

let groq: Groq | null = null;

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

export async function generateEmailCopy(
  prompt: string
): Promise<{ subject: string; body: string }> {
  const client = getClient();

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const text = completion.choices[0]?.message?.content || "";

    const subjectMatch = text.match(/Subject:\s*(.*)/i);
    const bodyMatch = text.match(/Body:\s*([\s\S]*)/i);

    const subject = subjectMatch ? subjectMatch[1].trim() : "Follow up";
    let body = bodyMatch ? bodyMatch[1].trim() : text.trim();
    body = body.replace(/```/g, "").trim();

    return { subject, body };
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
  } | null
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
    );
}
