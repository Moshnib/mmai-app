// ============================================================
//  CENTRAL BANK PRESS CONFERENCES, LIVE
//
//  The homepage shows the next scheduled press conference, and while one
//  is on, a way to watch it. Pure: components/LivePressCard.tsx renders,
//  scripts/test-press-conferences.ts pins every rule here.
//
//  WHERE THE VIDEO COMES FROM. Each bank's OWN channel, taken from the
//  YouTube link on the bank's own website -- never from a YouTube handle.
//  "@bankofengland" is not the Bank of England; the Bank's site links to
//  a different channel. Checked 21 September 2026 against each channel's
//  most recent press conference:
//
//    ECB              live on YouTube (10 Sep 2026: stream 12:36 UTC,
//                     conference 14:45 Frankfurt)
//    Bank of England  live on YouTube, Monetary Policy Report conferences
//                     only (30 Jul 2026: stream began 11:59 UTC, i.e.
//                     13:00 London)
//    Bank of Canada   live on YouTube (conferences stream there; 21 Sep
//                     2026 press conference was live)
//    Federal Reserve  NOT live on YouTube. It streams on its own site
//                     (federalreserve.gov/live-broadcast.htm) and uploads
//                     the recording to YouTube about an hour later. So
//                     for the Fed the card links out while it is live.
//    RBA              no YouTube channel found; not included.
//
//  WHAT THIS COVERS. Scheduled conferences only, from each bank's
//  published calendar. An emergency meeting will not appear. The About
//  page says so.
//
//  THE SCHEDULE RUNS OUT. The dates below go to the end of 2027 (the
//  Bank of Canada's 2027 dates were not yet published). The test fails in
//  CI once fewer than three conferences remain, which is the reminder to
//  add the next year's dates from the calendars linked on each channel.
// ============================================================

export type BankId = "fed" | "ecb" | "boe" | "boc";

export interface Channel {
  id: BankId;
  name: string;
  /** Short form for tight spaces. */
  short: string;
  /** The official YouTube channel, from the link on the bank's own site. */
  youtubeChannelId: string;
  /** Where the conference is streamed live: embedded from YouTube, or
   *  only on the bank's own site (the Fed). */
  liveOn: "youtube" | "site";
  /** The page to open while it is live when liveOn is "site". */
  siteLiveUrl?: string;
  /** The bank's own calendar, where next year's dates come from. */
  calendarUrl: string;
}

export const CHANNELS: Record<BankId, Channel> = {
  fed: {
    id: "fed",
    name: "Federal Reserve",
    short: "Fed",
    youtubeChannelId: "UCAzhpt9DmG6PnHXjmJTvRGQ",
    liveOn: "site",
    siteLiveUrl: "https://www.federalreserve.gov/live-broadcast.htm",
    calendarUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  },
  ecb: {
    id: "ecb",
    name: "European Central Bank",
    short: "ECB",
    youtubeChannelId: "UCXB8fM4VyQubRu3UVGhd3wA",
    liveOn: "youtube",
    calendarUrl: "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html",
  },
  boe: {
    id: "boe",
    name: "Bank of England",
    short: "BoE",
    youtubeChannelId: "UCY70MMJ8Rj4wtwt7bVN6hIA",
    liveOn: "youtube",
    calendarUrl: "https://www.bankofengland.co.uk/monetary-policy/upcoming-mpc-dates",
  },
  boc: {
    id: "boc",
    name: "Bank of Canada",
    short: "BoC",
    youtubeChannelId: "UCY4EvEbIox0M4JuEsu5OKnQ",
    liveOn: "youtube",
    calendarUrl: "https://www.bankofcanada.ca/press/upcoming-events/",
  },
};

export interface ScheduledConference {
  bank: BankId;
  /** The conference day in the bank's own time zone. */
  date: string;
  /** Local start time of the press conference itself, not the decision. */
  time: string;
  timeZone: string;
}

const FED = (date: string): ScheduledConference => ({ bank: "fed", date, time: "14:30", timeZone: "America/New_York" });
const ECB = (date: string): ScheduledConference => ({ bank: "ecb", date, time: "14:45", timeZone: "Europe/Berlin" });
const BOE = (date: string): ScheduledConference => ({ bank: "boe", date, time: "13:00", timeZone: "Europe/London" });
const BOC = (date: string): ScheduledConference => ({ bank: "boc", date, time: "10:30", timeZone: "America/Toronto" });

/** Day two of each FOMC and ECB meeting; Bank of England only when a
 *  Monetary Policy Report is published (the other meetings have no press
 *  conference); Bank of Canada at 10:30, after the 09:45 decision. */
export const SCHEDULE: ScheduledConference[] = [
  // 2026, from 21 September
  BOC("2026-10-28"), FED("2026-10-28"), ECB("2026-10-29"), BOE("2026-11-05"),
  FED("2026-12-09"), BOC("2026-12-09"), ECB("2026-12-17"),
  // 2027 (Bank of Canada not yet published)
  FED("2027-01-27"), ECB("2027-02-04"), BOE("2027-02-04"), FED("2027-03-17"), ECB("2027-03-18"),
  FED("2027-04-28"), ECB("2027-04-29"), BOE("2027-04-29"), FED("2027-06-09"), ECB("2027-06-10"),
  FED("2027-07-28"), ECB("2027-07-22"), BOE("2027-07-29"), FED("2027-09-15"), ECB("2027-09-09"),
  FED("2027-10-27"), ECB("2027-10-28"), BOE("2027-11-04"), FED("2027-12-08"), ECB("2027-12-16"),
];

/** The instant a wall-clock time in a time zone happens, without a date
 *  library. Guess the time as if it were UTC, ask Intl what the zone's
 *  clock reads at that instant, and correct by the difference; a second
 *  pass settles the rare case where the correction crosses a clock
 *  change. */
export function zonedToUtc(date: string, time: string, timeZone: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  let t = wanted;
  for (let i = 0; i < 2; i++) t += wanted - wallClockAsUtc(t, timeZone);
  return t;
}

function wallClockAsUtc(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(instant));
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"));
}

export interface Conference extends ScheduledConference {
  start: number;
  channel: Channel;
}

export const conferences = (schedule = SCHEDULE): Conference[] =>
  schedule
    .map((s) => ({ ...s, start: zonedToUtc(s.date, s.time, s.timeZone), channel: CHANNELS[s.bank] }))
    .sort((a, b) => a.start - b.start);

const MIN = 60_000;
/** Opened early: banks start the stream before the conference (the ECB's
 *  began nine minutes early), and a stream that is already waiting is
 *  better than a card that still says "in 20 minutes". */
export const LIVE_LEAD_MS = 30 * MIN;
/** Press conferences overrun and start late; an hour is typical, so
 *  100 minutes covers a long one. */
export const LIVE_TAIL_MS = 100 * MIN;
/** After that, "Just ended" with a link to the recording, never the
 *  player: once the stream is over, YouTube's live embed shows only
 *  "unavailable". */
export const ENDED_TAIL_MS = 180 * MIN;

export interface LiveState {
  /** Every conference on now -- two can overlap (the ECB and the Bank of
   *  England both announce on 4 February and 29 April 2027). */
  live: Conference[];
  /** Finished within the last three hours. */
  ended: Conference[];
  next: Conference | null;
}

export function liveState(now: number, list = conferences()): LiveState {
  const live: Conference[] = [];
  const ended: Conference[] = [];
  let next: Conference | null = null;
  for (const c of list) {
    if (now >= c.start - LIVE_LEAD_MS && now < c.start + LIVE_TAIL_MS) live.push(c);
    else if (now >= c.start + LIVE_TAIL_MS && now < c.start + LIVE_TAIL_MS + ENDED_TAIL_MS) ended.push(c);
    else if (c.start - LIVE_LEAD_MS > now && next === null) next = c;
  }
  return { live, ended, next };
}

/** Calendar days from today to the conference day, both in the reader's
 *  time zone: 21 September to 28 October is 37, whatever the hour. */
export function daysUntil(start: number, now: number, timeZone: string): number {
  const day = (t: number) => {
    const s = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((day(start) - day(now)) / 86_400_000);
}

export const youtubeChannelUrl = (c: Channel) => `https://www.youtube.com/channel/${c.youtubeChannelId}`;
/** The channel's current live stream. Loaded only after the reader
 *  presses play (components/LivePressCard.tsx). */
export const youtubeLiveEmbedUrl = (c: Channel) =>
  `https://www.youtube-nocookie.com/embed/live_stream?channel=${c.youtubeChannelId}&autoplay=1`;

// ------------------------------------------------------------
//  RECORDED CONFERENCES. The shape lib/fetchers/pressVideos.ts produces
//  on the server and the card plays in the browser. Here, not there, so
//  the browser never downloads the feed reader.
// ------------------------------------------------------------

/** Every channel videos are read from: the four with a live schedule
 *  above, and five that only publish recordings. Each channel id was taken
 *  from the YouTube link on the institution's own website on 22 September
 *  2026, and one video from each was played in the embedded player before
 *  it was added. The IMF is absent: its site refuses automated readers, so
 *  its channel could not be confirmed from the IMF itself. */
export type VideoChannelId = BankId | "riksbank" | "norges" | "bis" | "boj" | "bok";

export interface VideoChannel {
  id: VideoChannelId;
  name: string;
  short: string;
  youtubeChannelId: string;
  /** The language the channel speaks; titles in any other are labelled. */
  lang: "en" | "sv" | "nb" | "ja" | "ko";
}

export const VIDEO_CHANNELS: Record<VideoChannelId, VideoChannel> = {
  fed: { id: "fed", name: CHANNELS.fed.name, short: CHANNELS.fed.short, youtubeChannelId: CHANNELS.fed.youtubeChannelId, lang: "en" },
  ecb: { id: "ecb", name: CHANNELS.ecb.name, short: CHANNELS.ecb.short, youtubeChannelId: CHANNELS.ecb.youtubeChannelId, lang: "en" },
  boe: { id: "boe", name: CHANNELS.boe.name, short: CHANNELS.boe.short, youtubeChannelId: CHANNELS.boe.youtubeChannelId, lang: "en" },
  boc: { id: "boc", name: CHANNELS.boc.name, short: CHANNELS.boc.short, youtubeChannelId: CHANNELS.boc.youtubeChannelId, lang: "en" },
  riksbank: { id: "riksbank", name: "Sveriges Riksbank", short: "Riksbank", youtubeChannelId: "UC3qYZncwsKcrbZIhOwYSxFQ", lang: "sv" },
  norges: { id: "norges", name: "Norges Bank", short: "Norges Bank", youtubeChannelId: "UCLpPYqWZAsa1epXpKccf37g", lang: "nb" },
  bis: { id: "bis", name: "Bank for International Settlements", short: "BIS", youtubeChannelId: "UCM_UXHYYPreAnuT5cmCN5TA", lang: "en" },
  boj: { id: "boj", name: "Bank of Japan", short: "BoJ", youtubeChannelId: "UC32Yu7NyStgmKYsXvYofPvQ", lang: "ja" },
  bok: { id: "bok", name: "Bank of Korea", short: "BoK", youtubeChannelId: "UCyK8niZNIfBTgRNkuURdoXA", lang: "ko" },
};

export type VideoKind =
  | "Press conference" | "Rate decision" | "Decision summary" | "Speech"
  | "Testimony" | "Hearing" | "Interview" | "Briefing" | "Report";

export const LANGUAGE_NAME: Record<VideoChannel["lang"], string> = {
  en: "English", sv: "Swedish", nb: "Norwegian", ja: "Japanese", ko: "Korean",
};

export interface PressVideo {
  bank: VideoChannelId;
  videoId: string;
  /** What the tile says: YouTube's title when it is in English, otherwise
   *  our own English label ("Riksbank press conference"). */
  title: string;
  kind: VideoKind;
  /** Language of the video; "en" unless the title is in another. */
  lang: VideoChannel["lang"];
  /** YouTube's own title, kept when it is not in English. */
  original?: string;
  /** ISO, when YouTube published it. */
  published: string;
}

/** YouTube video ids are exactly eleven of these. Anything else is not
 *  put into a URL -- checked on the server and again in the browser. */
export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export const youtubeVideoUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const youtubeVideoEmbedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
/** YouTube's own 320x180 thumbnail, built from the checked id rather than
 *  taken from the feed, so only i.ytimg.com is ever asked. */
export const youtubeThumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
