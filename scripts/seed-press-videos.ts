// ============================================================
//  SEED press_videos FROM THE CAPTURED FEEDS
//
//  One-off. On 22 September 2026 the press_videos table was created while
//  YouTube's feed endpoint was answering 404 for every channel, so
//  /api/refresh-videos had nothing to save and the homepage had nothing
//  to show. The feeds captured for the tests (scripts/fixtures/press-videos)
//  are the institutions' own feeds, so they seed the table: every upload
//  they list except Shorts, exactly as /api/refresh-videos saves them.
//
//  Prints SQL rather than writing, because the service-role key is a
//  Vercel secret and the copy on the laptop had lapsed: the SQL is pasted
//  into the Supabase SQL editor. "on conflict do nothing" adds missing rows
//  only -- never overwrites a row the refresh has saved or one hidden by
//  hand. Safe to run again.
//
//    npx tsx scripts/seed-press-videos.ts > seed.sql
// ============================================================

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYoutubeFeed, rowsToSave, type FeedEntry } from "../lib/fetchers/pressVideos";
import { VIDEO_CHANNELS, VIDEO_ID, type VideoChannelId } from "../lib/pressConferences";

const dir = join(__dirname, "fixtures", "press-videos");
const entries = new Map<VideoChannelId, FeedEntry[]>();
for (const file of readdirSync(dir).filter((f) => f.endsWith(".xml"))) {
  const channel = file.split("-")[0];
  if (!Object.hasOwn(VIDEO_CHANNELS, channel)) continue;
  entries.set(channel as VideoChannelId, parseYoutubeFeed(readFileSync(join(dir, file), "utf8")));
}

// SQL string literals: a quote is doubled. The id and channel are checked
// against their patterns first, so only the title can carry one.
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const rows = rowsToSave(entries).filter((r) => VIDEO_ID.test(r.video_id));
console.log("insert into press_videos (video_id, channel, title, published) values");
console.log(rows.map((r) => `  (${q(r.video_id)}, ${q(r.channel)}, ${q(r.title)}, ${q(r.published)})`).join(",\n"));
console.log("on conflict (video_id) do nothing;");
