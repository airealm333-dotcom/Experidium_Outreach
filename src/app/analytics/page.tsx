import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalyticsData, type AnalyticsRange } from "@/lib/analytics";

type SearchParams = {
  range?: string;
  from?: string;
  to?: string;
};

function healthTone(value: number, warnAt: number) {
  return value > warnAt ? "text-red-600" : "text-emerald-600";
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const range = (searchParams?.range as AnalyticsRange) || "30d";
  const from = searchParams?.from;
  const to = searchParams?.to;
  const stats = await getAnalyticsData({ range, from, to });

  const maxSent = Math.max(...stats.trends.map((d) => d.sent), 1);
  const maxEvent = Math.max(
    ...stats.trends.map((d) => d.delivered + d.opened + d.clicked + d.bounced + d.complained),
    1
  );

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Delivery health, engagement trends, and business outcomes"
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(["7d", "30d", "90d"] as AnalyticsRange[]).map((option) => (
          <Link key={option} href={`/analytics?range=${option}`}>
            <Button variant={stats.filters.range === option ? "default" : "outline"} size="sm">
              {option.toUpperCase()}
            </Button>
          </Link>
        ))}
        <form action="/analytics" className="ml-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="range" value="custom" />
          <input
            name="from"
            type="date"
            defaultValue={stats.filters.from}
            className="h-9 rounded-md border px-3 text-sm"
          />
          <input
            name="to"
            type="date"
            defaultValue={stats.filters.to}
            className="h-9 rounded-md border px-3 text-sm"
          />
          <Button size="sm" variant="outline" type="submit">
            Apply
          </Button>
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Sent" value={String(stats.kpis.totalSent)} helper="Emails sent in selected window" />
        <MetricCard title="Delivered Rate" value={`${stats.kpis.deliveredRate}%`} helper="Unique delivered / sent" />
        <MetricCard title="Open Rate" value={`${stats.kpis.openRate}%`} helper="Unique opened / sent" />
        <MetricCard title="Click Rate" value={`${stats.kpis.clickRate}%`} helper="Unique clicked / sent" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Bounce Rate"
          value={`${stats.kpis.bounceRate}%`}
          helper={`Warn above ${stats.thresholds.bounceRateWarnAt}%`}
          className={healthTone(stats.kpis.bounceRate, stats.thresholds.bounceRateWarnAt)}
        />
        <MetricCard
          title="Complaint Rate"
          value={`${stats.kpis.complaintRate}%`}
          helper={`Warn above ${stats.thresholds.complaintRateWarnAt}%`}
          className={healthTone(stats.kpis.complaintRate, stats.thresholds.complaintRateWarnAt)}
        />
        <MetricCard
          title="Reply Rate"
          value="Not available"
          helper="Provider reply event not enabled"
          className="text-muted-foreground"
        />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Volume Trend</CardTitle>
            <CardDescription>Daily sends and event activity</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.trends.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No sends found for this date range.
              </p>
            ) : (
              <div className="space-y-2">
                {stats.trends.map((point) => (
                  <div key={point.day} className="flex items-center gap-3">
                    <span className="w-20 text-xs text-muted-foreground shrink-0">
                      {point.day.slice(5)}
                    </span>
                    <div className="flex-1 space-y-1.5">
                      <div className="bg-muted rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all"
                          style={{ width: `${(point.sent / maxSent) * 100}%` }}
                        />
                      </div>
                      <div className="bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-sky-500 h-full rounded-full transition-all"
                          style={{
                            width: `${
                              ((point.delivered + point.opened + point.clicked + point.bounced + point.complained) /
                                maxEvent) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="w-14 text-xs font-medium text-right">
                      {point.sent} sent
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Domain Breakdown</CardTitle>
            <CardDescription>Where delivery risk is concentrated</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.domainBreakdown.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No domain data available yet.
              </p>
            ) : (
              <div className="space-y-3">
                {stats.domainBreakdown.map((row) => (
                  <div key={row.domain} className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium">{row.domain}</span>
                      <span className="text-xs text-muted-foreground">{row.sent} sent</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <span>Opened: {row.opened}</span>
                      <span className="text-red-600">Bounced: {row.bounced}</span>
                      <span className="text-orange-600">Complained: {row.complained}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Outreach + Commercial Funnel</CardTitle>
            <CardDescription>From sends to pipeline outcomes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FunnelRow label="Sent" value={stats.funnel.sent} />
            <FunnelRow label="Delivered" value={stats.funnel.delivered} />
            <FunnelRow label="Opened" value={stats.funnel.opened} />
            <FunnelRow label="Clicked" value={stats.funnel.clicked} />
            <FunnelRow label="Bounced" value={stats.funnel.bounced} danger />
            <FunnelRow label="Complained" value={stats.funnel.complained} danger />
            <FunnelRow label="Contacted" value={stats.funnel.contacted} />
            <FunnelRow label="Replied" value="Not available yet (provider-only mode)" muted />
            <FunnelRow label="Deals Open" value={stats.funnel.dealsOpen} />
            <FunnelRow label="Deals Won" value={stats.funnel.dealsWon} />
            <FunnelRow label="Deals Lost" value={stats.funnel.dealsLost} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business Outcome</CardTitle>
            <CardDescription>Deal value and close quality</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Won Value</p>
                <p className="text-xl font-semibold">${stats.deals.wonValue.toLocaleString()}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Open Value</p>
                <p className="text-xl font-semibold">${stats.deals.openValue.toLocaleString()}</p>
              </div>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Win Rate (Closed Deals)</p>
              <p className="text-2xl font-semibold">{stats.deals.winRate}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Top Failure Reasons</CardTitle>
            <CardDescription>Bounce and complaint reasons from webhook payload</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.failureReasons.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">
                No bounce or complaint reasons recorded in this window.
              </p>
            ) : (
              <div className="space-y-2">
                {stats.failureReasons.map((reason) => (
                  <div key={reason.reason} className="flex items-center justify-between rounded-md border p-2.5">
                    <span className="text-sm">{reason.reason}</span>
                    <span className="text-xs text-muted-foreground">{reason.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function MetricCard({
  title,
  value,
  helper,
  className,
}: {
  title: string;
  value: string;
  helper: string;
  className?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <CardDescription>{helper}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${className || ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function FunnelRow({
  label,
  value,
  danger,
  muted,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <span className="text-sm">{label}</span>
      <span
        className={`text-sm font-medium ${
          danger ? "text-red-600" : muted ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
