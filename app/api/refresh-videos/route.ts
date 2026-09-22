// ============================================================
//  SAVE EVERY CENTRAL BANK VIDEO THE FEEDS LIST
//
//  Called by the refresh workflow (.github/workflows/refresh.yml), four
//  times a day, with CRON_SECRET. Reads the nine channels' YouTube feeds
//  and upserts every upload they list, except Shorts, into press_videos
//  (supabase/migrations/2026-09-22-press-videos.sql). What /api/press-videos
//  shows is built from those rows plus the live feeds, so once a video has
//  been seen here, a failing feed can no longer take it off the site.
//
//  Adds and updates, never deletes. A channel that fails this time is
//  simply read again next time. The raw title is saved, not our tags --
//  see lib/fetchers/pressVideos.ts.
//
//  Answers 502 when no channel answered at all, so the workflow's log and
//  the source audit see a stop instead of a quiet "0 saved".
// ============================================================

import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cronAuth";
import { getServiceSupabaseClient } from "@/lib/supabase";
import { fetchFeeds, rowsToSave } from "@/lib/fetchers/pressVideos";
import { VIDEO_CHANNELS } from "@/lib/pressConferences";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Fails CLOSED: see lib/cronAuth.ts.
  const auth = checkCronAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  const channels = Object.keys(VIDEO_CHANNELS).length;
  const { entries, answered } = await fetchFeeds();
  if (answered === 0) {
    return NextResponse.json({ answered, channels, saved: 0, error: "no YouTube feed answered" }, { status: 502 });
  }

  const rows = rowsToSave(entries);
  // first_seen and hidden are left alone on a row already stored: the
  // upsert writes only these four columns.
  const { error } = await getServiceSupabaseClient()
    .from("press_videos")
    .upsert(rows, { onConflict: "video_id" });
  if (error) {
    return NextResponse.json({ answered, channels, saved: 0, error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    answered,
    channels,
    saved: rows.length,
    missing: Object.keys(VIDEO_CHANNELS).filter((id) => !entries.has(id as keyof typeof VIDEO_CHANNELS)),
  });
}
