import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Mail,
  Link as LinkIcon,
  MapPin,
  Briefcase,
  ArrowLeft,
} from "lucide-react";
import { format } from "date-fns";
import { ContactActions } from "./contact-actions";

const statusColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  QUALIFIED: "bg-green-100 text-green-800",
  CONTACTED: "bg-yellow-100 text-yellow-800",
  REPLIED: "bg-purple-100 text-purple-800",
  BOUNCED: "bg-red-100 text-red-800",
  UNSUBSCRIBED: "bg-gray-100 text-gray-800",
};

const activityIcons: Record<string, string> = {
  TASK: "clipboard-check",
  NOTE: "file-text",
  EMAIL: "mail",
};

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let contact;
  try {
    contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        company: true,
        activities: { orderBy: { createdAt: "desc" } },
        emailDrafts: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        emailSends: {
          orderBy: { sentAt: "desc" },
          take: 10,
          include: { events: true },
        },
      },
    });
  } catch {
    notFound();
  }

  if (!contact) notFound();

  const c = contact as unknown as {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    linkedinUrl: string | null;
    position: string | null;
    seniority: string | null;
    country: string | null;
    state: string | null;
    status: string;
    tags: string[];
    source: string | null;
    createdAt: Date;
    company: {
      id: string;
      name: string;
      website: string | null;
      industry: string | null;
      employeeCount: number | null;
    } | null;
    activities: {
      id: string;
      type: string;
      subject: string | null;
      body: string | null;
      dueDate: Date | null;
      completed: boolean;
      createdAt: Date;
    }[];
    emailDrafts: {
      id: string;
      subject: string;
      status: string;
      createdAt: Date;
    }[];
    emailSends: {
      id: string;
      sentAt: Date;
      events: { type: string; timestamp: Date }[];
    }[];
  };

  return (
    <>
      <PageHeader title={`${c.firstName} ${c.lastName}`}>
        <Link href="/contacts">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Contacts
          </Button>
        </Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Contact Info</CardTitle>
                <Badge
                  variant="secondary"
                  className={statusColors[c.status] ?? ""}
                >
                  {c.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${c.email}`} className="hover:underline">
                  {c.email}
                </a>
              </div>
              {c.position && (
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {c.position}
                    {c.seniority && (
                      <span className="text-muted-foreground">
                        {" "}
                        ({c.seniority})
                      </span>
                    )}
                  </span>
                </div>
              )}
              {(c.country || c.state) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {[c.state, c.country].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
              {c.linkedinUrl && (
                <div className="flex items-center gap-2 text-sm">
                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={c.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline truncate"
                  >
                    LinkedIn Profile
                  </a>
                </div>
              )}
              <Separator />
              <div className="text-xs text-muted-foreground">
                Source: {c.source || "Manual"} | Added:{" "}
                {format(c.createdAt, "MMM d, yyyy")}
              </div>
            </CardContent>
          </Card>

          {c.company && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {c.company.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {c.company.industry && (
                  <p>
                    <span className="text-muted-foreground">Industry:</span>{" "}
                    {c.company.industry}
                  </p>
                )}
                {c.company.employeeCount && (
                  <p>
                    <span className="text-muted-foreground">Size:</span>{" "}
                    {c.company.employeeCount.toLocaleString()} employees
                  </p>
                )}
                {c.company.website && (
                  <a
                    href={
                      c.company.website.startsWith("http")
                        ? c.company.website
                        : `https://${c.company.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline block"
                  >
                    {c.company.website}
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Email Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Drafts</span>
                <span className="font-medium">{c.emailDrafts.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sent</span>
                <span className="font-medium">{c.emailSends.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Opened</span>
                <span className="font-medium">
                  {c.emailSends.reduce(
                    (acc, s) =>
                      acc + s.events.filter((e) => e.type === "OPENED").length,
                    0
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <ContactActions contactId={c.id} />

          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>
                Notes, tasks, and email history
              </CardDescription>
            </CardHeader>
            <CardContent>
              {c.activities.length === 0 && c.emailSends.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No activity yet. Add a note or generate an email.
                </p>
              ) : (
                <div className="space-y-4">
                  {c.activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex gap-3 rounded-lg border p-3"
                    >
                      <div
                        className={`mt-0.5 h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                          activity.type === "TASK"
                            ? activity.completed
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                            : activity.type === "NOTE"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {activity.type === "TASK"
                          ? activity.completed
                            ? "✓"
                            : "T"
                          : activity.type === "NOTE"
                          ? "N"
                          : "E"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">
                            {activity.subject || activity.type}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {format(activity.createdAt, "MMM d, h:mm a")}
                          </span>
                        </div>
                        {activity.body && (
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                            {activity.body}
                          </p>
                        )}
                        {activity.type === "TASK" && activity.dueDate && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Due: {format(activity.dueDate, "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {c.emailSends.map((send) => (
                    <div
                      key={send.id}
                      className="flex gap-3 rounded-lg border p-3"
                    >
                      <div className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                        ✉
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Email Sent</p>
                          <span className="text-xs text-muted-foreground">
                            {format(send.sentAt, "MMM d, h:mm a")}
                          </span>
                        </div>
                        <div className="flex gap-1 mt-1">
                          {send.events.map((evt) => (
                            <Badge
                              key={evt.type}
                              variant="secondary"
                              className="text-xs"
                            >
                              {evt.type.toLowerCase()}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
