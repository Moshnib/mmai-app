// ============================================================
//  THE ANNOUNCEMENTS FEED, SERVED FROM THIS SITE
//
//  Nine institutions' own feeds (lib/newsSources.ts), read here rather
//  than by the browser: none of them sends the CORS header a browser
//  needs, so a direct fetch from the page would simply fail. Reading them
//  here also means each feed is read once every REVALIDATE_SECONDS for
//  the whole site, not once per visitor.
//
//  NOTHING HAS TO BE RUN FOR THIS TO STAY CURRENT. There is no cron, no
//  database table and no manual step: the first request after the cache
//  expires refreshes it, and every request until then is served from
//  cache. If every feed is unreachable the answer is an empty list --
//  the page then shows what it showed before, which is the honest
//  outcome and not an error.
// ============================================================

import { NextResponse } from "next/server";
import { fetchAllNews } from "@/lib/fetchers/newsFeeds";

/** Fifteen minutes. None of these institutions publishes more than a
 *  handful of items a day, so this is far more often than any of them
 *  moves -- it is set for how quickly a new item should APPEAR, not for
 *  how often the sources change. */
const REVALIDATE_SECONDS = 900;

export const revalidate = 900;

export async function GET() {
  try {
    const result = await fetchAllNews();
    return NextResponse.json(result, {
      headers: { "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=3600` },
    });
  } catch {
    // A feed being down is not an error worth showing a reader: the
    // strip and the band simply carry nothing from it.
    return NextResponse.json(
      { items: [], reachable: false, checkedAt: new Date().toISOString() },
      { headers: { "Cache-Control": `public, s-maxage=60` } },
    );
  }
}
