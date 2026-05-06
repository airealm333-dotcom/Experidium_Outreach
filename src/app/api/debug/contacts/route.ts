import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Debug endpoint: hit `GET /api/debug/contacts` in the browser to see exactly
 * what the database holds, bypassing the React/Next render pipeline.
 *
 * This is the canonical "is the data really in the DB?" check after an Apollo
 * import. If this shows the new rows but `/contacts` does not, the issue is
 * client-side caching, not the import.
 */
export async function GET() {
  try {
    const [total, apollo, latest] = await Promise.all([
      prisma.contact.count(),
      prisma.contact.count({ where: { source: "apollo-saved-search" } }),
      prisma.contact.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 10,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          source: true,
          apolloPersonId: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json(
      {
        ok: true,
        counts: {
          total,
          apollo,
        },
        latest,
        renderedAt: new Date().toISOString(),
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
