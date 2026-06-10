import { LinkedInPageBody } from "./linkedin-page-body";
import type { LinkedInPageSearchParams } from "./linkedin-url";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function LinkedInPage({
  searchParams,
}: {
  searchParams: Promise<LinkedInPageSearchParams>;
}) {
  return <LinkedInPageBody searchParams={await searchParams} />;
}
