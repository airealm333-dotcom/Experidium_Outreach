import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  Users,
  Send,
  MailOpen,
  AlertTriangle,
  TrendingUp,
  Kanban,
} from "lucide-react";
import { prisma } from "@/lib/prisma";

async function getStats() {
  try {
    const [
      totalContacts,
      totalSent,
      totalDelivered,
      totalOpened,
      totalBounced,
      totalDeals,
      pendingDrafts,
    ] = await Promise.all([
      prisma.contact.count(),
      prisma.emailSend.count(),
      prisma.emailEvent.count({ where: { type: "DELIVERED" } }),
      prisma.emailEvent.count({ where: { type: "OPENED" } }),
      prisma.emailEvent.count({ where: { type: "BOUNCED" } }),
      prisma.deal.count({ where: { status: "OPEN" } }),
      prisma.emailDraft.count({ where: { status: "PENDING_REVIEW" } }),
    ]);

    const openRate =
      totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
    const bounceRate =
      totalSent > 0 ? Math.round((totalBounced / totalSent) * 100) : 0;

    return {
      totalContacts,
      totalSent,
      openRate,
      bounceRate,
      totalDeals,
      pendingDrafts,
    };
  } catch {
    return {
      totalContacts: 0,
      totalSent: 0,
      openRate: 0,
      bounceRate: 0,
      totalDeals: 0,
      pendingDrafts: 0,
    };
  }
}

export default async function DashboardPage() {
  const stats = await getStats();

  const cards = [
    {
      title: "Total Contacts",
      value: stats.totalContacts.toLocaleString(),
      description: stats.totalContacts === 0 ? "Import leads to get started" : "In your database",
      icon: Users,
    },
    {
      title: "Emails Sent",
      value: stats.totalSent.toLocaleString(),
      description: stats.totalSent === 0 ? "No emails sent yet" : "Total outreach emails",
      icon: Send,
    },
    {
      title: "Open Rate",
      value: `${stats.openRate}%`,
      description: "Across all campaigns",
      icon: MailOpen,
    },
    {
      title: "Bounce Rate",
      value: `${stats.bounceRate}%`,
      description: "Keep this under 3%",
      icon: AlertTriangle,
    },
    {
      title: "Pending Drafts",
      value: stats.pendingDrafts.toLocaleString(),
      description: "Awaiting your review",
      icon: TrendingUp,
    },
    {
      title: "Active Deals",
      value: stats.totalDeals.toLocaleString(),
      description: "In pipeline",
      icon: Kanban,
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your outreach performance"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <CardDescription className="text-xs">
                {stat.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest outreach actions</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentActivity />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Get started with your outreach</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickAction
              step="1"
              title="Import your leads"
              description="Upload CSV files from Apollo exports"
              href="/import"
            />
            <QuickAction
              step="2"
              title="Generate email drafts"
              description="AI writes personalized cold emails"
              href="/contacts"
            />
            <QuickAction
              step="3"
              title="Review & send"
              description="Approve drafts and send from your domain"
              href="/drafts"
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

async function RecentActivity() {
  let activities: { id: string; type: string; subject: string | null; createdAt: Date; contact: { firstName: string; lastName: string } }[] = [];

  try {
    const raw = await prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { contact: { select: { firstName: true, lastName: true } } },
    });
    activities = raw as unknown as typeof activities;
  } catch {
    // DB not ready
  }

  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No activity yet. Import contacts and start generating emails.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((a) => (
        <div key={a.id} className="flex items-center gap-3 text-sm">
          <div
            className={`h-2 w-2 rounded-full ${
              a.type === "EMAIL"
                ? "bg-indigo-500"
                : a.type === "TASK"
                ? "bg-yellow-500"
                : "bg-blue-500"
            }`}
          />
          <span className="flex-1 truncate">
            <span className="font-medium">
              {a.contact.firstName} {a.contact.lastName}
            </span>
            {" — "}
            {a.subject || a.type.toLowerCase()}
          </span>
        </div>
      ))}
    </div>
  );
}

function QuickAction({
  step,
  title,
  description,
  href,
}: {
  step: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-accent"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
        {step}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </a>
  );
}
