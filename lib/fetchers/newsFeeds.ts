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
  for (const block of xml.split("<item>").slice(1)) {
    const item = block.split("</item>")[0];
    const pick = (tag: string) => {
      const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return m ? decode(m[1].trim()) : null;
    };
    const title = pick("title");
    const url = pick("link");
    const date = pick("pubDate");
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
