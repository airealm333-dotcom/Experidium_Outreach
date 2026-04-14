import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsData, type AnalyticsRange } from "@/lib/analytics";

const ALLOWED_RANGES: AnalyticsRange[] = ["7d", "30d", "90d", "custom"];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rangeParam = searchParams.get("range") as AnalyticsRange | null;
    const range = ALLOWED_RANGES.includes(rangeParam as AnalyticsRange)
      ? (rangeParam as AnalyticsRange)
      : "30d";
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const data = await getAnalyticsData({ range, from, to });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load analytics", details: String(error) },
      { status: 500 }
    );
  }
}
