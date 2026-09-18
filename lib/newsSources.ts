// ============================================================
//  WHERE THE ANNOUNCEMENTS COME FROM
//
//  One row per feed. Adding a source is one entry here plus its licence
//  row in lib/sources.ts -- and the licence lives THERE, not here, because
//  scripts/verify-sources.ts already polices those rows and two copies of
//  a licence is how one of them goes stale.
//
//  WHAT IS NOT HERE, AND WHY. Checked on 18 September 2026, each against
//  the institution's own terms:
//
//    Bank of England   website content needs written permission for
//                      commercial reuse; only its DATABASE is open
//                      licensed, which is why the Bank Rate figure is
//                      fine and the headlines are not.
//    Bank of Japan     "copying or reproduction for commercial purposes"
//                      requires advance permission.
//    Riksbank,         terms do not confirm reuse. The same conclusion
//    Norges Bank       this project reached for their policy rates, which
//                      is why those come via BIS instead.
//    IMF, OECD         block automated readers outright (403).
//    News publishers   The Economist, Reuters, Bloomberg, the FT: their
//                      terms forbid republishing, headlines included.
//
//  A feed is only added here once its terms are read. "It responds" is
//  not a licence.
// ============================================================

export type FeedFormat = "rss" | "ics";

export interface NewsSource {
  /** Stable id, used in tests and to tie back to the licence row. */
  id: string;
  /** Shown beside every item. Every licence here requires attribution. */
  institution: string;
  /** Short label for the strip, where space is measured in pixels. */
  shortName: string;
  url: string;
  format: FeedFormat;
  /** What the items ARE: things that happened, or things scheduled.
   *  Deliberately not called `kind` -- FeedItem.kind already means
   *  "announcement | upcoming" (past vs future) and the ticker reads it. */
  feedKind: "announcement" | "calendar";
  /** Only items whose title matches are kept. A central bank publishes
   *  plenty that has nothing to do with the economy this site scores. */
  keywords?: RegExp;
  /** ...and items matching this are dropped even if they matched above.
   *  The ONS publishes every release twice -- the release itself and its
   *  "time series" companion -- and two identical-looking lines in a news
   *  list reads as a bug. */
  exclude?: RegExp;
  /** At most this many from one feed, so a chatty source cannot crowd
   *  out the rest. The Fed's all-press feed alone carries twenty. */
  cap: number;
}

export const NEWS_SOURCES: NewsSource[] = [
  {
    id: "ecb-press",
    institution: "European Central Bank",
    shortName: "ECB",
    url: "https://www.ecb.europa.eu/rss/press.html",
    format: "rss",
    feedKind: "announcement",
    keywords: /\/press\/pr\/|\/press\/press_conference\//,
    cap: 3,
  },
  {
    id: "ons-calendar",
    institution: "UK Office for National Statistics",
    shortName: "ONS",
    url: "https://www.ons.gov.uk/releasecalendar?rss&release-type=type-upcoming",
    format: "rss",
    feedKind: "calendar",
    keywords: /inflation|labour market|gdp|public sector finances/i,
    exclude: /time series/i,
    cap: 3,
  },
  {
    // Monetary policy only, not the whole press wire: this site is about
    // rates, prices and jobs, and the all-press feed carries bank
    // supervision and enforcement notices as well.
    id: "fed-monetary",
    institution: "US Federal Reserve",
    shortName: "Federal Reserve",
    url: "https://www.federalreserve.gov/feeds/press_monetary.xml",
    format: "rss",
    feedKind: "announcement",
    cap: 3,
  },
  {
    id: "boc-press",
    institution: "Bank of Canada",
    shortName: "Bank of Canada",
    url: "https://www.bankofcanada.ca/content_type/press-releases/feed/",
    format: "rss",
    feedKind: "announcement",
    cap: 2,
  },
  {
    id: "rba-media",
    institution: "Reserve Bank of Australia",
    shortName: "RBA",
    url: "https://www.rba.gov.au/rss/rss-cb-media-releases.xml",
    format: "rss",
    feedKind: "announcement",
    cap: 2,
  },
  {
    id: "ssb-news",
    institution: "Statistics Norway",
    shortName: "Statistics Norway",
    // ?lang=en, because the bare feed is in Norwegian and a Norwegian
    // headline in an English news list is not an announcement, it is a
    // puzzle.
    url: "https://www.ssb.no/rss/?lang=en",
    format: "rss",
    feedKind: "announcement",
    // Tighter than it looks: the bare word "price" pulled in the weekly
    // salmon price, which is a real Norwegian statistic and not macro
    // news. The list is the figures this site actually scores.
    keywords: /consumer price|inflation|unemploy|labour force|labor force|gross domestic|\bgdp\b|interest rate|policy rate|purchasing power/i,
    cap: 2,
  },
  {
    // The only calendar in the set, and the reason the ICS parser exists:
    // it carries every scheduled US release date, which is what "what
    // lands next" is made of.
    id: "bls-calendar",
    institution: "US Bureau of Labor Statistics",
    shortName: "BLS",
    url: "https://www.bls.gov/schedule/news_release/bls.ics",
    format: "ics",
    feedKind: "calendar",
    keywords: /consumer price|employment situation|producer price|real earnings|job openings/i,
    cap: 3,
  },
];

/** Nothing older than this is ever shown. The owner's own words: a news
 *  box carrying last month's headline makes a site look abandoned. */
export const MAX_AGE_DAYS = 30;
/** ...and "coming up" has to mean soon enough to plan around. */
export const MAX_AHEAD_DAYS = 45;
/** However many arrive, this is what a reader is offered. */
export const MAX_ITEMS = 18;
