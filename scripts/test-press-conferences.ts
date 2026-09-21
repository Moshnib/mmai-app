// ============================================================
//  THE LIVE PRESS-CONFERENCE CARD SHOWS THE RIGHT THING AT THE RIGHT TIME
//
//  lib/pressConferences.ts turns each bank's published calendar into
//  "next", "live" and "just ended". Wrong by an hour across a clock change
//  and the card says LIVE to an empty stream; wrong channel and it plays
//  someone else. Pinned here.
//
//  Run: npx tsx scripts/test-press-conferences.ts
// ============================================================

import {
  CHANNELS, SCHEDULE, conferences, liveState, zonedToUtc, daysUntil,
  LIVE_LEAD_MS, LIVE_TAIL_MS, ENDED_TAIL_MS, youtubeLiveEmbedUrl,
} from "../lib/pressConferences";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
  if (!ok) failures++;
}
const iso = (t: number) => new Date(t).toISOString().slice(0, 16) + "Z";
const at = (s: string) => Date.parse(s);
const MIN = 60_000;

console.log("Local times become the right instant, across clock changes\n");
// Europe's clocks go back 25 Oct 2026, America's on 1 Nov.
check("FOMC 28 Oct 2026 14:30 New York = 18:30 UTC (EDT)", iso(zonedToUtc("2026-10-28", "14:30", "America/New_York")), "2026-10-28T18:30Z");
check("FOMC 9 Dec 2026 14:30 New York = 19:30 UTC (EST)", iso(zonedToUtc("2026-12-09", "14:30", "America/New_York")), "2026-12-09T19:30Z");
check("ECB 29 Oct 2026 14:45 Frankfurt = 13:45 UTC (CET)", iso(zonedToUtc("2026-10-29", "14:45", "Europe/Berlin")), "2026-10-29T13:45Z");
check("ECB 10 Jun 2027 14:45 Frankfurt = 12:45 UTC (CEST)", iso(zonedToUtc("2027-06-10", "14:45", "Europe/Berlin")), "2027-06-10T12:45Z");
check("BoE 5 Nov 2026 13:00 London = 13:00 UTC (GMT)", iso(zonedToUtc("2026-11-05", "13:00", "Europe/London")), "2026-11-05T13:00Z");
check("BoE 29 Jul 2027 13:00 London = 12:00 UTC (BST)", iso(zonedToUtc("2027-07-29", "13:00", "Europe/London")), "2027-07-29T12:00Z");
check("BoC 28 Oct 2026 10:30 Toronto = 14:30 UTC", iso(zonedToUtc("2026-10-28", "10:30", "America/Toronto")), "2026-10-28T14:30Z");

console.log("\nThe channels are the banks' own, from their own websites\n");
check("Fed", CHANNELS.fed.youtubeChannelId, "UCAzhpt9DmG6PnHXjmJTvRGQ");
check("ECB", CHANNELS.ecb.youtubeChannelId, "UCXB8fM4VyQubRu3UVGhd3wA");
// NOT UCZ25rmSDSnjIWZxjd2-04Rg, the unrelated "@bankofengland" handle.
check("Bank of England", CHANNELS.boe.youtubeChannelId, "UCY70MMJ8Rj4wtwt7bVN6hIA");
check("Bank of Canada", CHANNELS.boc.youtubeChannelId, "UCY4EvEbIox0M4JuEsu5OKnQ");
check("the Fed links out while live (it does not stream on YouTube)", [CHANNELS.fed.liveOn, CHANNELS.fed.siteLiveUrl], ["site", "https://www.federalreserve.gov/live-broadcast.htm"]);
check("the player is the privacy-enhanced domain", youtubeLiveEmbedUrl(CHANNELS.ecb).startsWith("https://www.youtube-nocookie.com/embed/live_stream?channel="), true);
check("every scheduled bank has a channel", SCHEDULE.every((s) => CHANNELS[s.bank] !== undefined), true);
check("no conference is listed twice", new Set(SCHEDULE.map((s) => `${s.bank}${s.date}`)).size, SCHEDULE.length);

console.log("\nNext, live, just ended\n");
const list = conferences();
const fed = list.find((c) => c.bank === "fed" && c.date === "2026-10-28")!;
check("conferences come out in time order", list.every((c, i) => i === 0 || list[i - 1].start <= c.start), true);
check("on 21 Sep 2026 the next is the Bank of Canada, 28 Oct", (({ next }) => [next?.bank, next?.date])(liveState(at("2026-09-21T12:00Z"))), ["boc", "2026-10-28"]);
check("nothing is live on 21 Sep", liveState(at("2026-09-21T12:00Z")).live.length, 0);
check("one minute before the lead: not live yet", liveState(fed.start - LIVE_LEAD_MS - MIN).live.map((c) => c.bank), []);
check("at the lead: live", liveState(fed.start - LIVE_LEAD_MS).live.map((c) => c.bank), ["fed"]);
check("99 minutes in (an overrun): still live", liveState(fed.start + LIVE_TAIL_MS - MIN).live.map((c) => c.bank), ["fed"]);
check("at 100 minutes: just ended, not live", (({ live, ended }) => [live.length, ended.map((c) => c.bank)])(liveState(fed.start + LIVE_TAIL_MS)), [0, ["fed"]]);
check("three hours after that: neither", (({ live, ended }) => [live.length, ended.length])(liveState(fed.start + LIVE_TAIL_MS + ENDED_TAIL_MS)), [0, 0]);
check("while the Fed is live, next is the ECB the day after", liveState(fed.start).next?.bank, "ecb");
// 28 Oct 2026: the Bank of Canada at 14:30 UTC, the Fed at 18:30 UTC.
check("28 Oct: the Bank of Canada is live at 15:00 UTC, the Fed is not", liveState(at("2026-10-28T15:00Z")).live.map((c) => c.bank), ["boc"]);
// 4 Feb 2027: the Bank of England at 13:00 UTC, the ECB at 13:45 UTC. Both.
check("4 Feb 2027: BoE and ECB live at once, both shown", liveState(at("2027-02-04T13:50Z")).live.map((c) => c.bank), ["boe", "ecb"]);

console.log("\nDays until, counted in calendar days\n");
check("21 Sep to 28 Oct is 37 days", daysUntil(fed.start, at("2026-09-21T06:00Z"), "UTC"), 37);
check("late evening still counts from today", daysUntil(fed.start, at("2026-09-21T23:30Z"), "UTC"), 37);
// In Tokyo it is already 22 Sep, and the conference falls on 29 Oct there.
check("the reader's zone decides both days (Tokyo: 22 Sep to 29 Oct)", daysUntil(fed.start, at("2026-09-21T23:30Z"), "Asia/Tokyo"), 37);
check("...and a zone where today has already turned counts one less", daysUntil(fed.start, at("2026-09-21T23:30Z"), "Europe/Berlin"), 36);
check("same day is 0", daysUntil(fed.start, fed.start - 5 * 60 * MIN, "America/New_York"), 0);

console.log("\nThe schedule has not run out\n");
// Fails in CI when the dates are close to running out: the reminder to
// add next year's from each bank's calendar (CHANNELS[*].calendarUrl).
const upcoming = list.filter((c) => c.start > Date.now() + 60 * 24 * 60 * MIN).length;
check(`at least 3 conferences more than 60 days away (${upcoming})`, upcoming >= 3, true);

console.log(failures === 0 ? "\nAll press-conference checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
