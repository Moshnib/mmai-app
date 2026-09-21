// ============================================================
//  THE NEWS BAND SAYS ONLY WHAT THE INSTITUTIONS SAID
//
//  Nine outside feeds reach the homepage and the strip along the top
//  (lib/newsSources.ts). None of them is scored, which is exactly why
//  they need pinning -- nothing downstream would notice if they went
//  wrong. What can go wrong, and none of it throws:
//
//    a feed read as empty           (RSS 1.0 writes <item rdf:about=...>
//                                    and <dc:date>; the Bank of Canada
//                                    and the RBA both do)
//    a speech printed as a decision (the ECB feed is mostly speeches)
//    a past release shown as "next" (a calendar carries both)
//    a release at the wrong hour    (US-Eastern shifts with daylight
//                                    saving; the file does not say so)
//    a stale item presented as new  (older than the 30-day window)
//    one chatty feed crowding out the rest
//    the strip announcing the FURTHEST release first
//    something due this afternoon filed under "Today" as if it happened
//
//  Fixtures and a pinned clock, no network: a test that reads Date.now()
//  passes today and fails in a fortnight. Rules are read from the real
//  registry, never copied into this file, so a changed filter is tested
//  as it is, not as it was.
//
//    npx tsx scripts/test-news-feeds.ts
// ============================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseRss, parseIcs, parseAtom, safeLink, readFeed, assembleNews, blsPageFor, type FeedItem } from "@/lib/fetchers/newsFeeds";
import { groupNews, pickTickerFeed, feedKey } from "@/lib/newsGroups";
import { NEWS_SOURCES, MAX_AGE_DAYS, MAX_AHEAD_DAYS, MAX_ITEMS, type NewsSource } from "@/lib/newsSources";

let failed = false;
const fail = (m: string) => { failed = true; console.error("  FAIL  " + m); };
const ok = (m: string) => console.log("  ok    " + m);
const check = (cond: boolean, pass: string, why: string) => (cond ? ok(pass) : fail(why));

const src = (id: string): NewsSource => {
  const s = NEWS_SOURCES.find((x) => x.id === id);
  if (!s) throw new Error(`no source ${id} in the registry`);
  return s;
};
const rss = (items: string) => `<rss version="2.0"><channel><title>Feed</title>${items}</channel></rss>`;
const item = (title: string, url: string, date: string) =>
  `<item><title>${title}</title><link>${url}</link><guid>${url}</guid><pubDate>${date}</pubDate></item>`;

// ---------- RSS 2.0 ----------
{
  const [one] = parseRss(rss(item(" Monetary policy decisions", "https://www.ecb.europa.eu//press/pr/date/2026/html/ecb.mp260910.en.html", "Thu, 10 Sep 2026 14:15:00 +0200")));
  check(
    one?.title === "Monetary policy decisions" && one?.at === "2026-09-10T12:15:00.000Z",
    "an RSS 2.0 item parses, its title is trimmed and its date becomes UTC",
    `RSS 2.0 item parsed as ${JSON.stringify(one)}`
  );
}
{
  const [one] = parseRss(rss(item("Lagarde: Q&amp;A on the &quot;outlook&quot;", "https://x/press/pr/a", "Thu, 10 Sep 2026 14:15:00 +0200")));
  check(one?.title === 'Lagarde: Q&A on the "outlook"', "XML entities are decoded, so no headline prints as &amp;", `entities not decoded: "${one?.title}"`);
}
{
  const broken = rss(
    `<item><link>https://x/a</link><pubDate>Thu, 10 Sep 2026 14:15:00 +0200</pubDate></item>` +
    `<item><title>No link</title><pubDate>Thu, 10 Sep 2026 14:15:00 +0200</pubDate></item>` +
    `<item><title>No date</title><link>https://x/b</link></item>` +
    `<item><title>Bad date</title><link>https://x/c</link><pubDate>whenever</pubDate></item>`
  );
  check(parseRss(broken).length === 0, "an item missing a title, a link or a usable date is skipped, not guessed at", "an incomplete item was kept");
}

// ---------- RSS 1.0 / RDF, the shape the Bank of Canada and the RBA serve ----------
{
  const rdf =
    `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">` +
    `<channel rdf:about="https://www.rba.gov.au/"><title>RBA</title><link>https://www.rba.gov.au/</link>` +
    `<items><rdf:Seq><rdf:li rdf:resource="https://www.rba.gov.au/media-releases/2026/mr-26-25.html"/></rdf:Seq></items></channel>` +
    `<item rdf:about="https://www.rba.gov.au/media-releases/2026/mr-26-25.html">` +
    `<title>Statement by the Monetary Policy Board: Monetary Policy Decision</title>` +
    `<link>https://www.rba.gov.au/media-releases/2026/mr-26-25.html</link>` +
    `<dc:date>2026-09-15T14:30:00+10:00</dc:date></item></rdf:RDF>`;
  const got = parseRss(rdf);
  check(
    got.length === 1 && got[0].at === "2026-09-15T04:30:00.000Z" && got[0].title.startsWith("Statement by"),
    "RSS 1.0 parses: <item rdf:about> is an item, <dc:date> is its date, the channel's <items> is not",
    `RDF parsed as ${JSON.stringify(got)}`
  );
}

// ---------- iCalendar, the BLS release schedule ----------
{
  const ics = [
    "BEGIN:VCALENDAR",
    "X-WR-TIMEZONE:US-Eastern",
    "BEGIN:VEVENT",
    "DTSTART;TZID=US-Eastern:20260911T083000",
    "SUMMARY:Consumer Price Index for August 2026",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART;TZID=US-Eastern:20261210T083000",
    "SUMMARY:Producer Price Index for November 2026\\, final",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART;TZID=US-Eastern:20261002T083000",
    "SUMMARY:The Employment Situation for Septem",
    " ber 2026",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const got = parseIcs(ics, blsPageFor);
  const cpi = got.find((g) => g.title.startsWith("Consumer Price"));
  const ppi = got.find((g) => g.title.startsWith("Producer Price"));
  const emp = got.find((g) => g.title.startsWith("The Employment"));
  check(cpi?.at === "2026-09-11T12:30:00.000Z", "08:30 Eastern in September is 12:30 UTC (daylight saving)", `September release at ${cpi?.at}`);
  check(ppi?.at === "2026-12-10T13:30:00.000Z", "08:30 Eastern in December is 13:30 UTC (standard time)", `December release at ${ppi?.at}`);
  check(ppi?.title === "Producer Price Index for November 2026, final", "iCalendar's own escapes are undone (\\, becomes ,)", `escaped title: "${ppi?.title}"`);
  check(emp?.title === "The Employment Situation for September 2026", "a folded line is rejoined before it is read", `folded title: "${emp?.title}"`);
  check(
    cpi?.url === "https://www.bls.gov/cpi/" && emp?.url === "https://www.bls.gov/ces/" && blsPageFor("Something new") === "https://www.bls.gov/schedule/news_release/",
    "each BLS release links to its own page, anything unmapped to the schedule",
    `links: ${cpi?.url} / ${emp?.url} / ${blsPageFor("Something new")}`
  );
  let refused = false;
  try { readFeed(ics, { ...src("bls-calendar"), id: "some-other-calendar" }); } catch { refused = true; }
  check(refused, "a calendar with no link map of its own is refused, not pointed at the BLS", "a non-BLS calendar was read with BLS links");
}

// ---------- the registry's own filters, on the shapes the live feeds return ----------
{
  const ecb = rss([
    item("Christine Lagarde: A new age of capital", "https://www.ecb.europa.eu//press/key/date/2026/html/ecb.sp260914.en.html", "Mon, 14 Sep 2026 09:00:00 +0200"),
    item("Christine Lagarde: Interview with Ouest-France", "https://www.ecb.europa.eu//press/inter/date/2026/html/ecb.in260912.en.html", "Sat, 12 Sep 2026 09:00:00 +0200"),
    item("Meeting of 22-23 July 2026", "https://www.ecb.europa.eu//press/accounts/2026/html/ecb.mg260827.en.html", "Thu, 27 Aug 2026 13:30:00 +0200"),
    item("Monetary policy decisions", "https://www.ecb.europa.eu//press/pr/date/2026/html/ecb.mp260910.en.html", "Thu, 10 Sep 2026 14:15:00 +0200"),
    item("Monetary policy statement (with Q&amp;A)", "https://www.ecb.europa.eu//press/press_conference/monetary-policy-statement/2026/html/ecb.is260910.en.html", "Thu, 10 Sep 2026 14:45:00 +0200"),
  ].join(""));
  const kept = readFeed(ecb, src("ecb-press")).map((i) => i.title);
  check(
    kept.length === 2 && kept.includes("Monetary policy decisions") && !kept.some((t) => /Lagarde:|Meeting of/.test(t)),
    "of five ECB items, only the decision and the statement are kept",
    `ECB kept: ${kept.join(" | ")}`
  );
  const one = readFeed(ecb, src("ecb-press"))[0];
  check(one?.source === "ECB" && one?.institution === "European Central Bank", "every item carries the institution's name, as its licence requires", `item attributed as ${one?.source} / ${one?.institution}`);
}
{
  const d = "Wed, 23 Sep 2026 07:00:00 +0100";
  const ons = rss([
    item("Consumer price inflation, UK: August 2026", "https://www.ons.gov.uk/a", d),
    item("Consumer price inflation, UK: August 2026 time series", "https://www.ons.gov.uk/b", d),
    item("UK Labour market: September 2026", "https://www.ons.gov.uk/c", d),
    item("Prison population statistics", "https://www.ons.gov.uk/d", d),
  ].join(""));
  const kept = readFeed(ons, src("ons-calendar")).map((i) => i.title);
  check(
    kept.length === 2 && !kept.some((t) => /prison|time series/i.test(t)),
    "the ONS calendar keeps the figures this site scores, once each",
    `ONS kept: ${kept.join(" | ")}`
  );
}
{
  const d = "Thu, 10 Sep 2026 08:00:00 +0200";
  const ssb = rss([
    item("Consumer price index, August 2026", "https://www.ssb.no/en/a", d),
    item("Export of salmon, week 37 2026: Salmon price NOK 68.20 per kilo", "https://www.ssb.no/en/b", d),
    item("Labour force survey, August 2026", "https://www.ssb.no/en/c", d),
  ].join(""));
  const kept = readFeed(ssb, src("ssb-news")).map((i) => i.title);
  check(kept.length === 2 && !kept.some((t) => /salmon/i.test(t)), "Statistics Norway's weekly salmon price is not macro news", `SSB kept: ${kept.join(" | ")}`);
}

{
  // Real titles from the live feed, 18 September 2026.
  const d = "2026-09-10T13:45:00Z";
  const rdfItem = (t: string, n: number) =>
    `<item rdf:about="https://www.bankofcanada.ca/${n}/"><title>${t}</title><link>https://www.bankofcanada.ca/${n}/</link><dc:date>${d}</dc:date></item>`;
  const boc = `<rdf:RDF>${[
    "Bank of Canada maintains the policy rate at 2¼%",
    "Bank of Canada publishes its 2027 schedule for policy interest rate announcements and other major publications",
    "Bank of Canada publishes report on  monetary policy framework consultations",
    "Bank of Canada unveils new vertical $20 bank note",
    "Bank of Canada Board launches process to fill external Deputy Governor position",
    "Bank of Canada Museum honours two Canadian educators for innovation in the classroom",
    "G7 2026 Cross-Border Coordination Exercise (CBCE)",
  ].map(rdfItem).join("")}</rdf:RDF>`;
  const kept = readFeed(boc, src("boc-press")).map((i) => i.title);
  check(
    kept.length === 3 && kept.some((t) => /maintains the policy rate/.test(t)) && !kept.some((t) => /bank note|Museum|Deputy|G7/.test(t)),
    "the Bank of Canada keeps rate decisions and policy reports, not bank notes or vacancies",
    `Bank of Canada kept: ${kept.join(" | ")}`
  );
}
{
  // Real titles from rba.gov.au/media-releases, 2024-2026.
  const d = "2026-08-11T04:30:00Z";
  const rdfItem = (t: string, n: number) =>
    `<item rdf:about="https://www.rba.gov.au/${n}.html"><title>${t}</title><link>https://www.rba.gov.au/${n}.html</link><dc:date>${d}</dc:date></item>`;
  const rba = `<rdf:RDF>${[
    "Statement by the Monetary Policy Board: Monetary Policy Decision",
    "Release of Financial Stability Review – March 2026",
    "Statement from the Governor of the Reserve Bank of Australia",
    "Appointment to the Monetary Policy Board",
    "Designation of Linfox Armaguard Pty Ltd under the Cash Distribution Framework Act 2026",
    "Payments System Board Update: August 2026 Meeting",
    "$5 Banknote Theme Celebrates First Nations Connection to Country",
    "Staff Appointment",
  ].map(rdfItem).join("")}</rdf:RDF>`;
  const kept = readFeed(rba, src("rba-media")).map((i) => i.title);
  check(
    kept.length === 3 && kept[0].includes("Monetary Policy Decision") && !kept.some((t) => /Appointment|Armaguard|Payments System|Banknote/.test(t)),
    "the RBA keeps the rate decision, the stability review and the Governor, not appointments or payments notices",
    `RBA kept: ${kept.join(" | ")}`
  );
}

// ---------- assembling one list from seven ----------
const NOW = Date.parse("2026-09-18T10:00:00Z");
const DAY = 86_400_000;
const fi = (source: string, title: string, at: number, url = `https://x/${encodeURIComponent(title)}`): FeedItem => ({
  kind: "announcement", source, institution: source, title, url, at: new Date(at).toISOString(),
});
{
  const bls = src("bls-calendar");
  const got = assembleNews([{ source: bls, items: [fi("BLS", "CPI already out", NOW - 2 * DAY), fi("BLS", "PPI next week", NOW + 7 * DAY)] }], NOW);
  check(got.length === 1 && got[0].title === "PPI next week" && got[0].kind === "upcoming", "a calendar's past entries are dropped; what is left is upcoming", `calendar gave ${JSON.stringify(got.map((g) => g.title))}`);
}
{
  const fed = src("fed-monetary");
  const got = assembleNews([{ source: fed, items: [
    fi("Federal Reserve", "Recent", NOW - 3 * DAY),
    fi("Federal Reserve", "Too old", NOW - (MAX_AGE_DAYS + 2) * DAY),
    fi("Federal Reserve", "Too far ahead", NOW + (MAX_AHEAD_DAYS + 1) * DAY),
  ] }], NOW).map((g) => g.title);
  check(got.length === 1 && got[0] === "Recent", `nothing older than ${MAX_AGE_DAYS} days or further than ${MAX_AHEAD_DAYS} ahead`, `window kept ${got.join(" | ")}`);
}
{
  const fed = src("fed-monetary");
  const many = Array.from({ length: 10 }, (_, n) => fi("Federal Reserve", `Release ${n}`, NOW - n * 3_600_000));
  const got = assembleNews([{ source: fed, items: many }], NOW);
  check(got.length === fed.cap && got[0].title === "Release 0", `one chatty feed is held to its cap of ${fed.cap}, newest first`, `the Fed filled ${got.length} slots`);
}
{
  const boc = src("boc-press");
  const twin = fi("Bank of Canada", "Bank of Canada maintains policy rate", NOW - DAY, "https://boc/a");
  const got = assembleNews([{ source: boc, items: [twin, { ...twin, title: "Bank of Canada maintains policy rate." }] }], NOW);
  check(got.length === 1, "the same item twice is shown once", `duplicate gave ${got.length} items`);
}
{
  const results = NEWS_SOURCES.map((s) => ({
    source: s,
    items: Array.from({ length: 5 }, (_, n) => fi(s.shortName, `${s.id} ${n}`, s.feedKind === "calendar" ? NOW + (n + 1) * DAY : NOW - (n + 1) * 3_600_000)),
  }));
  const got = assembleNews(results, NOW);
  const sorted = got.every((g, n) => n === 0 || Date.parse(got[n - 1].at) >= Date.parse(g.at));
  // Today the caps add up to exactly MAX_ITEMS, so the overall cap only
  // binds if a feed is added -- which is when it has to.
  const expected = Math.min(MAX_ITEMS, NEWS_SOURCES.reduce((n, s) => n + Math.min(s.cap, 5), 0));
  check(got.length === expected && sorted, `every feed full: ${expected} items, never over ${MAX_ITEMS}, ordered by date`, `list of ${got.length} (expected ${expected}), sorted=${sorted}`);
}

// ---------- the homepage groups ----------
{
  const tz = "Europe/London"; // NOW is 11:00 BST on Friday 18 September
  const items = [
    fi("ECB", "This morning", Date.parse("2026-09-18T07:00:00Z")),
    fi("RBA", "Yesterday evening", Date.parse("2026-09-17T20:00:00Z")),
    fi("Federal Reserve", "Last week", NOW - 8 * DAY),
    fi("BLS", "This afternoon", Date.parse("2026-09-18T12:30:00Z")),
    fi("ONS", "Next week", Date.parse("2026-09-23T06:00:00Z")),
  ];
  const { latest, groups } = groupNews(items, NOW, tz);
  const keys = groups.map((g) => g.key).join(",");
  const up = groups.find((g) => g.key === "upcoming")?.items ?? [];
  const today = groups.find((g) => g.key === "today")?.items ?? [];
  check(keys === "today,yesterday,earlier,upcoming", "groups come in order: Today, Yesterday, Last 30 days, Coming up", `groups: ${keys}`);
  check(
    today.length === 1 && up[0]?.title === "This afternoon" && up[0]?.when === "today, 13:30",
    "a release due later today is Coming up (\"today, 13:30\"), not Today",
    `today=${today.map((t) => t.title)}, first upcoming=${up[0]?.title} "${up[0]?.when}"`
  );
  check(up[1]?.when === "in 5 days", "the next week reads in days", `next week labelled "${up[1]?.when}"`);
  check(latest?.title === "This morning", "Latest is the newest thing that has happened, never a future one", `latest: ${latest?.title}`);
  const onlyPast = groupNews(items.slice(0, 1), NOW, tz).groups.map((g) => g.key).join(",");
  check(onlyPast === "today", "an empty group is not shown", `groups: ${onlyPast}`);
}
{
  // Late evening: a release at 07:00 tomorrow is nine hours away, which
  // rounds to "0 days" if counted in hours. It is tomorrow.
  const evening = Date.parse("2026-09-18T21:00:00Z"); // 22:00 in London
  const { groups } = groupNews([fi("ONS", "Early tomorrow", Date.parse("2026-09-19T06:00:00Z"))], evening, "Europe/London");
  const w = groups[0]?.items[0]?.when;
  check(w === "tomorrow, 07:00", "\"tomorrow\" is counted in calendar days, not hours", `late-evening release labelled "${w}"`);
}
{
  // 20:00 UTC on the 17th is already the 18th in Sydney: the reader's
  // day decides, not the server's.
  const { groups } = groupNews([fi("RBA", "Evening in London", Date.parse("2026-09-17T20:00:00Z"))], NOW, "Australia/Sydney");
  check(groups[0]?.key === "today", "days are the reader's own: London's yesterday evening is Sydney's today", `Sydney filed it under ${groups[0]?.key}`);
}

// ---------- the strip along the top ----------
{
  const items = [
    fi("BLS", "Far away", NOW + 40 * DAY),
    fi("ONS", "Soonest", NOW + 2 * DAY),
    fi("ECB", "Newest", NOW - 3_600_000),
    fi("RBA", "Older", NOW - 2 * DAY),
    fi("Federal Reserve", "Oldest", NOW - 9 * DAY),
  ];
  const got = pickTickerFeed(items, NOW).map((i) => i.title).join(",");
  check(got === "Newest,Older,Soonest", "the strip takes the two newest and the one soonest, not the furthest release", `strip got ${got}`);
  const noAhead = pickTickerFeed(items.slice(2), NOW).map((i) => i.title).join(",");
  check(noAhead === "Newest,Older,Oldest", "with nothing coming up, the seat goes to what happened", `strip got ${noAhead}`);
  // An item labelled "upcoming" by the route but now in the past (a page
  // left open) must not be announced as NEXT.
  const stale = { ...fi("BLS", "Was upcoming", NOW - 60_000), kind: "upcoming" as const };
  const picked = pickTickerFeed([stale], NOW);
  check(picked[0]?.kind === "announcement", "past and future are judged against the clock, not the route's label", `stale item kind: ${picked[0]?.kind}`);
}
{
  const a = fi("BLS", "The Employment Situation", NOW + DAY, "https://www.bls.gov/ces/");
  const b = fi("BLS", "Real Earnings", NOW + DAY, "https://www.bls.gov/ces/");
  check(feedKey(a) !== feedKey(b), "two releases sharing one page still get separate keys", "two items share a React key");
}

// ---------- the BEA and Statistics Canada, from their real feeds ----------
// Captured 22 September 2026 (scripts/fixtures/news). The BEA's is RSS
// with <item name="..."> and "EDT" dates; Statistics Canada's is Atom with
// xhtml titles and only <updated>.
{
  const fx = (f: string) => readFileSync(join(__dirname, "fixtures", "news", f), "utf8");
  const bea = readFeed(fx("bea-2026-09-22.xml"), src("bea-releases"));
  const beaTitles = bea.map((i) => i.title);
  check(beaTitles.length > 0 && beaTitles.every((t) => /^GDP \(|^Personal Income and Outlays,/.test(t)),
    `BEA: only national GDP and Personal Income and Outlays (${beaTitles.length} kept)`, `BEA kept ${JSON.stringify(beaTitles.slice(0, 5))}`);
  check(beaTitles.includes("GDP (Second Estimate) and Corporate Profits, 2nd Quarter 2026"), "BEA: the latest GDP estimate is kept", "BEA dropped the GDP release");
  check(!beaTitles.some((t) => /by (State|County|Metropolitan)|for (Guam|Puerto Rico)|Trade/i.test(t)),
    "BEA: regional GDP and trade releases are left out", "BEA kept a regional or trade release");
  check(bea.find((i) => i.title.startsWith("Personal Income and Outlays, July 2026"))?.at === "2026-08-26T12:30:00.000Z",
    "BEA: 08:30 EDT is read as 12:30 UTC", "BEA date misread");

  const sc = readFeed(fx("statcan-2026-09-22.atom"), src("statcan-daily"));
  const scTitles = sc.map((i) => i.title);
  check(scTitles.includes("Consumer Price Index, August 2026"), "Statistics Canada: the CPI release is kept, its xhtml title flattened to text", `Statistics Canada kept ${JSON.stringify(scTitles)}`);
  check(scTitles.every((t) => /^(Consumer Price Index|Labour Force Survey|Gross domestic product)/i.test(t)),
    "Statistics Canada: only prices, jobs and output", `Statistics Canada kept ${JSON.stringify(scTitles)}`);
  check(sc.every((i) => /^https:\/\/www\.statcan\.gc\.ca\/daily-quotidien\//.test(i.url)),
    "Statistics Canada: each link is the release itself, not the feed's self or related link", `links ${JSON.stringify(sc.map((i) => i.url))}`);
  check(sc.every((i) => i.source === "Statistics Canada") && bea.every((i) => i.source === "BEA"), "both are credited by name", "an item lost its institution");
}
{
  const atom = (inner: string) => `<feed><entry>${inner}</entry></feed>`;
  const one = parseAtom(atom(`<title type="html">GDP &lt;b&gt;rises&lt;/b&gt;</title><link rel="self" href="https://www150.statcan.gc.ca/feed.atom"/><link rel="alternate" href="https://www.statcan.gc.ca/r1"/><published>2026-09-01T08:30:00-04:00</published><updated>2026-09-20T08:30:00-04:00</updated>`));
  check(one[0]?.title === "GDP rises", "an html-typed title is decoded, then stripped -- no visible <b>", `title ${JSON.stringify(one[0]?.title)}`);
  check(one[0]?.url === "https://www.statcan.gc.ca/r1", "rel=alternate is taken over rel=self", `link ${one[0]?.url}`);
  check(one[0]?.at === "2026-09-01T12:30:00.000Z", "<published> wins over <updated>, so a corrected release does not jump back to the top", `date ${one[0]?.at}`);
  check(parseAtom(atom(`<title>t</title><link rel="self" href="https://x"/><updated>2026-09-01T00:00:00Z</updated>`)).length === 0,
    "an entry whose only link is the feed itself is dropped", "kept an entry with only a self link");
  check(!safeLink("javascript:alert(1)") && !safeLink("http://www.bea.gov/x") && safeLink("https://www.bea.gov/x", ["www.bea.gov"]) && !safeLink("https://evil.example/x", ["www.bea.gov"]),
    "a link must be https, and on the agency's own host where one is named", "safeLink let a bad link through");
  const offsite = readFeed(rss(
    item("GDP (Advance Estimate), 3rd Quarter 2026", "https://evil.example/gdp", "Thu, 29 Oct 2026 08:30:00 EDT") +
    item("GDP (Third Estimate), 2nd Quarter 2026", "http://www.bea.gov/gdp", "Thu, 24 Sep 2026 08:30:00 EDT") +
    item("Personal Income and Outlays, August 2026", "https://www.bea.gov/pio", "Fri, 25 Sep 2026 08:30:00 EDT") +
    // As the BEA's own feed writes one of its links: no scheme at all.
    item("GDP (Advance Estimate), 4th Quarter and Year 2025", "www.bea.gov/news/2026/gdp-advance", "Thu, 26 Feb 2026 08:30:00 EST") +
    item("GDP (Second Estimate), 4th Quarter 2025", "evil.example/www.bea.gov/x", "Thu, 26 Mar 2026 08:30:00 EDT")
  ), src("bea-releases"));
  check(offsite.map((i) => i.url).join() === "https://www.bea.gov/pio,https://www.bea.gov/news/2026/gdp-advance",
    "off-site and http links are dropped; a scheme-less link on the agency's own host is upgraded to https", `kept ${offsite.map((i) => i.url).join()}`);
}

console.log("");
if (failed) {
  console.error("The news band would print something it should not.\n");
  process.exit(1);
}
console.log("Only what the institutions published, correctly dated, filtered, grouped and credited.\n");
