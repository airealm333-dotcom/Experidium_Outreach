import { NextRequest } from "next/server";
import { runApolloImport } from "@/lib/apollo-import-handler";

export const LINKEDIN_APOLLO_SOURCE = "linkedin-apollo";

export async function POST(req: NextRequest) {
  const body = await req.json();
  return runApolloImport(body, LINKEDIN_APOLLO_SOURCE, { requireLinkedinUrl: true });
}
