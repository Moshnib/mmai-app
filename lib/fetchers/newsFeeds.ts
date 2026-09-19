// ============================================================
//  ANNOUNCEMENTS, FROM THE INSTITUTIONS THEMSELVES
//
//  The owner asked whether the ticker could carry news. General news
//  APIs were researched and rejected: nearly all of them forbid
//  republishing headlines, and the ones that do not want a contract --
//  which breaks this project's rule that every source carries a clean,
//  already-granted licence.
//
//  So every line comes from a central bank or a statistics office, read
//  from its own feed. Which ones, and why the others are not here, is
//  lib/newsSources.ts; each one's licence is its row in lib/sources.ts.
//
//  Two halves, deliberately apart:
//    fetchAllNews   the network: one request per source, each with its
//                   own timeout, the whole set under one budget
//    assembleNews   everything after: windows, caps, duplicates, order.
//                   Pure, so scripts/test-news-feeds.ts can pin it with
//                   fixtures and a fixed clock, no network.
// ============================================================

import { NEWS_SOURCES, MAX_AGE_DAYS, MAX_AHEAD_DAYS, MAX_ITEMS, type NewsSource } from "@/lib/newsSources";

export interface FeedItem {
  /** "announcement" has happened; "upcoming" has not. */
  kind: "announcement" | "upcoming";
  /** The institution's short name, shown beside every item -- every
   *  licence behind these feeds requires the institution to be named. */
  source: string;
  /** ...and its full name, for the label's tooltip. */
  institution: string;
  title: string;
  url: string;
  /** ISO. When it was published, or when it is due. */
  at: string;
}

type Raw = { title: string; url: string; at: string };

/** RSS is regular enough to read without a parser, and a dependency that
 *  runs on every cache refresh to read seven feeds is not a trade worth
 *  making. Deliberately strict: an item missing a title, a link or a date
 *  is skipped rather than guessed at.
 *
 *  Reads both flavours in use. RSS 2.0 (the ECB, the ONS, the Fed,
 *  Statistics Norway) writes <item> and <pubDate>. RSS 1.0, which is RDF
 *  and which the Bank of Canada and the RBA publish -- checked against
 *  both live feeds on 18 September 2026 -- writes <item rdf:about="...">
 *  and Dublin Core's <dc:date>. Splitting on the literal "<item>" found
 *  nothing in those two, and both read as empty. */
export function parseRss(xml: string): Raw[] {
  const out: Raw[] = [];
  // "<item>" or "<item attr...>", but never RDF's channel-level <items>.
  for (const block of xml.split(/<item(?:\s[^>]*)?>/).slice(1)) {
    const item = block.split("</item>")[0];
    const pick = (tag: string) => {
      // Two backslashes each, because this is a template literal: inside
      // one, "\s" is just "s", and the class silently becomes [sS] --
      // which matches no feed at all and reads as "the source is down".
      const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return m ? decode(m[1].trim()) : null;
    };
    const title = pick("title");
    const url = pick("link");
    const date = pick("pubDate") ?? pick("dc:date");
    if (!title || !url || !date) continue;
    const t = Date.parse(date);
    if (!Number.isFinite(t)) continue;
    out.push({ title, url, at: new Date(t).toISOString() });
  }
  return out;
}

/** The five entities RSS actually carries, plus CDATA. Nothing here is
 *  rendered as HTML -- it goes into a text node -- so this is about the
 *  title reading correctly, not about safety. */
function decode(s: string): string {
  return s
    .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#3[49];|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** The BLS calendar names each release but carries no link of its own --
 *  verified against the live file, whose VEVENTs hold SUMMARY, DTSTART
 *  and LOCATION and nothing else. Rather than drop the link (and with it
 *  the promise that a headline goes to the institution's own page), each
 *  release we keep is mapped to the page BLS publishes it on. Anything
 *  unmapped falls back to the schedule itself, which is still the
 *  institution's own page and still answers "when". */
const BLS_PAGES: Array<[RegExp, string]> = [
  [/consumer price/i, "https://www.bls.gov/cpi/"],
  [/producer price/i, "https://www.bls.gov/ppi/"],
  [/employment situation/i, "https://www.bls.gov/ces/"],
  [/job openings/i, "https://www.bls.gov/jlt/"],
  [/real earnings/i, "https://www.bls.gov/ces/"],
];
const BLS_SCHEDULE = "https://www.bls.gov/schedule/news_release/";

export function blsPageFor(title: string): string {
  return BLS_PAGES.find(([re]) => re.test(title))?.[1] ?? BLS_SCHEDULE;
}

/** US-Eastern, which is what the file says, as a UTC instant. The zone
 *  name in the file ("US-Eastern") is not an IANA name, so it cannot be
 *  handed to Intl directly; America/New_York is the same zone and carries
 *  the daylight-saving rules, which matter -- an 08:30 release is 12:30
 *  UTC in summer and 13:30 in winter. */
function easternToIso(y: number, mo: number, d: number, h: number, mi: number): string {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
  }).format(new Date(guess));
  const m = label.match(/GMT([+-]\d+)/);
  const offsetHours = m ? Number(m[1]) : -5;
  return new Date(guess - offsetHours * 3_600_000).toISOString();
}

/** iCalendar, as much of it as a release calendar uses: folded lines
 *  rejoined first (RFC 5545 wraps at 75 octets and continues with a
 *  leading space), then one entry per VEVENT.
 *
 *  A calendar entry carries no link, so the caller says where each one
 *  should point (`linkFor`). Only the BLS calendar is read today, and
 *  fetchOne refuses any other: a headline with no page of its own to go
 *  to breaks the promise every other line on the site keeps. */
export function parseIcs(text: string, linkFor: (title: string) => string): Raw[] {
  const unfolded = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const out: Raw[] = [];
  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0];
    const summary = body.match(/\nSUMMARY:([^\r\n]+)/)?.[1];
    const start = body.match(/\nDTSTART[^:]*:(\d{8})(?:T(\d{2})(\d{2}))?/);
    if (!summary || !start) continue;
    const date = start[1];
    const at = easternToIso(
      Number(date.slice(0, 4)),
      Number(date.slice(4, 6)),
      Number(date.slice(6, 8)),
      Number(start[2] ?? "10"),
      Number(start[3] ?? "00")
    );
    // Backslash escapes are iCalendar's own: "Washington\, DC".
    const title = summary.replace(/\\([,;\\])/g, "$1").trim();
    out.push({ title, url: linkFor(title), at });
  }
  return out;
}

/** One source's items, parsed and filtered to what this site is about.
 *  The format comes from the registry, never from sniffing the content:
 *  a feed whose text happens to contain "<entry" is still RSS. */
export function readFeed(text: string, source: NewsSource): FeedItem[] {
  let raw: Raw[];
  if (source.format === "ics") {
    if (source.id !== "bls-calendar") throw new Error(`${source.id}: no link map for this calendar`);
    raw = parseIcs(text, blsPageFor);
  } else {
    raw = parseRss(text);
  }
  return raw
    .filter((r) => !source.keywords || source.keywords.test(r.title) || source.keywords.test(r.url))
    .filter((r) => !source.exclude || !source.exclude.test(r.title))
    .map((r) => ({
      kind: "announcement" as const, // set against the clock in assembleNews
      source: source.shortName,
      institution: source.institution,
      title: r.title,
      url: r.url,
      at: r.at,
    }));
}

/**
 * Every source's items, cleaned into one list, newest first.
 *
 * NO SOURCE MAY CROWD OUT THE REST: each is windowed and capped on its own
 * before the lists meet.
 */
export function assembleNews(results: Array<{ source: NewsSource; items: FeedItem[] }>, now: number): FeedItem[] {
  const collected: FeedItem[] = [];
  for (const { source, items } of results) {
    const withinWindow = items.filter((i) => {
      const t = Date.parse(i.at);
      if (!Number.isFinite(t)) return false;
      // A CALENDAR only says what is coming. Its past entries are not
      // news -- "Producer Price Index, 8 days ago" tells a reader
      // nothing, and the release itself is carried by the institution's
      // own announcement feed.
      if (source.feedKind === "calendar" && t <= now) return false;
      // A day's grace on the old end: the cutoff runs here in UTC and the
      // labels run in the reader's own zone, and without it an item can
      // vanish while still reading as "yesterday" in Sydney.
      return t > now - (MAX_AGE_DAYS + 1) * 86_400_000 && t < now + MAX_AHEAD_DAYS * 86_400_000;
    });
    // Newest first for things that happened; soonest first for things
    // that have not.
    withinWindow.sort((a, b) =>
      source.feedKind === "calendar" ? Date.parse(a.at) - Date.parse(b.at) : Date.parse(b.at) - Date.parse(a.at)
    );
    collected.push(...withinWindow.slice(0, source.cap));
  }

  const seen = new Set<string>();
  return collected
    .map((i) => ({ ...i, kind: Date.parse(i.at) > now ? ("upcoming" as const) : ("announcement" as const) }))
    .filter((i) => {
      const key = `${i.url}|${i.title.toLowerCase().replace(/\W+/g, " ").trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, MAX_ITEMS);
}

// ============================================================
//  THE NETWORK HALF, WITH A DEADLINE
//
//  Each source is fetched with its own timeout and all of them under
//  Promise.allSettled, so a slow or dead feed costs the section that feed
//  and nothing else -- never a blank page and never a wait.
//
//  The whole set also has a BUDGET. The strip gives the route four
//  seconds before it starts without announcements, so a cold cache
//  window must not spend seven timeouts in series.
// ============================================================

const PER_FEED_MS = 3000;
const TOTAL_BUDGET_MS = 3500;

async function fetchOne(source: NewsSource, deadline: number): Promise<FeedItem[]> {
  const left = Math.min(PER_FEED_MS, deadline - Date.now());
  if (left <= 0) throw new Error(`${source.id}: no time left in this window`);
  const res = await fetch(source.url, {
    signal: AbortSignal.timeout(left),
    headers: {
      // BLS answers 403 without one, and a request that says who it is
      // and how to reach the site is the polite form anyway.
      "user-agent": "Mozilla/5.0 (compatible; MMAI/1.0; +https://www.mmai.markets)",
      accept: source.format === "ics" ? "text/calendar" : "application/rss+xml, application/xml, text/xml",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`${source.id}: HTTP ${res.status}`);
  return readFeed(await res.text(), source);
}

export interface NewsResult {
  items: FeedItem[];
  /** False when every feed failed. */
  reachable: boolean;
  /** When this was put together. */
  checkedAt: string;
}

/** Every feed, read now. The deadline is the real clock's, not `now`'s:
 *  `now` decides which items count as recent, and a caller passing a
 *  pinned date must not thereby leave every fetch with no time left. */
export async function fetchAllNews(now = Date.now()): Promise<NewsResult> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const settled = await Promise.allSettled(
    NEWS_SOURCES.map(async (source) => ({ source, items: await fetchOne(source, deadline) }))
  );
  const reached = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  return {
    items: assembleNews(reached, now),
    reachable: reached.length > 0,
    checkedAt: new Date(now).toISOString(),
  };
}
