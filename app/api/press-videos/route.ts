// ============================================================
//  RECENT PRESS-CONFERENCE VIDEOS, SERVED FROM THIS SITE
//
//  The four banks' YouTube feeds (lib/fetchers/pressVideos.ts), read here
//  rather than by the browser: YouTube's feed sends no CORS header, and
//  reading once an hour for the whole site beats once per visitor.
//
//  CACHED AT THE CDN, NOT BY NEXT. With `revalidate` this route would be
//  pre-rendered, and a moment when every feed failed would be stored as
//  an empty list for the whole hour. Dynamic instead, with the cache in
//  the response header: a good answer is kept an hour (and served stale
//  for a day while it refreshes); a total failure answers 503, which is
//  not cached at all, and the page just leaves the section out.
// ============================================================

import { NextResponse } from "next/server";
import { fetchPressVideos } from "@/lib/fetchers/pressVideos";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const videos = await fetchPressVideos();
    return NextResponse.json({ videos }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ videos: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
