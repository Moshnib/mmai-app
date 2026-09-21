// ============================================================
//  CENTRAL BANK VIDEOS, FROM EACH INSTITUTION'S OWN YOUTUBE CHANNEL
//
//  Between conferences the live card has nothing to play -- five weeks of
//  a line of text. This supplies recorded press conferences for the
//  homepage, and speeches, briefings and rate decisions for the Videos
//  page, read from each channel's public feed (no key, no account):
//    https://www.youtube.com/feeds/videos.xml?channel_id=...
//  The nine channels are VIDEO_CHANNELS in lib/pressConferences.ts, each
//  taken from the institution's own website.
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
import {
  VIDEO_CHANNELS, VIDEO_ID, type PressVideo, type VideoChannelId, type VideoKind,
} from "@/lib/pressConferences";

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

/** WHICH UPLOADS ARE KEPT, AND WHAT KIND EACH IS. Per channel, first
 *  matching rule wins; an upload that matches no rule is dropped rather
 *  than shown untagged. Built from each channel's real titles (the
 *  captured feeds in scripts/fixtures/press-videos):
 *
 *    Fed       "FOMC Press Conference, <date>" (a Short is cut from each,
 *              dropped), "Speech by Governor ...", testimony
 *    ECB       "Live - ECB Governing Council Press Conference - <date>" --
 *              not just "press conference", which would also take its
 *              Banking Supervision conferences
 *    BoE       "Monetary Policy Report Press Conference, <date>"; its
 *              podcast and explainers are left out
 *    BoC       bilingual titles; its bank-note videos are left out
 *    Riksbank  "Pressträff om det penningpolitiska beslutet" (the press
 *              conference on the rate decision), "Riksbankschefen om
 *              räntebeskedet" (the governor on the decision)
 *    Norges    "Rentebeslutning <month>" (rate decision)
 *    BIS       media briefings on its Quarterly Review and Annual Report
 *    BoJ       総裁定例記者会見 (the Governor's regular press conference)
 *    BoK       its Monetary Policy Report and outlook, in English, and
 *              the Korean briefing on the report */
interface Rule { match: RegExp; kind: VideoKind }
export const RULES: Record<VideoChannelId, { rules: Rule[]; exclude?: RegExp }> = {
  fed: { rules: [
    { match: /^FOMC Press Conference,/, kind: "Press conference" },
    { match: /^Speech by (Chair|Vice Chair|Governor)/, kind: "Speech" },
    { match: /testimony/i, kind: "Testimony" },
  ] },
  ecb: { rules: [
    { match: /governing council press conference|monetary policy press conference/i, kind: "Press conference" },
    { match: /^President Lagarde presents/i, kind: "Decision summary" },
    { match: /hearing/i, kind: "Hearing" },
    { match: /in conversation/i, kind: "Interview" },
  ] },
  boe: { rules: [
    { match: /press conference/i, kind: "Press conference" },
    { match: /speech by|Mansion House/i, kind: "Speech" },
  ] },
  boc: { exclude: /bank note|billet|described video|vidéodescription/i, rules: [
    { match: /press conference|conférence de presse/i, kind: "Press conference" },
    { match: /monetary policy report|rapport sur la politique monétaire/i, kind: "Report" },
    { match: /\bspeech\b|\bdiscours\b/i, kind: "Speech" },
  ] },
  riksbank: { rules: [
    { match: /^Pressträff om det penningpolitiska beslutet/, kind: "Press conference" },
    { match: /^Riksbankschefen om räntebeskedet/, kind: "Rate decision" },
  ] },
  norges: { rules: [
    { match: /^Rentebeslutning|^Rentemøte/, kind: "Rate decision" },
    { match: /^Pressekonferanse/, kind: "Press conference" },
  ] },
  bis: { rules: [
    { match: /media briefing/i, kind: "Briefing" },
  ] },
  boj: { rules: [
    { match: /総裁定例記者会見/, kind: "Press conference" },
  ] },
  bok: { rules: [
    { match: /Monetary Policy Report|Economic Outlook/i, kind: "Report" },
    { match: /통화신용정책보고서.*기자설명회/, kind: "Briefing" },
  ] },
};

/** "Live - ECB Governing Council Press Conference - 10 September 2026" is
 *  a recording by the time anyone sees it here; "Live" beside a date weeks
 *  old reads as a mistake. A leading emoji (the Bank of Korea's "📖") goes
 *  too. */
export const displayTitle = (t: string) =>
  t.replace(/^\p{Extended_Pictographic}\s*/u, "").replace(/^live\s*[-–—:]\s*/i, "");

/** Titles in Hangul are Korean even on a channel that also posts in
 *  English; otherwise a title is in its channel's language. */
function languageOf(channel: VideoChannelId, title: string): PressVideo["lang"] {
  if (/[가-힯]/.test(title)) return "ko";
  const lang = VIDEO_CHANNELS[channel].lang;
  return lang === "ko" ? "en" : lang;
}

export function videosIn(channel: VideoChannelId, entries: FeedEntry[]): PressVideo[] {
  const { rules, exclude } = RULES[channel];
  const out: PressVideo[] = [];
  for (const e of entries) {
    if (e.isShort || exclude?.test(e.title)) continue;
    const rule = rules.find((r) => r.match.test(e.title));
    if (!rule) continue;
    const lang = languageOf(channel, e.title);
    const english = lang === "en";
    out.push({
      bank: channel,
      videoId: e.videoId,
      // Not in English: our own label, and YouTube's title kept beside it.
      title: english ? displayTitle(e.title) : `${VIDEO_CHANNELS[channel].short} ${rule.kind.toLowerCase()}`,
      kind: rule.kind,
      lang,
      ...(english ? {} : { original: e.title }),
      published: e.published,
    });
  }
  return out.sort((a, b) => b.published.localeCompare(a.published));
}

const newestFirst = (a: PressVideo, b: PressVideo) => b.published.localeCompare(a.published);

/** The homepage row sits under the live card, so it is about the same
 *  thing: press conferences and rate decisions. The four banks the live
 *  card follows get a place first -- a Norges Bank video from June must
 *  not push out the Fed -- then other channels' conferences by date. */
export function pickHome(perChannel: PressVideo[][], cap = 6): PressVideo[] {
  const conferences = perChannel.map((l) => l.filter((v) => v.kind === "Press conference" || v.kind === "Rate decision"));
  const core = new Set<VideoChannelId>(["fed", "ecb", "boe", "boc"]);
  const firsts = conferences.filter((l) => l.length > 0 && core.has(l[0].bank)).map((l) => l[0]);
  const taken = new Set(firsts.map((v) => v.videoId));
  const rest = conferences.flat().filter((v) => !taken.has(v.videoId)).sort(newestFirst);
  return [...firsts, ...rest].slice(0, cap).sort(newestFirst);
}

/** The Videos page: everything, newest first, so a stale channel's June
 *  video can never look current -- at most eight per channel, or Norges
 *  Bank's two years of rate decisions would fill the page. */
export function pickAll(perChannel: PressVideo[][], cap = 40, perChannelCap = 8): PressVideo[] {
  return perChannel.flatMap((l) => l.slice(0, perChannelCap)).sort(newestFirst).slice(0, cap);
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
export interface PressVideoSet {
  /** The homepage row: press conferences and rate decisions. */
  home: PressVideo[];
  /** The Videos page: everything kept, newest first. */
  all: PressVideo[];
}

/** One read of every feed serves both, from one cached response. */
export async function fetchPressVideos(): Promise<PressVideoSet> {
  const channels = Object.values(VIDEO_CHANNELS);
  const results = await Promise.allSettled(channels.map((c) => fetchFeed(c.youtubeChannelId)));
  if (results.every((r) => r.status === "rejected")) throw new Error("no press-video feed answered");
  const perChannel = results.map((r, i) =>
    r.status === "fulfilled" ? videosIn(channels[i].id, parseYoutubeFeed(r.value)) : []
  );
  return { home: pickHome(perChannel), all: pickAll(perChannel) };
}
