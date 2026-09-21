// ============================================================
//  RECENT PRESS-CONFERENCE VIDEOS ARE PICKED CORRECTLY
//
//  lib/fetchers/pressVideos.ts reads each bank's YouTube feed and keeps
//  its press conferences. These are the four REAL feeds as they stood on
//  21 September 2026 (scripts/fixtures/press-videos), so the title
//  filters are tested against what the banks actually publish.
//
//  Run: npx tsx scripts/test-press-videos.ts
// ============================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYoutubeFeed, pressConferencesIn, pickRecent, isFeed, displayTitle } from "../lib/fetchers/pressVideos";
import type { BankId, PressVideo } from "../lib/pressConferences";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got ${JSON.stringify(actual)}\n      expected ${JSON.stringify(expected)}`}`);
  if (!ok) failures++;
}

const feed = (bank: BankId) => readFileSync(join(__dirname, "fixtures", "press-videos", `${bank}-2026-09-21.xml`), "utf8");
const found = (bank: BankId) => pressConferencesIn(bank, parseYoutubeFeed(feed(bank)));
const brief = (v: PressVideo) => `${v.bank} ${v.published.slice(0, 10)} ${v.videoId}`;

console.log("Each bank's real feed yields its press conferences, and only those\n");
check("every feed parses to its ~15 entries", (["fed", "ecb", "boe", "boc"] as BankId[]).map((b) => parseYoutubeFeed(feed(b)).length >= 10), [true, true, true, true]);
check("Fed: the two FOMC press conferences, not the Shorts cut from them",
  found("fed").map((v) => v.title), ["FOMC Press Conference, September 16, 2026", "FOMC Press Conference, July 29, 2026"]);
check("ECB: the Governing Council press conference, not the research conference",
  found("ecb").map((v) => v.title), ["ECB Governing Council Press Conference - 10 September 2026"]);
const ecbTitles = (title: string) => pressConferencesIn("ecb", [{ videoId: "abcdefghijk", title, published: "2026-09-01T00:00:00.000Z", isShort: false }]).length;
check("ECB: a Banking Supervision press conference is not a rates conference", ecbTitles("Supervisory Board press conference - 2026"), 0);
check("ECB: a monetary policy press conference is", ecbTitles("Monetary policy press conference - 29 October 2026"), 1);
check("\"Live - \" is dropped from a recording's title", displayTitle("Live - ECB Governing Council Press Conference"), "ECB Governing Council Press Conference");
check("...but a title merely containing \"live\" is left alone", displayTitle("Delivering the Monetary Policy Report"), "Delivering the Monetary Policy Report");
check("Bank of England: the Monetary Policy Report press conference",
  found("boe").map((v) => v.title), ["Monetary Policy Report Press Conference, 30 July 2026"]);
check("Bank of Canada: the bilingual press conference title matches",
  found("boc").map((v) => v.videoId), ["26PgMJPCcpE"]);

console.log("\nThe parser is strict about what goes into a URL\n");
const entry = (id: string, title: string, extra = "") =>
  `<feed><entry><yt:videoId>${id}</yt:videoId><title>${title}</title><published>2026-09-01T10:00:00+00:00</published>${extra}</entry></feed>`;
check("a malformed video id is dropped", parseYoutubeFeed(entry("abc\"><script", "x")).length, 0);
check("a ten-character id is dropped", parseYoutubeFeed(entry("abcdefghij", "x")).length, 0);
check("entities in titles are decoded to plain text", parseYoutubeFeed(entry("abcdefghijk", "Q&amp;A &quot;live&quot;"))[0]?.title, 'Q&A "live"');
check("a Short is marked by its link", parseYoutubeFeed(entry("abcdefghijk", "Press conference", '<link rel="alternate" href="https://www.youtube.com/shorts/abcdefghijk"/>'))[0]?.isShort, true);
check("an entry without a date is dropped", parseYoutubeFeed("<entry><yt:videoId>abcdefghijk</yt:videoId><title>t</title></entry>").length, 0);

console.log("\nA page that is not a feed is a failure, not an empty channel\n");
check("the real feeds are feeds", (["fed", "ecb", "boe", "boc"] as BankId[]).every((b) => isFeed(feed(b))), true);
check("a consent page answered with 200 is not", isFeed(readFileSync(join(__dirname, "fixtures", "press-videos", "consent-page.html"), "utf8")), false);

console.log("\nEvery bank gets a place before any bank gets a second\n");
const all = pickRecent([found("fed"), found("ecb"), found("boe"), found("boc")]);
check("today's five, newest first", all.map(brief), [
  "boc 2026-09-21 26PgMJPCcpE",
  "fed 2026-09-16 ELU3u2Ny7r0",
  "ecb 2026-09-10 rCBHa4xjqvI",
  "boe 2026-07-30 G5m9FOeBD1Q",
  "fed 2026-07-29 DLFXUkOc_7I",
]);
const v = (bank: BankId, day: string): PressVideo => ({ bank, videoId: `${bank}${day}`.padEnd(11, "x").slice(0, 11), title: "t", published: `2026-${day}T12:00:00.000Z` });
const busy = pickRecent([
  [v("fed", "09-16"), v("fed", "09-10"), v("fed", "09-05"), v("fed", "09-01")],
  [v("ecb", "09-15"), v("ecb", "09-09"), v("ecb", "09-04")],
  [v("boe", "07-30")],
  [],
], 4);
check("a quarterly Bank of England conference is not pushed out by busier channels", busy.map((x) => x.bank), ["fed", "ecb", "fed", "boe"]);
check("the cap is respected", busy.length, 4);
check("a bank with nothing listed is simply absent", pickRecent([[], [], [], []]).length, 0);

console.log(failures === 0 ? "\nAll press-video checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
