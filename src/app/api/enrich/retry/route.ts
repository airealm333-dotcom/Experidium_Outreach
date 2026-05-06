import { NextResponse } from "next/server";
import {
  APOLLO_UNLOCK_PLACEHOLDER_EMAIL_PREFIX,
  enrichImportedContacts,
} from "@/lib/apollo-enrich";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Re-runs Apollo bulk_match against every contact that still has the unlock
 * placeholder email and a saved `apolloPersonId`. Use this after topping up
 * Apollo credits, or any time you want to retry the rows the previous import
 * couldn't unlock.
 *
 * Response shape mirrors `enrichImportedContacts`'s result plus a
 * `before/after` count summary so the UI can surface "N contacts unlocked".
 */
export async function POST() {
  const before = await prisma.contact.count({
    where: {
      apolloPersonId: { not: null },
      email: {
        startsWith: APOLLO_UNLOCK_PLACEHOLDER_EMAIL_PREFIX,
        mode: "insensitive",
      },
    },
  });

  const result = await enrichImportedContacts();

  const after = await prisma.contact.count({
    where: {
      apolloPersonId: { not: null },
      email: {
        startsWith: APOLLO_UNLOCK_PLACEHOLDER_EMAIL_PREFIX,
        mode: "insensitive",
      },
    },
  });

  const unlocked = Math.max(before - after, 0);
  return NextResponse.json(
    {
      ok: true,
      lockedBefore: before,
      lockedAfter: after,
      unlocked,
      enrichment: result,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
