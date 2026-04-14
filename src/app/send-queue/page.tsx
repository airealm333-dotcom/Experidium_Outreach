import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Send } from "lucide-react";
import { format } from "date-fns";
import { SendActions } from "./send-actions";

interface DraftItem {
  id: string;
  subject: string;
  contact: { firstName: string; lastName: string; email: string };
}

interface SendItem {
  id: string;
  sentAt: string;
  contact: { firstName: string; lastName: string; email: string };
  draft: { subject: string };
}

export default async function SendQueuePage() {
  let approvedDrafts: DraftItem[] = [];
  let recentSends: SendItem[] = [];

  try {
    const [rawDrafts, rawSends] = await Promise.all([
      prisma.emailDraft.findMany({
        where: { status: "APPROVED" },
        include: {
          contact: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.emailSend.findMany({
        include: {
          contact: {
            select: { firstName: true, lastName: true, email: true },
          },
          draft: { select: { subject: true } },
        },
        orderBy: { sentAt: "desc" },
        take: 20,
      }),
    ]);
    approvedDrafts = rawDrafts as unknown as DraftItem[];
    recentSends = (rawSends as unknown as SendItem[]).map((s) => ({
      ...s,
      sentAt: String(s.sentAt),
    }));
  } catch {
    // DB not connected
  }

  return (
    <>
      <PageHeader
        title="Send Queue"
        description="Send approved emails from alex@experidium.online"
      />

      <SendActions drafts={approvedDrafts} />

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Recent Sends
            </CardTitle>
            <CardDescription>Last 20 emails sent</CardDescription>
          </CardHeader>
          <CardContent>
            {recentSends.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No emails sent yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSends.map((send) => (
                    <TableRow key={send.id}>
                      <TableCell className="font-medium">
                        {send.contact.firstName} {send.contact.lastName}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {send.draft.subject}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(send.sentAt), "MMM d, h:mm a")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
