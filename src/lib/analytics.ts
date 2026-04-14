import { prisma } from "@/lib/prisma";

export type AnalyticsRange = "7d" | "30d" | "90d" | "custom";

export interface AnalyticsFilters {
  range: AnalyticsRange;
  from?: string;
  to?: string;
}

interface DayPoint {
  day: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
}

interface DomainBreakdownRow {
  domain: string;
  sent: number;
  opened: number;
  bounced: number;
  complained: number;
}

interface FailureReason {
  reason: string;
  count: number;
}

interface FunnelStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  contacted: number;
  replied: null;
  dealsOpen: number;
  dealsWon: number;
  dealsLost: number;
}

export interface AnalyticsPayload {
  filters: { range: AnalyticsRange; from: string; to: string };
  kpis: {
    totalSent: number;
    deliveredRate: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
    complaintRate: number;
    replyRateAvailable: false;
    replyRate: null;
  };
  thresholds: {
    bounceRateWarnAt: number;
    complaintRateWarnAt: number;
  };
  trends: DayPoint[];
  domainBreakdown: DomainBreakdownRow[];
  failureReasons: FailureReason[];
  funnel: FunnelStats;
  deals: {
    wonValue: number;
    openValue: number;
    winRate: number;
  };
}

function toDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pct(n: number, d: number): number {
  if (d <= 0) return 0;
  return Number(((n / d) * 100).toFixed(1));
}

function parseReason(payload: string | null): string {
  if (!payload) return "Unknown reason";

  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    const data = (parsed.data ?? {}) as Record<string, unknown>;
    const reason =
      data.bounce?.toString() ||
      data.reason?.toString() ||
      data.description?.toString() ||
      parsed.reason?.toString();
    return reason || "Unknown reason";
  } catch {
    return "Unknown reason";
  }
}

function resolveDateRange(filters: AnalyticsFilters): { from: Date; to: Date; range: AnalyticsRange } {
  const now = new Date();
  const to = filters.to ? new Date(filters.to) : now;
  let from: Date;

  if (filters.range === "custom" && filters.from) {
    from = new Date(filters.from);
  } else {
    const days = filters.range === "7d" ? 7 : filters.range === "90d" ? 90 : 30;
    from = new Date(to);
    from.setDate(from.getDate() - (days - 1));
  }

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to, range: filters.range };
}

function domainBucket(email: string): string {
  const domain = email.split("@")[1]?.toLowerCase() || "unknown";
  if (domain.includes("gmail")) return "gmail.com";
  if (domain.includes("yahoo")) return "yahoo.com";
  if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live")) {
    return "outlook/hotmail";
  }
  return domain;
}

export async function getAnalyticsData(filters: AnalyticsFilters): Promise<AnalyticsPayload> {
  const { from, to, range } = resolveDateRange(filters);

  const sends = await prisma.emailSend.findMany({
    where: { sentAt: { gte: from, lte: to } },
    include: {
      contact: { select: { email: true } },
      events: {
        where: { timestamp: { gte: from, lte: to } },
        select: { type: true, timestamp: true, payload: true },
      },
    },
    orderBy: { sentAt: "asc" },
  });

  const sendIdsByEvent = {
    delivered: new Set<string>(),
    opened: new Set<string>(),
    clicked: new Set<string>(),
    bounced: new Set<string>(),
    complained: new Set<string>(),
  };

  const trendsMap = new Map<string, DayPoint>();
  const domainMap = new Map<string, DomainBreakdownRow>();
  const reasonMap = new Map<string, number>();

  for (const send of sends) {
    const day = toDayKey(send.sentAt);
    const currentDay = trendsMap.get(day) ?? {
      day,
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
    };
    currentDay.sent += 1;
    trendsMap.set(day, currentDay);

    const bucket = domainBucket(send.contact.email);
    const row = domainMap.get(bucket) ?? {
      domain: bucket,
      sent: 0,
      opened: 0,
      bounced: 0,
      complained: 0,
    };
    row.sent += 1;
    domainMap.set(bucket, row);

    let openedMarked = false;
    let bouncedMarked = false;
    let complainedMarked = false;

    for (const event of send.events) {
      const eventDay = toDayKey(event.timestamp);
      const dayEntry = trendsMap.get(eventDay) ?? {
        day: eventDay,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        complained: 0,
      };

      if (event.type === "DELIVERED") {
        sendIdsByEvent.delivered.add(send.id);
        dayEntry.delivered += 1;
      }
      if (event.type === "OPENED") {
        sendIdsByEvent.opened.add(send.id);
        dayEntry.opened += 1;
        if (!openedMarked) {
          row.opened += 1;
          openedMarked = true;
        }
      }
      if (event.type === "CLICKED") {
        sendIdsByEvent.clicked.add(send.id);
        dayEntry.clicked += 1;
      }
      if (event.type === "BOUNCED") {
        sendIdsByEvent.bounced.add(send.id);
        dayEntry.bounced += 1;
        if (!bouncedMarked) {
          row.bounced += 1;
          bouncedMarked = true;
        }
        const reason = parseReason(event.payload);
        reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
      }
      if (event.type === "COMPLAINED") {
        sendIdsByEvent.complained.add(send.id);
        dayEntry.complained += 1;
        if (!complainedMarked) {
          row.complained += 1;
          complainedMarked = true;
        }
        const reason = parseReason(event.payload);
        reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
      }

      trendsMap.set(eventDay, dayEntry);
    }

    domainMap.set(bucket, row);
  }

  const contacted = new Set(sends.map((s) => s.contactId)).size;

  const [dealsOpen, dealsWon, dealsLost] = await Promise.all([
    prisma.deal.findMany({
      where: { status: "OPEN", createdAt: { gte: from, lte: to } },
      select: { value: true },
    }),
    prisma.deal.findMany({
      where: { status: "WON", updatedAt: { gte: from, lte: to } },
      select: { value: true },
    }),
    prisma.deal.findMany({
      where: { status: "LOST", updatedAt: { gte: from, lte: to } },
      select: { value: true },
    }),
  ]);

  const totalSent = sends.length;
  const delivered = sendIdsByEvent.delivered.size;
  const opened = sendIdsByEvent.opened.size;
  const clicked = sendIdsByEvent.clicked.size;
  const bounced = sendIdsByEvent.bounced.size;
  const complained = sendIdsByEvent.complained.size;

  const trends = Array.from(trendsMap.values()).sort((a, b) => a.day.localeCompare(b.day));
  const domainBreakdown = Array.from(domainMap.values()).sort((a, b) => b.sent - a.sent);
  const failureReasons = Array.from(reasonMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const wonValue = dealsWon.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const openValue = dealsOpen.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const totalClosed = dealsWon.length + dealsLost.length;

  return {
    filters: { range, from: toDayKey(from), to: toDayKey(to) },
    kpis: {
      totalSent,
      deliveredRate: pct(delivered, totalSent),
      openRate: pct(opened, totalSent),
      clickRate: pct(clicked, totalSent),
      bounceRate: pct(bounced, totalSent),
      complaintRate: pct(complained, totalSent),
      replyRateAvailable: false,
      replyRate: null,
    },
    thresholds: {
      bounceRateWarnAt: 3,
      complaintRateWarnAt: 0.1,
    },
    trends,
    domainBreakdown,
    failureReasons,
    funnel: {
      sent: totalSent,
      delivered,
      opened,
      clicked,
      bounced,
      complained,
      contacted,
      replied: null,
      dealsOpen: dealsOpen.length,
      dealsWon: dealsWon.length,
      dealsLost: dealsLost.length,
    },
    deals: {
      wonValue: Number(wonValue.toFixed(2)),
      openValue: Number(openValue.toFixed(2)),
      winRate: pct(dealsWon.length, totalClosed),
    },
  };
}
