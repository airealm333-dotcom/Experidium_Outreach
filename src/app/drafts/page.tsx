import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileEdit } from "lucide-react";
import { DraftsTable } from "./drafts-table";

export const dynamic = "force-dynamic";

interface DraftWithContact {
  id: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
  contact: { firstName: string; lastName: string; email: string };
}

export default async function DraftsPage() {
  let drafts: DraftWithContact[] = [];

  try {
    const raw = await prisma.emailDraft.findMany({
      include: {
        contact: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    drafts = raw.map((d) => ({
      ...(d as unknown as DraftWithContact),
      createdAt: (d.createdAt as Date).toISOString(),
    }));
  } catch {
    // DB not connected
  }

  return (
    <>
      <PageHeader
        title="Email Drafts"
        description="Review AI-generated emails before sending"
      />

      <Card>
        <CardHeader>
          <CardTitle>Draft Queue</CardTitle>
          <CardDescription>
            AI-generated emails waiting for your review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {drafts.length === 0 ? (
            <div className="py-12 text-center">
              <FileEdit className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No drafts yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Go to Contacts and click &quot;Generate Emails&quot; to create
                drafts.
              </p>
            </div>
          ) : (
            <DraftsTable drafts={drafts} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
