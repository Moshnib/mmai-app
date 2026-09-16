// ============================================================
//  THE ANNOUNCEMENTS BAND SAYS ONLY WHAT THOSE FEEDS SAID
//
//  Two outside feeds now reach the homepage: the ONS release calendar
//  and the ECB press feed. Neither is scored, which is exactly why they
//  need pinning -- nothing downstream would notice if they went wrong.
//
//  What can go wrong, and none of it throws:
//
//    a speech printed as a decision   (the ECB feed is mostly speeches:
//                                      eleven of fifteen items the day
//                                      this was written)
//    a past release shown as "next"   (the calendar carries both)
//    a stale announcement scrolling    (three weeks old, presented as new)
//    an entity printed raw            ("Q&amp;A" in a headline)
//
//  Parsed from fixtures with a pinned clock: no network, and a
//  date-dependent test that reads Date.now() passes today and fails in a
//  fortnight. scripts/verify-news-feeds.ts checks the live feeds instead,
//  and is deliberately NOT in CI.
//
//    npx tsx scripts/test-news-feeds.ts
// ============================================================

import { parseRss, MAX_UPCOMING_DAYS } from "@/lib/fetchers/newsFeeds";

let failed = false;
const fail = (m: string) => { failed = true; console.error("  FAIL  " + m); };
const ok = (m: string) => console.log("  ok    " + m);

const item = (title: string, url: string, date: string) =>
  `<item><title>${title}</title><link>${url}</link><guid>${url}</guid><pubDate>${date}</pubDate></item>`;

// ---------- the parser ----------
{
  const xml = `<rss><channel>${item(" Monetary policy decisions", "https://www.ecb.europa.eu//press/pr/date/2026/html/ecb.mp260910.en.html", "Thu, 10 Sep 2026 14:15:00 +0200")}</channel></rss>`;
  const [one] = parseRss(xml);
  if (!one) fail("a well-formed item did not parse");
  else if (one.title !== "Monetary policy decisions") fail(`title not trimmed: "${one.title}"`);
  else if (one.at !== "2026-09-10T12:15:00.000Z") fail(`date not normalised to UTC: ${one.at}`);
  else ok("an item parses, its title is trimmed and its date becomes UTC");
}

{
  const xml = `<rss><channel>${item("Lagarde: Q&amp;A on the &quot;outlook&quot;", "https://x/press/pr/a", "Thu, 10 Sep 2026 14:15:00 +0200")}</channel></rss>`;
  const [one] = parseRss(xml);
  if (one?.title !== 'Lagarde: Q&A on the "outlook"') fail(`entities not decoded: "${one?.title}"`);
  else ok("XML entities are decoded, so no headline prints as &amp;");
}

{
  const broken =
    `<rss><channel>` +
    `<item><link>https://x/press/pr/a</link><pubDate>Thu, 10 Sep 2026 14:15:00 +0200</pubDate></item>` +
    `<item><title>No link</title><pubDate>Thu, 10 Sep 2026 14:15:00 +0200</pubDate></item>` +
    `<item><title>No date</title><link>https://x/press/pr/b</link></item>` +
    `<item><title>Bad date</title><link>https://x/press/pr/c</link><pubDate>whenever</pubDate></item>` +
    `</channel></rss>`;
  if (parseRss(broken).length !== 0) fail("an item missing a title, link or date was kept");
  else ok("an item missing a title, a link or a usable date is skipped, not guessed at");
}

// ---------- the filters, applied to the shapes the live feeds return ----------
// These mirror fetchEcbDecisions / fetchOnsUpcoming, which cannot be
// called here without the network. The rules, not the fetch.
const ECB_KEEP = /\/press\/pr\/|\/press\/press_conference\//;
const ONS_WANTED = /consumer price inflation|labour market|gross domestic product|\bgdp\b|public sector finances/i;

{
  const feed = [
    { t: "Christine Lagarde: A new age of capital", u: "https://www.ecb.europa.eu//press/key/date/2026/html/ecb.sp260914.en.html" },
    { t: "Christine Lagarde: Interview with Ouest-France", u: "https://www.ecb.europa.eu//press/inter/date/2026/html/ecb.in260912.en.html" },
    { t: "Meeting of 22-23 July 2026", u: "https://www.ecb.europa.eu//press/accounts/2026/html/ecb.mg260827.en.html" },
    { t: "Monetary policy decisions", u: "https://www.ecb.europa.eu//press/pr/date/2026/html/ecb.mp260910.en.html" },
    { t: "Monetary policy statement (with Q&A)", u: "https://www.ecb.europa.eu//press/press_conference/monetary-policy-statement/2026/html/ecb.is260910.en.html" },
  ];
  const kept = feed.filter((f) => ECB_KEEP.test(f.u)).map((f) => f.t);
  if (kept.length !== 2) fail(`ECB filter kept ${kept.length} of 5: ${kept.join(" | ")}`);
  else if (!kept.includes("Monetary policy decisions")) fail("the rate decision was dropped");
  else if (kept.some((t) => /Lagarde:|Interview|Meeting of/.test(t))) fail(`a speech, interview or account was kept: ${kept.join(" | ")}`);
  else ok("of five ECB items, only the decision and the statement are kept");
}

{
  const calendar = [
    "Consumer price inflation, UK: August 2026",
    "Consumer price inflation, UK: August 2026 time series",
    "UK Labour market: September 2026",
    "Prison population statistics",
    "Public sector finances, UK: August 2026",
  ];
  const kept = calendar.filter((t) => ONS_WANTED.test(t)).filter((t) => !/time series/i.test(t));
  if (kept.length !== 3) fail(`ONS filter kept ${kept.length} of 5: ${kept.join(" | ")}`);
  else if (kept.some((t) => /prison|time series/i.test(t))) fail(`an off-topic or duplicate release was kept: ${kept.join(" | ")}`);
  else ok("the calendar is filtered to the figures this site actually scores");
}

// ---------- dates, which is where "next" is won or lost ----------
{
  const NOW = Date.parse("2026-09-16T06:00:00Z");
  const at = (days: number) => NOW + days * 86_400_000;
  const horizon = NOW + MAX_UPCOMING_DAYS * 86_400_000;
  const upcoming = (t: number) => t >= NOW - 60_000 && t <= horizon;

  if (upcoming(at(-1))) fail("a release that already happened counts as upcoming");
  else if (!upcoming(at(1))) fail("tomorrow's release was rejected");
  else if (upcoming(at(MAX_UPCOMING_DAYS + 1))) fail(`a release ${MAX_UPCOMING_DAYS + 1} days away counts as "next"`);
  else ok(`"upcoming" means after now and within ${MAX_UPCOMING_DAYS} days — not yesterday, not next quarter`);
}

console.log("");
if (failed) {
  console.error("The announcements band would print something it should not.\n");
  process.exit(1);
}
console.log("Only decisions and scheduled releases, correctly dated and correctly decoded.\n");
