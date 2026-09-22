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

export interface FeedEntry { videoId: string; title: string; published: string; isShort: boolean }

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
 *  thing: press conferences and rate decisions. Up to 18: six show, and
 *  "Show more" reveals the rest in place (components/VideoTiles.tsx). The four banks the live
 *  card follows get a place first -- a Norges Bank video from June must
 *  not push out the Fed -- then other channels' conferences by date. */
export function pickHome(perChannel: PressVideo[][], cap = 18, lead = 6): PressVideo[] {
  // One per institution per day: the Riksbank posts its press conference
  // and the governor's short on the decision the same afternoon, and two
  // tiles from one event read as a duplicate.
  const seen = new Set<string>();
  const conferences = perChannel.map((l) => l
    .filter((v) => v.kind === "Press conference" || v.kind === "Rate decision")
    .sort(newestFirst)
    .filter((v) => { const k = `${v.bank} ${v.published.slice(0, 10)}`; if (seen.has(k)) return false; seen.add(k); return true; }));
  const core = new Set<VideoChannelId>(["fed", "ecb", "boe", "boc"]);
  const firsts = conferences.filter((l) => l.length > 0 && core.has(l[0].bank)).map((l) => l[0]);
  const firstIds = new Set(firsts.map((v) => v.videoId));
  const byDate = conferences.flat().filter((v) => !firstIds.has(v.videoId)).sort(newestFirst);
  // The tiles on show before "Show more" are the first `lead`: the four
  // live-card banks' newest, then the newest of the rest, in date order.
  // Behind the button, everything else by date.
  const shown = [...firsts, ...byDate].slice(0, lead).sort(newestFirst);
  const shownIds = new Set(shown.map((v) => v.videoId));
  return [...shown, ...byDate.filter((v) => !shownIds.has(v.videoId))].slice(0, cap);
}

/** The Videos page: everything, newest first, so a stale channel's June
 *  video can never look current -- at most ten per channel, or Norges
 *  Bank's two years of rate decisions would fill the page. */
export function pickAll(perChannel: PressVideo[][], cap = 60, perChannelCap = 10): PressVideo[] {
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

/** Every channel's feed, read now. A channel that fails even after its
 *  retry is simply absent from the map; nothing here throws. */
export async function fetchFeeds(): Promise<{ entries: Map<VideoChannelId, FeedEntry[]>; answered: number }> {
  const channels = Object.values(VIDEO_CHANNELS);
  const results = await Promise.allSettled(channels.map((c) => fetchFeed(c.youtubeChannelId)));
  const entries = new Map<VideoChannelId, FeedEntry[]>();
  results.forEach((r, i) => { if (r.status === "fulfilled") entries.set(channels[i].id, parseYoutubeFeed(r.value)); });
  return { entries, answered: entries.size };
}

// ------------------------------------------------------------
//  STORED VIDEOS (the press_videos table,
//  supabase/migrations/2026-09-22-press-videos.sql). Every video the site
//  has seen, saved by /api/refresh-videos, so a bad moment at YouTube can
//  no longer shrink the list. The raw title is stored, not our tags: the
//  RULES above run on stored rows as on live ones, so a rule changed later
//  applies to old videos too.
// ------------------------------------------------------------

export interface StoredVideo { video_id: string; channel: string; title: string; published: string; hidden?: boolean }

/** What /api/refresh-videos saves: every upload the feeds listed except
 *  Shorts (whether a video is a Short is known only from the feed's link,
 *  which is not stored). Uploads no rule keeps are saved too and dropped
 *  when read, so a rule added later can pick them up. */
export function rowsToSave(entries: Map<VideoChannelId, FeedEntry[]>): StoredVideo[] {
  const out: StoredVideo[] = [];
  for (const [channel, list] of entries) {
    for (const e of list) if (!e.isShort) out.push({ video_id: e.videoId, channel, title: e.title, published: e.published });
  }
  return out;
}

/** Stored rows back into feed entries, per channel -- only known channels
 *  and valid ids, whatever the table holds. */
export function storedEntries(rows: StoredVideo[]): Map<VideoChannelId, FeedEntry[]> {
  const out = new Map<VideoChannelId, FeedEntry[]>();
  for (const r of rows) {
    if (!Object.hasOwn(VIDEO_CHANNELS, r.channel) || !VIDEO_ID.test(r.video_id)) continue;
    const t = Date.parse(r.published);
    if (!Number.isFinite(t) || typeof r.title !== "string") continue;
    const channel = r.channel as VideoChannelId;
    out.set(channel, [...(out.get(channel) ?? []), { videoId: r.video_id, title: r.title, published: new Date(t).toISOString(), isShort: false }]);
  }
  return out;
}

/** Stored and live together, one entry per video; the live one wins, being
 *  the newer word on its title. */
export function mergeEntries(stored: Map<VideoChannelId, FeedEntry[]>, live: Map<VideoChannelId, FeedEntry[]>): Map<VideoChannelId, FeedEntry[]> {
  const out = new Map<VideoChannelId, FeedEntry[]>();
  for (const channel of new Set([...stored.keys(), ...live.keys()])) {
    const byId = new Map<string, FeedEntry>();
    for (const e of stored.get(channel) ?? []) byId.set(e.videoId, e);
    for (const e of live.get(channel) ?? []) byId.set(e.videoId, e);
    out.set(channel, [...byId.values()]);
  }
  return out;
}

export interface PressVideoSet {
  /** The homepage row: press conferences and rate decisions. */
  home: PressVideo[];
  /** The Videos page: everything kept, newest first. */
  all: PressVideo[];
  /** How many channels have at least one video in the answer. */
  covered: number;
}

/** The lists the site shows, from stored and live entries together. */
export function buildSet(entries: Map<VideoChannelId, FeedEntry[]>): PressVideoSet {
  const perChannel = (Object.keys(VIDEO_CHANNELS) as VideoChannelId[]).map((id) => videosIn(id, entries.get(id) ?? []));
  return { home: pickHome(perChannel), all: pickAll(perChannel), covered: perChannel.filter((l) => l.length > 0).length };
}

/** What is stored and what the feeds list now, as the lists the site
 *  shows. Pure, so the outage case is tested without a network. */
export function combine(stored: StoredVideo[], live: Map<VideoChannelId, FeedEntry[]>): PressVideoSet {
  // A video hidden by hand stays hidden even while the feed still lists
  // it: it is taken out of the live entries as well as the stored ones,
  // or "live wins" would put it straight back.
  const hidden = new Set(stored.filter((r) => r.hidden === true).map((r) => r.video_id));
  const liveShown = new Map([...live].map(([c, list]) => [c, list.filter((e) => !hidden.has(e.videoId))] as const));
  return buildSet(mergeEntries(storedEntries(stored.filter((r) => r.hidden !== true)), liveShown));
}

/** One read of every feed, merged with what is stored, serves both lists
 *  from one cached response. */
export async function fetchPressVideos(stored: StoredVideo[] = []): Promise<PressVideoSet> {
  const { entries } = await fetchFeeds();
  return combine(stored, entries);
}

/** Below this many channels with a video, an answer is a bad moment at
 *  YouTube with nothing stored to cover it, not the state of the channels. */
export const FULL_ANSWER_CHANNELS = 5;

/** How long the CDN may keep an answer. On 22 September 2026 YouTube's feed
 *  endpoint answered 404 or 500 for eight of nine channels; the one that
 *  answered was cached for an hour -- with a day's stale allowance on top --
 *  and the homepage showed one video instead of six. A thin answer is now
 *  kept for a minute, so the next request tries again. */
export function cacheControlFor(covered: number): string {
  return covered >= FULL_ANSWER_CHANNELS
    ? "public, s-maxage=3600, stale-while-revalidate=600"
    : "public, s-maxage=60";
}
