import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { Upload, Search, Users } from "lucide-react";
import Link from "next/link";
import { GenerateButton } from "./generate-button";
import { ContactsTable } from "./contacts-table";

interface ContactWithCompany {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string | null;
  status: string;
  company: { name: string } | null;
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  let contacts: ContactWithCompany[] = [];
  let totalCount = 0;

  try {
    const where = q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { company: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {};

    const [raw, count] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: { company: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.contact.count({ where }),
    ]);
    contacts = raw as unknown as ContactWithCompany[];
    totalCount = count;
  } catch {
    // DB not connected yet
  }

  const allContactIds = contacts.map((c) => c.id);

  return (
    <>
      <PageHeader
        title="Contacts"
        description={`${totalCount} contacts${q ? ` matching "${q}"` : ""}`}
      >
        <Link href="/import">
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
        </Link>
        <GenerateButton contactIds={allContactIds} disabled={contacts.length === 0} label="Generate All" />
      </PageHeader>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Contacts</CardTitle>
              <CardDescription>
                Manage your leads and prospects — select contacts to generate emails
              </CardDescription>
            </div>
            <form className="relative w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                placeholder="Search contacts..."
                className="pl-9"
                defaultValue={q || ""}
              />
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">
                {q ? "No contacts match your search" : "No contacts yet"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {q
                  ? "Try a different search term."
                  : "Import your Apollo exports to get started."}
              </p>
              {!q && (
                <Link href="/import">
                  <Button className="mt-4" size="sm">
                    <Upload className="mr-2 h-4 w-4" />
                    Import Contacts
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <ContactsTable contacts={contacts} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
