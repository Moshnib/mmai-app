// ============================================================
//  CENTRAL BANK VIDEOS, SERVED FROM THIS SITE
//
//  Nine institutions' YouTube feeds (lib/fetchers/pressVideos.ts), read
//  here rather than by the browser: YouTube's feed sends no CORS header,
//  and reading once an hour for the whole site beats once per visitor.
//  One answer carries both lists -- the homepage row and the Videos page
//  -- so the feeds are read once and cached once.
//
//  CACHED AT THE CDN, NOT BY NEXT. With `revalidate` this route would be
//  pre-rendered, and a moment when every feed failed would be stored as
//  an empty list for the whole hour. Dynamic instead, with the cache in
//  the response header: an answer from most channels is kept an hour; one
//  from only a few (YouTube's feed endpoint fails in bursts) is kept a
//  minute, so it cannot stand in for the full list; a total failure is an
//  empty list, also kept a minute. See cacheControlFor.
// ============================================================

import { NextResponse } from "next/server";
import { fetchPressVideos, cacheControlFor } from "@/lib/fetchers/pressVideos";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { home, all, answered } = await fetchPressVideos();
    return NextResponse.json({ home, all }, { headers: { "Cache-Control": cacheControlFor(answered) } });
  } catch {
    // Every feed failed. That is YouTube having a bad minute (it happens,
    // and it happened in CI on 22 September), not a fault here: answered
    // as an empty list, kept a minute, so the page quietly leaves the
    // videos out instead of every visitor's browser logging a 503.
    return NextResponse.json({ home: [], all: [] }, { headers: { "Cache-Control": cacheControlFor(0) } });
  }
}
