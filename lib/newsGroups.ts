// ============================================================
//  HOW THE ANNOUNCEMENTS ARE LAID OUT FOR A READER
//
//  Pure functions, no React and no network, so scripts/test-news-feeds.ts
//  pins them with a fixed clock and a fixed time zone.
//
//  THE HOMEPAGE LIST. Seven institutions do not publish daily, so on most
//  days "Today" is empty. The section therefore leads with how recent the
//  newest item is ("Latest: 2 h 10 m ago") and groups the rest as Today /
//  Yesterday / Last 30 days / Coming up, showing only the groups that
//  have something.
//
//  ONE RULE DECIDES "TODAY" VERSUS "COMING UP": the clock, not the date.
//  Anything that has not happened yet is Coming up, even if it is due
//  this afternoon -- it is then labelled "today, 13:30". Today holds only
//  what has already been published.
//
//  Days are the READER's days, in the reader's time zone: "yesterday" in
//  Sydney is not yesterday in London.
// ============================================================

import type { FeedItem } from "@/lib/fetchers/newsFeeds";

export type GroupKey = "today" | "yesterday" | "earlier" | "upcoming";

export interface NewsGroup {
  key: GroupKey;
  label: string;
  items: Array<FeedItem & { when: string }>;
}

const LABELS: Record<GroupKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  earlier: "Last 30 days",
  upcoming: "Coming up",
};

/** Calendar day in a zone, as a number of days since 1970 -- so two
 *  days can be subtracted without daylight saving getting a say. */
function dayNumber(t: number, timeZone: string): number {
  // formatToParts, not a formatted string split on "-": the string's
  // shape is a browser's choice and has changed before.
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" })
    .formatToParts(new Date(t));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Math.round(Date.UTC(part("year"), part("month") - 1, part("day")) / 86_400_000);
}

function clock(t: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(t));
}

function shortDate(t: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short" }).format(new Date(t));
}

/** The label beside one item. Past items in Today and Yesterday carry
 *  the time; older ones the date. Coming up says how soon, in words for
 *  the next week -- "in 17 days" is not a thing anyone holds in their
 *  head, so beyond that it is the date. */
function whenLabel(t: number, key: GroupKey, now: number, timeZone: string): string {
  if (key === "today" || key === "yesterday") return clock(t, timeZone);
  if (key === "earlier") return shortDate(t, timeZone);
  const days = dayNumber(t, timeZone) - dayNumber(now, timeZone);
  if (days === 0) return `today, ${clock(t, timeZone)}`;
  if (days === 1) return `tomorrow, ${clock(t, timeZone)}`;
  if (days <= 6) return `in ${days} days`;
  return shortDate(t, timeZone);
}

export function groupNews(
  items: FeedItem[],
  now: number,
  timeZone: string
): { latest: FeedItem | null; groups: NewsGroup[] } {
  const today = dayNumber(now, timeZone);
  const buckets: Record<GroupKey, NewsGroup["items"]> = { today: [], yesterday: [], earlier: [], upcoming: [] };
  let latest: FeedItem | null = null;

  for (const i of items) {
    const t = Date.parse(i.at);
    if (!Number.isFinite(t)) continue;
    let key: GroupKey;
    if (t > now) key = "upcoming";
    else {
      const ago = today - dayNumber(t, timeZone);
      key = ago <= 0 ? "today" : ago === 1 ? "yesterday" : "earlier";
      if (!latest || t > Date.parse(latest.at)) latest = i;
    }
    buckets[key].push({ ...i, when: whenLabel(t, key, now, timeZone) });
  }

  buckets.upcoming.sort((a, b) => Date.parse(a.at) - Date.parse(b.at)); // soonest first
  for (const k of ["today", "yesterday", "earlier"] as const) {
    buckets[k].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)); // newest first
  }

  const order: GroupKey[] = ["today", "yesterday", "earlier", "upcoming"];
  return {
    latest,
    groups: order.filter((k) => buckets[k].length > 0).map((k) => ({ key: k, label: LABELS[k], items: buckets[k] })),
  };
}

/** Three lines for the strip along the top: the two newest things that
 *  happened and the one soonest to come, topped up from whichever side
 *  has more when the other is short.
 *
 *  NOT the first three of the list. The list is newest-first by date,
 *  and a calendar entry six weeks away has the "newest" date of all --
 *  so the strip would have announced the furthest release first. Past
 *  and future are decided here against `now`, not by the route's label,
 *  because a page left open turns an upcoming item into a past one. */
export function pickTickerFeed(items: FeedItem[], now: number, n = 3): FeedItem[] {
  const past = items
    .filter((i) => Date.parse(i.at) <= now)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((i) => ({ ...i, kind: "announcement" as const }));
  const ahead = items
    .filter((i) => Date.parse(i.at) > now)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((i) => ({ ...i, kind: "upcoming" as const }));

  // One seat is kept for what is coming, if anything is.
  const takePast = Math.min(past.length, n - Math.min(1, ahead.length));
  const takeAhead = Math.min(ahead.length, n - takePast);
  return [...past.slice(0, takePast), ...ahead.slice(0, takeAhead)];
}

/** A key that stays unique when two items share a page: the BLS sends
 *  Employment Situation and Real Earnings to the same /ces/ page, usually
 *  on the same morning. */
export function feedKey(i: FeedItem): string {
  return `${i.url}|${i.at}|${i.title}`;
}
