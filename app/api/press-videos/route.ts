// ============================================================
//  CENTRAL BANK VIDEOS, SERVED FROM THIS SITE
//
//  Every video the site has stored (the press_videos table, saved by
//  /api/refresh-videos) merged with the nine institutions' live YouTube
//  feeds (lib/fetchers/pressVideos.ts). Read here rather than by the
//  browser: YouTube's feed sends no CORS header, and reading once an hour
//  for the whole site beats once per visitor. One answer carries both
//  lists -- the homepage row and the Videos page.
//
//  READ-ONLY. This route is public, so it never writes; saving is the
//  secret-checked /api/refresh-videos.
//
//  WHY STORED ROWS. On 22 September 2026 YouTube's feed endpoint failed
//  for eight of nine channels and the homepage showed one video. With the
//  stored rows underneath, a failing feed just means that channel's newest
//  upload waits for the next good read; nothing already seen disappears.
//  If the table cannot be read, the live feeds alone are used.
//
//  CACHED AT THE CDN, NOT BY NEXT. With `revalidate` this route would be
//  pre-rendered, and a bad moment would be stored for the whole hour.
//  Dynamic instead, with the cache in the response header: an answer
//  covering most channels is kept an hour; a thin one a minute; nothing
//  at all is an empty list, also a minute, so the page quietly leaves the
//  row out instead of every visitor's browser logging an error. See
//  cacheControlFor.
// ============================================================

import { NextResponse } from "next/server";
import { fetchPressVideos, cacheControlFor, type StoredVideo } from "@/lib/fetchers/pressVideos";
import { getPublicSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Newest stored rows read per request: nine channels, at most ten each on
 *  the Videos page, with room for the rules to drop some. */
const STORED_ROWS = 400;

async function readStored(): Promise<StoredVideo[]> {
  try {
    const { data, error } = await getPublicSupabaseClient()
      .from("press_videos")
      .select("video_id, channel, title, published, hidden")
      .order("published", { ascending: false })
      .limit(STORED_ROWS)
      // A hung database must not hang the route: past three seconds the
      // live feeds are used alone.
      .abortSignal(AbortSignal.timeout(3000));
    return error || !Array.isArray(data) ? [] : (data as StoredVideo[]);
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const { home, all, covered } = await fetchPressVideos(await readStored());
    return NextResponse.json({ home, all }, { headers: { "Cache-Control": cacheControlFor(covered) } });
  } catch {
    return NextResponse.json({ home: [], all: [] }, { headers: { "Cache-Control": cacheControlFor(0) } });
  }
}
