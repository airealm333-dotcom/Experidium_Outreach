import { Resend } from "resend";

let resendClient: Resend | null = null;

export function getResendClient(): Resend {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key || key === "your-resend-api-key") {
      throw new Error("RESEND_API_KEY is not configured");
    }
    resendClient = new Resend(key);
  }
  return resendClient;
}

export async function sendEmail({
  to,
  subject,
  html,
  from = "Alex <alex@experidium.online>",
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}) {
  const resend = getResendClient();

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data;
}
