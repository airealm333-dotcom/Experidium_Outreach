import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  let promptTemplate = "";

  try {
    const template = await prisma.emailTemplate.findFirst({
      orderBy: { updatedAt: "desc" },
    });
    promptTemplate = template?.promptTemplate || "";
  } catch {
    // DB not connected
  }

  const hasGroq =
    process.env.GROQ_API_KEY &&
    process.env.GROQ_API_KEY !== "your-groq-api-key";
  const hasResend =
    process.env.RESEND_API_KEY &&
    process.env.RESEND_API_KEY !== "your-resend-api-key";
  const hasDb =
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes("user:password");

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure your outreach system"
      />

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Configured via environment variables (.env file)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">Groq AI (Llama 3.3 70B)</p>
                <p className="text-xs text-muted-foreground">
                  GROQ_API_KEY
                </p>
              </div>
              <Badge className="w-fit shrink-0" variant={hasGroq ? "default" : "secondary"}>
                {hasGroq ? "Configured" : "Not Set"}
              </Badge>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">Resend (Email)</p>
                <p className="text-xs text-muted-foreground">RESEND_API_KEY</p>
              </div>
              <Badge className="w-fit shrink-0" variant={hasResend ? "default" : "secondary"}>
                {hasResend ? "Configured" : "Not Set"}
              </Badge>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">Database</p>
                <p className="text-xs text-muted-foreground">DATABASE_URL</p>
              </div>
              <Badge className="w-fit shrink-0" variant={hasDb ? "default" : "secondary"}>
                {hasDb ? "Configured" : "Not Set"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Configuration</CardTitle>
            <CardDescription>
              Sender identity for outreach emails
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">From Name</label>
              <Input defaultValue="Alex" className="mt-1" disabled />
            </div>
            <div>
              <label className="text-sm font-medium">From Email</label>
              <Input
                defaultValue="alex@experidium.online"
                className="mt-1"
                disabled
              />
              <p className="text-xs text-muted-foreground mt-1">
                Must be verified in Resend. Edit in src/lib/resend.ts to change.
              </p>
            </div>
          </CardContent>
        </Card>

        <SettingsForm initialPrompt={promptTemplate} />

        <Card>
          <CardHeader>
            <CardTitle>Send Pacing</CardTitle>
            <CardDescription>
              Control sending speed for domain warm-up
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                Delay between emails (seconds)
              </label>
              <Input type="number" defaultValue="2" className="mt-1 w-32" />
              <p className="text-xs text-muted-foreground mt-1">
                Currently fixed at 2 seconds between sends in bulk mode
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">
                Max emails per day
              </label>
              <Input type="number" defaultValue="100" className="mt-1 w-32" />
              <p className="text-xs text-muted-foreground mt-1">
                Resend free tier: 100/day. Start with 5-10 for new domains.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
