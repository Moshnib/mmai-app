// ============================================================
//  CENTRAL BANK VIDEOS ARE PICKED CORRECTLY
//
//  lib/fetchers/pressVideos.ts reads nine institutions' YouTube feeds,
//  keeps press conferences, rate decisions, speeches and briefings, and
//  tags each with its kind and language. These are the REAL feeds as they
//  stood on 21-22 September 2026 (scripts/fixtures/press-videos), so every
//  rule is tested against what the institutions actually publish.
//
//  Run: npx tsx scripts/test-press-videos.ts
// ============================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYoutubeFeed, videosIn, pickHome, pickAll, isFeed, displayTitle, cacheControlFor, rowsToSave, storedEntries, mergeEntries, buildSet, combine, type FeedEntry } from "../lib/fetchers/pressVideos";
import { VIDEO_CHANNELS, type PressVideo, type VideoChannelId } from "../lib/pressConferences";
import { checked } from "../lib/videoList";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got ${JSON.stringify(actual)}\n      expected ${JSON.stringify(expected)}`}`);
  if (!ok) failures++;
}

const DATE: Record<VideoChannelId, string> = {
  fed: "2026-09-21", ecb: "2026-09-21", boe: "2026-09-21", boc: "2026-09-21",
  riksbank: "2026-09-22", norges: "2026-09-22", bis: "2026-09-22", boj: "2026-09-22", bok: "2026-09-22",
};
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", "press-videos", name), "utf8");
const feed = (c: VideoChannelId) => fixture(`${c}-${DATE[c]}.xml`);
const found = (c: VideoChannelId) => videosIn(c, parseYoutubeFeed(feed(c)));
const kinds = (c: VideoChannelId) => found(c).map((v) => `${v.kind}: ${v.title}`);
const ALL = Object.keys(VIDEO_CHANNELS) as VideoChannelId[];

console.log("Each channel's real feed yields the right videos, of the right kind\n");
check("every feed parses", ALL.map((c) => parseYoutubeFeed(feed(c)).length >= 10), ALL.map(() => true));
check("Fed: both FOMC press conferences and two speeches -- no Shorts, no panels", kinds("fed"), [
  "Press conference: FOMC Press Conference, September 16, 2026",
  "Press conference: FOMC Press Conference, July 29, 2026",
  "Speech: Speech by Governor Barr on artificial intelligence, July 14, 2026",
  // The feed itself cuts this title short.
  "Speech: Speech by Vice Chair for Supervision Bowman on responsible innovation and financial inclusion",
]);
check("ECB: the interview, Lagarde's summary and the press conference -- not the research conference or Shorts", found("ecb").map((v) => v.kind), ["Interview", "Decision summary", "Press conference"]);
check("ECB: \"Live - \" is gone from a recording's title", found("ecb")[2].title, "ECB Governing Council Press Conference - 10 September 2026");
check("Bank of England: the press conference, not its podcast", kinds("boe"), ["Press conference: Monetary Policy Report Press Conference, 30 July 2026"]);
check("Bank of Canada: the press conference, not the bank-note videos", found("boc").map((v) => v.videoId), ["26PgMJPCcpE"]);
check("Riksbank: five press conferences and four rate-decision videos", found("riksbank").map((v) => v.kind).join(",").split(",").reduce((m: Record<string, number>, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {}), { "Press conference": 5, "Rate decision": 4 });
check("Riksbank: English label, Swedish original kept and marked", (({ title, lang, original }) => [title, lang, original?.slice(0, 29)])(found("riksbank")[0]), ["Riksbank press conference", "sv", "Pressträff om det penningpoli"]);
check("Norges Bank: its rate decisions, including the old \"Rentemøte\" title", found("norges").slice(-1).map((v) => [v.kind, v.original]), [["Rate decision", "Rentemøte november 2024"]]);
check("BIS: its three media briefings", found("bis").map((v) => v.videoId), ["w4PPDSY9cc8", "hZ5ElIsczyU", "fFuR-sPV72Y"]);
check("Bank of Japan: the Governor's two press conferences, labelled in English", found("boj").map((v) => [v.title, v.lang]), [["BoJ press conference", "ja"], ["BoJ press conference", "ja"]]);
check("Bank of Korea: the Korean briefing is marked Korean, the English reports English", found("bok").map((v) => `${v.kind}/${v.lang}/${v.title}`), [
  "Briefing/ko/BoK briefing",
  "Report/en/Monetary Policy Report (September 2026)",
  "Report/en/Korea Economic Outlook (August 2026)",
]);

console.log("\nThe rules are strict\n");
const one = (c: VideoChannelId, title: string) => videosIn(c, [{ videoId: "abcdefghijk", title, published: "2026-09-01T00:00:00.000Z", isShort: false }]);
check("an upload matching no rule is dropped, not shown untagged", one("fed", "Welcome remarks by Governor Cook").length, 0);
check("ECB: a Banking Supervision press conference is not a rates conference", one("ecb", "Supervisory Board press conference - 2026").length, 0);
check("Bank of Canada: a bank-note video is excluded even if it says press conference", one("boc", "Bank note press conference").length, 0);
check("a leading emoji is dropped from a title", displayTitle("📖Monetary Policy Report"), "Monetary Policy Report");
check("...and a title merely containing \"live\" is left alone", displayTitle("Delivering the Monetary Policy Report"), "Delivering the Monetary Policy Report");
const entry = (id: string, title: string, extra = "") =>
  `<feed><entry><yt:videoId>${id}</yt:videoId><title>${title}</title><published>2026-09-01T10:00:00+00:00</published>${extra}</entry></feed>`;
check("a malformed video id is dropped", parseYoutubeFeed(entry("abc\"><script", "x")).length, 0);
check("a ten-character id is dropped", parseYoutubeFeed(entry("abcdefghij", "x")).length, 0);
check("entities in titles are decoded to plain text", parseYoutubeFeed(entry("abcdefghijk", "Q&amp;A &quot;live&quot;"))[0]?.title, 'Q&A "live"');
check("a Short is marked by its link", parseYoutubeFeed(entry("abcdefghijk", "Press conference", '<link rel="alternate" href="https://www.youtube.com/shorts/abcdefghijk"/>'))[0]?.isShort, true);
check("an entry without a date is dropped", parseYoutubeFeed("<entry><yt:videoId>abcdefghijk</yt:videoId><title>t</title></entry>").length, 0);

console.log("\nA page that is not a feed is a failure, not an empty channel\n");
check("the real feeds are feeds", ALL.every((c) => isFeed(feed(c))), true);
check("a consent page answered with 200 is not", isFeed(fixture("consent-page.html")), false);

console.log("\nThe homepage row is press conferences, the four live-card banks first\n");
const per = ALL.map(found);
const home = pickHome(per);
check("today's homepage row, the six on show", home.slice(0, 6).map((v) => `${v.bank} ${v.published.slice(0, 10)}`), [
  "boc 2026-09-21", "boj 2026-09-18", "fed 2026-09-16", "ecb 2026-09-10", "riksbank 2026-08-20", "boe 2026-07-30",
]);
check("one tile per institution per day (no Riksbank twice for one decision)", new Set(home.map((v) => `${v.bank} ${v.published.slice(0, 10)}`)).size, home.length);
check("behind Show more, the rest by date", home.slice(6).every((x, i, a) => i === 0 || a[i - 1].published >= x.published), true);
check("only press conferences and rate decisions on the homepage", home.every((v) => v.kind === "Press conference" || v.kind === "Rate decision"), true);
const v = (bank: VideoChannelId, day: string, kind: PressVideo["kind"] = "Press conference"): PressVideo =>
  ({ bank, videoId: `${bank}${day}`.replace(/[^A-Za-z0-9]/g, "").padEnd(11, "x").slice(0, 11), title: "t", kind, lang: "en", published: `2026-${day}T12:00:00.000Z` });
const busy = pickHome([
  [v("riksbank", "09-20"), v("riksbank", "09-19")], [v("boj", "09-18")], [v("boe", "07-30")],
  [v("fed", "09-10", "Speech"), v("fed", "07-29")],
], 3, 3);
check("a quarterly BoE and an older Fed conference beat newer videos from other channels", busy.map((x) => x.bank), ["riksbank", "boe", "fed"]);
check("...and the Fed's newer speech is not on the homepage", busy.some((x) => x.kind === "Speech"), false);

console.log("\nThe Videos page is everything, newest first, ten per channel at most\n");
const all = pickAll(per);
check("newest first", all.every((x, i) => i === 0 || all[i - 1].published >= x.published), true);
check("Norges Bank's two years of decisions are capped at ten", all.filter((x) => x.bank === "norges").length, 10);
check("every channel with a video is on the page", [...new Set(all.map((x) => x.bank))].sort(), [...ALL].sort());

console.log("\nA thin answer from YouTube is not kept for an hour\n");
// 22 September 2026: eight of nine feeds failed, the ninth was cached for
// an hour, and the homepage showed one video.
check("one channel answering is kept for a minute", cacheControlFor(1), "public, s-maxage=60");
check("four channels answering is still thin", cacheControlFor(4).includes("s-maxage=60"), true);
check("five or more is kept an hour", cacheControlFor(5).includes("s-maxage=3600"), true);
check("...and never with a day's stale allowance", cacheControlFor(9).includes("86400"), false);

console.log("\nStored videos: a failing feed can no longer shrink the list\n");
{
  const live = new Map<VideoChannelId, FeedEntry[]>(ALL.map((c) => [c, parseYoutubeFeed(feed(c))]));
  const rows = rowsToSave(live);
  check("Shorts are not saved", rows.some((r) => r.title.includes("#shorts")), false);
  check("everything else the feeds list is saved, raw title and all", rows.find((r) => r.video_id === "rCBHa4xjqvI")?.title, "Live - ECB Governing Council Press Conference - 10 September 2026");
  // The 22 September scenario: only the Bank of England's feed answers, but
  // everything seen before is stored.
  const onlyBoe = new Map<VideoChannelId, FeedEntry[]>([["boe", live.get("boe")!]]);
  const outage = combine(rows, onlyBoe);
  check("with one feed answering, the stored rows still fill the homepage", outage.home.length >= 6, true);
  check("...and the Videos page", outage.all.length, buildSet(live).all.length);
  check("...and the answer is not thin, so it is cached normally", outage.covered >= 5, true);
  check("rules run on stored rows as on live ones (banknote videos stay out)", outage.all.some((v) => /bank note|billet/i.test(v.title)), false);
  const renamed = new Map<VideoChannelId, FeedEntry[]>([["boe", [{ videoId: "G5m9FOeBD1Q", title: "Monetary Policy Report Press Conference, 30 July 2026 (with captions)", published: "2026-07-30T13:22:20.000Z", isShort: false }]]]);
  const merged = mergeEntries(storedEntries(rows), renamed).get("boe")!;
  check("one entry per video, and the live title wins", merged.filter((e) => e.videoId === "G5m9FOeBD1Q").map((e) => e.title), ["Monetary Policy Report Press Conference, 30 July 2026 (with captions)"]);
  const junk = storedEntries([
    { video_id: "abcdefghijk", channel: "constructor", title: "t", published: "2026-09-01T00:00:00Z" },
    { video_id: "bad", channel: "fed", title: "t", published: "2026-09-01T00:00:00Z" },
    { video_id: "abcdefghijk", channel: "fed", title: "t", published: "not a date" },
  ]);
  check("a stored row with an unknown channel, a bad id or a bad date is ignored", junk.size, 0);
  // Hidden by hand while the Bank of England's feed still lists it.
  const withHidden = rows.map((r) => (r.video_id === "G5m9FOeBD1Q" ? { ...r, hidden: true } : r));
  const hid = combine(withHidden, onlyBoe);
  check("a hidden video stays off the site even while its feed still lists it", [...hid.home, ...hid.all].some((x) => x.videoId === "G5m9FOeBD1Q"), false);
  check("...and hiding one video hides nothing else", hid.all.length, outage.all.length - 1);
  check("the homepage list holds up to 18 (6 shown, 12 behind Show more)", pickHome([Array.from({ length: 30 }, (_, i) => v("fed", `09-${String(i % 28 + 1).padStart(2, "0")}`))]).length, 18);
}

console.log("\nThe browser only accepts what it can safely play\n");
check("unknown channels and bad ids are dropped", checked([
  { bank: "fed", videoId: "abcdefghijk", title: "t", published: "2026-09-01" },
  { bank: "imf", videoId: "abcdefghijk", title: "t", published: "2026-09-01" },
  { bank: "fed", videoId: "javascript:", title: "t", published: "2026-09-01" },
]).map((x) => [x.bank, x.kind, x.lang]), [["fed", "Press conference", "en"]]);
check("a built-in object name is not a channel", checked([{ bank: "constructor", videoId: "abcdefghijk", title: "t", published: "2026-09-01" }]).length, 0);
check("anything that is not a list is an empty list", checked({ videos: 1 }), []);

console.log(failures === 0 ? "\nAll press-video checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
