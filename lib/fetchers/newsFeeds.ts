// ============================================================
//  TWO FEEDS, FROM THE INSTITUTIONS THEMSELVES
//
//  The owner asked whether the ticker could carry news. General news
//  APIs were researched and rejected: nearly all of them forbid
//  republishing headlines, and the ones that do not want a contract --
//  which breaks this project's rule that every source carries a clean,
//  already-granted licence.
//
//  These two do not:
//
//    ECB press releases   reuse permitted, "the ECB must be cited as the
//                         source" (ecb.europa.eu disclaimer, read
//                         2026-09-16)
//    ONS release calendar Crown copyright under the Open Government
//                         Licence v3.0, which grants the right to
//                         "exploit the Information commercially and
//                         non-commercially" with attribution
//
//  WHAT IS DELIBERATELY NOT TAKEN. The ECB feed is mostly speeches and
//  interviews -- eleven of fifteen items on the day this was written.
//  A speech is a person's view; this site publishes figures and the
//  decisions that move them. So only two paths are kept: /press/pr/
//  (press releases, which is where "Monetary policy decisions" lands)
//  and the monetary policy statement. Everything else is dropped.
//
//  The ONS feed is filtered the other way round: of ~25 upcoming
//  releases, the ones this site actually scores are inflation, the
//  labour market, GDP and public sector finances. A ticker announcing
//  "Prison population statistics" would be true and pointless.
// ============================================================

/** Nothing older than this reaches the strip. An announcement from last
 *  month scrolling as if it were this morning is what makes a site look
 *  abandoned -- the same gate lib/tickerEvents.ts applies to figures. */
export const MAX_ANNOUNCEMENT_AGE_DAYS = 21;
/** ...and nothing further ahead than this: "next" should mean soon. */
export const MAX_UPCOMING_DAYS = 21;

export interface FeedItem {
  /** "announcement" has happened; "upcoming" has not. */
  kind: "announcement" | "upcoming";
  /** The institution, shown beside the item -- both licences require it. */
  source: string;
  title: string;
  url: string;
  /** ISO. When it was published, or when it is due. */
  at: string;
}

const TIMEOUT_MS = 8000;

/** RSS 2.0 is regular enough to read without a parser, and a dependency
 *  that runs on every page view to read two feeds is not a trade worth
 *  making. Deliberately strict: an item missing a title, a link or a
 *  date is skipped rather than guessed at. */
export function parseRss(xml: string): { title: string; url: string; at: string }[] {
  const out: { title: string; url: string; at: string }[] = [];
  // Split on the OPENING TAG, attributes and all. RSS 1.0 (which is RDF,
  // and which both the Bank of Canada and the RBA publish) writes
  // <item rdf:about="...">, so splitting on the literal "<item>" found
  // nothing at all and both feeds read as empty.
  for (const block of xml.split(/<item[^>]*>/).slice(1)) {
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
    // RSS 2.0 says pubDate; RSS 1.0 uses Dublin Core's dc:date.
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

async function getText(url: string, what: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/rss+xml, application/xml, text/xml" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status}`);
  const text = await res.text();
  if (!text.includes("<item>")) throw new Error(`${what}: no items in the response`);
  return text;
}

/** ECB rate decisions and monetary policy statements. */
export async function fetchEcbDecisions(now = Date.now()): Promise<FeedItem[]> {
  const xml = await getText("https://www.ecb.europa.eu/rss/press.html", "ECB press feed");
  const cutoff = now - MAX_ANNOUNCEMENT_AGE_DAYS * 86_400_000;

  return parseRss(xml)
    .filter((i) => /\/press\/pr\/|\/press\/press_conference\//.test(i.url))
    .filter((i) => {
      const t = Date.parse(i.at);
      return t >= cutoff && t <= now + 60_000;
    })
    .map((i) => ({ kind: "announcement" as const, source: "ECB", title: i.title, url: i.url, at: i.at }));
}

/** The UK statistics releases this site actually scores, still to come. */
const ONS_WANTED = /consumer price inflation|labour market|gross domestic product|\bgdp\b|public sector finances/i;

export async function fetchOnsUpcoming(now = Date.now()): Promise<FeedItem[]> {
  const xml = await getText(
    "https://www.ons.gov.uk/releasecalendar?rss&release-type=type-upcoming",
    "ONS release calendar",
  );
  const horizon = now + MAX_UPCOMING_DAYS * 86_400_000;

  return parseRss(xml)
    .filter((i) => ONS_WANTED.test(i.title))
    // "time series" duplicates of a release the calendar already lists.
    .filter((i) => !/time series/i.test(i.title))
    .filter((i) => {
      const t = Date.parse(i.at);
      // Already out is not "upcoming", and a year away is not "next".
      return t >= now - 60_000 && t <= horizon;
    })
    .map((i) => ({ kind: "upcoming" as const, source: "ONS", title: i.title, url: i.url, at: i.at }));
}

/**
 * Both feeds, newest first, with a hard cap.
 *
 * NEITHER FEED MAY BREAK THE PAGE. A source that is slow, blocked or
 * malformed produces an empty list, and the strip then carries what it
 * carried before. This is a decoration on a data site, not the data.
 */
export async function fetchAnnouncements(now = Date.now(), limit = 4): Promise<FeedItem[]> {
  const settled = await Promise.allSettled([fetchEcbDecisions(now), fetchOnsUpcoming(now)]);
  const items = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  return items
    .sort((a, b) => {
      // What is coming leads what has happened: a reader can act on the
      // first and only note the second.
      if (a.kind !== b.kind) return a.kind === "upcoming" ? -1 : 1;
      return a.kind === "upcoming"
        ? Date.parse(a.at) - Date.parse(b.at)   // soonest first
        : Date.parse(b.at) - Date.parse(a.at);  // newest first
    })
    .slice(0, limit);
}

// ============================================================
//  EVERY FEED, IN ONE LIST, WITH A DEADLINE
//
//  Seven institutions (lib/newsSources.ts). Each is fetched with its own
//  timeout and all of them under Promise.allSettled, so a slow or dead
//  feed costs the section that feed and nothing else -- never a blank
//  page and never a wait.
//
//  The whole set also has a BUDGET. The strip gives this route four
//  seconds before it gives up and carries no announcements at all, so a
//  cold cache window must not spend seven timeouts in series.
// ============================================================

import { NEWS_SOURCES, MAX_AGE_DAYS, MAX_AHEAD_DAYS, MAX_ITEMS, type NewsSource } from "@/lib/newsSources";

const PER_FEED_MS = 3000;
const TOTAL_BUDGET_MS = 3500;

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

/** US-Eastern, which is what the file says, as a UTC instant. The zone
 *  name in the file ("US-Eastern") is not an IANA name, so it cannot be
 *  handed to Intl directly; America/New_York is the same zone and carries
 *  the daylight-saving rules, which matter -- a 10:00 release is 14:00
 *  UTC in summer and 15:00 in winter. */
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
 *  leading space), then one entry per VEVENT. */
export function parseIcs(text: string, source: NewsSource): Array<{ title: string; url: string; at: string }> {
  const unfolded = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const out: Array<{ title: string; url: string; at: string }> = [];
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
    const url = source.id === "bls-calendar"
      ? BLS_PAGES.find(([re]) => re.test(title))?.[1] ?? BLS_SCHEDULE
      : BLS_SCHEDULE;
    out.push({ title, url, at });
  }
  return out;
}

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
  const text = await res.text();

  // RSS or Atom: the Bank of Canada and the RBA publish Atom, which has
  // <entry>, <link href="..."> and <updated> where RSS has <item>, <link>
  // and <pubDate>. Both were silently read as empty until this existed.
  const raw =
    source.format === "ics" ? parseIcs(text, source) : text.includes("<entry") ? parseAtom(text) : parseRss(text);
  const kept = raw
    .filter((r) => !source.keywords || source.keywords.test(r.title) || source.keywords.test(r.url))
    .filter((r) => !source.exclude || !source.exclude.test(r.title));
  return kept.map((r) => ({
    kind: "announcement" as const, // corrected against the clock below
    source: source.shortName,
    title: r.title,
    url: r.url,
    at: r.at,
  }));
}

export interface NewsResult {
  items: FeedItem[];
  /** False when every feed failed. The section says so rather than
   *  showing an empty box that looks like "nothing is happening". */
  reachable: boolean;
  /** When this was put together, so the page can say "checked 2m ago"
   *  even on a day when no institution published anything. */
  checkedAt: string;
}

/** Everything, cleaned, bucketed by the caller. */
export async function fetchAllNews(now = Date.now()): Promise<NewsResult> {
  const deadline = now + TOTAL_BUDGET_MS;
  const settled = await Promise.allSettled(
    NEWS_SOURCES.map(async (s) => ({ source: s, items: await fetchOne(s, deadline) }))
  );

  let anyReached = false;
  const collected: FeedItem[] = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    anyReached = true;
    const { source, items } = r.value;
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
  const items = collected
    .map((i) => ({ ...i, kind: Date.parse(i.at) > now ? ("upcoming" as const) : ("announcement" as const) }))
    .filter((i) => {
      const key = `${i.url}|${i.title.toLowerCase().replace(/\W+/g, " ").trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, MAX_ITEMS);

  return { items, reachable: anyReached, checkedAt: new Date(now).toISOString() };
}

/** Atom, which the Bank of Canada and the RBA publish instead of RSS.
 *  Same three facts, different names: <entry> for <item>, a link in an
 *  href attribute rather than as text, and <updated> or <published> for
 *  <pubDate>. */
export function parseAtom(xml: string): { title: string; url: string; at: string }[] {
  const out: { title: string; url: string; at: string }[] = [];
  for (const block of xml.split("<entry").slice(1)) {
    const entry = block.split("</entry>")[0];
    const title = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1];
    // The alternate link is the human page; an entry can also carry
    // "self" or "enclosure" links, which are not what a reader wants.
    const url =
      entry.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/)?.[1] ?? entry.match(/<link[^>]*href="([^"]+)"/)?.[1];
    const date = entry.match(/<(?:published|updated)>([^<]+)</)?.[1];
    if (!title || !url || !date) continue;
    const t = Date.parse(date);
    if (!Number.isFinite(t)) continue;
    out.push({ title: decode(title.trim()), url, at: new Date(t).toISOString() });
  }
  return out;
}
