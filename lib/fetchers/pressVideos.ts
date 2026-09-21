// ============================================================
//  RECENT PRESS CONFERENCES, FROM EACH BANK'S OWN YOUTUBE CHANNEL
//
//  Between conferences the live card has nothing to play -- five weeks of
//  a line of text. This supplies the latest recorded press conferences,
//  read from each channel's public feed (no key, no account):
//    https://www.youtube.com/feeds/videos.xml?channel_id=...
//  The channels are the ones in lib/pressConferences.ts, taken from each
//  bank's own website.
//
//  WHAT IT CAN AND CANNOT GIVE. Each feed lists only the channel's ~15
//  newest uploads. The Bank of England holds a press conference four
//  times a year and posts other videos between them, so its latest can
//  drop out of the feed; then that bank is simply absent. Nothing is
//  stored, and the About page promises only what the feeds still list.
//
//  Pure except fetchPressVideos. scripts/test-press-videos.ts runs the
//  parser against real feeds captured on 21 September 2026
//  (scripts/fixtures/press-videos), so a title format that changes shows
//  up as a failing test, not a silently empty section.
// ============================================================

import { decode } from "@/lib/fetchers/newsFeeds";
import { CHANNELS, VIDEO_ID, type BankId, type PressVideo } from "@/lib/pressConferences";

export type { PressVideo };

interface FeedEntry { videoId: string; title: string; published: string; isShort: boolean }

/** A feed is ~40 KB; anything far larger is not a YouTube feed. */
const MAX_FEED_CHARS = 400_000;

export function parseYoutubeFeed(xml: string): FeedEntry[] {
  const out: FeedEntry[] = [];
  for (const block of xml.slice(0, MAX_FEED_CHARS).split("<entry>").slice(1)) {
    const entry = block.split("</entry>")[0];
    const pick = (tag: string) => {
      const m = entry.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
      return m ? decode(m[1]) : null;
    };
    const videoId = pick("yt:videoId");
    const title = pick("title");
    const published = pick("published");
    if (!videoId || !VIDEO_ID.test(videoId) || !title || !published || !Number.isFinite(Date.parse(published))) continue;
    const isShort = entry.includes("youtube.com/shorts/") || /#shorts/i.test(title);
    out.push({ videoId, title, published: new Date(Date.parse(published)).toISOString(), isShort });
  }
  return out;
}

/** Which uploads are press conferences, per channel. Checked against the
 *  feeds on 21 September 2026: the Fed titles them "FOMC Press
 *  Conference, <date>" (and cuts a Short from each, dropped); the ECB
 *  "Live - ECB Governing Council Press Conference - <date>"; the Bank of
 *  England "Monetary Policy Report Press Conference, <date>"; the Bank of
 *  Canada bilingually, "... press conference ... / Conférence de presse". */
export const PRESS_TITLE: Record<BankId, RegExp> = {
  fed: /^FOMC Press Conference,/,
  // Not just "press conference": the ECB also streams Banking Supervision
  // press conferences, which are not about rates.
  ecb: /governing council press conference|monetary policy press conference/i,
  boe: /press conference/i,
  boc: /press conference|conférence de presse/i,
};

/** "Live - ECB Governing Council Press Conference - 10 September 2026" is
 *  a recording by the time anyone sees it here; "Live" beside a date weeks
 *  old reads as a mistake. */
export const displayTitle = (t: string) => t.replace(/^live\s*[-–—:]\s*/i, "");

export function pressConferencesIn(bank: BankId, entries: FeedEntry[]): PressVideo[] {
  return entries
    .filter((e) => !e.isShort && PRESS_TITLE[bank].test(e.title))
    .map((e) => ({ bank, videoId: e.videoId, title: displayTitle(e.title), published: e.published }))
    .sort((a, b) => b.published.localeCompare(a.published));
}

/** The newest of each bank first -- so a quarterly Bank of England
 *  conference is not pushed out by two Fed meetings -- then the rest by
 *  date, up to the cap; the whole list newest first. */
export function pickRecent(perBank: PressVideo[][], cap = 6): PressVideo[] {
  const firsts = perBank.filter((l) => l.length > 0).map((l) => l[0]);
  const rest = perBank.flatMap((l) => l.slice(1)).sort((a, b) => b.published.localeCompare(a.published));
  return [...firsts, ...rest].slice(0, cap).sort((a, b) => b.published.localeCompare(a.published));
}

// ------------------------------------------------------------
//  The network half. Each feed gets one retry -- YouTube's feed endpoint
//  fails now and then -- and a failed bank costs only that bank.
// ------------------------------------------------------------

const PER_TRY_MS = 3000;

export const isFeed = (body: string) => body.includes("<feed");

async function fetchFeed(channelId: string): Promise<string> {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
        signal: AbortSignal.timeout(PER_TRY_MS),
        headers: { "user-agent": "Mozilla/5.0 (compatible; MMAI/1.0; +https://www.mmai.markets)", accept: "application/atom+xml, application/xml" },
        next: { revalidate: 0 },
      });
      const body = res.ok ? await res.text() : "";
      // YouTube sometimes answers 200 with a consent or error page. That is
      // a failure, not an empty channel: counted as success, four of them
      // would store an empty list for the hour.
      if (isFeed(body)) return body;
      last = new Error(res.ok ? "not a feed" : `HTTP ${res.status}`);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

/** Throws when EVERY feed failed, so the route's cache keeps its last good
 *  answer instead of storing an empty one for an hour. */
export async function fetchPressVideos(): Promise<PressVideo[]> {
  const banks = Object.values(CHANNELS);
  const results = await Promise.allSettled(banks.map((c) => fetchFeed(c.youtubeChannelId)));
  if (results.every((r) => r.status === "rejected")) throw new Error("no press-video feed answered");
  const perBank = results.map((r, i) =>
    r.status === "fulfilled" ? pressConferencesIn(banks[i].id, parseYoutubeFeed(r.value)) : []
  );
  return pickRecent(perBank);
}
