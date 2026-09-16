// ============================================================
//  THE ANNOUNCEMENTS FEED, SERVED FROM THIS SITE
//
//  Why a route of our own rather than the browser fetching the ECB and
//  ONS directly: neither sends the CORS header a browser needs, so a
//  direct fetch from the page would simply fail. Fetching them here also
//  means the two feeds are read once every REVALIDATE_SECONDS for the
//  whole site, not once per visitor.
//
//  NOTHING HAS TO BE RUN FOR THIS TO STAY CURRENT. There is no cron, no
//  database table and no manual step: the first request after the cache
//  expires refreshes it, and every request until then is served from
//  cache. If both feeds are unreachable the answer is an empty list --
//  the page then shows what it showed before, which is the honest
//  outcome and not an error.
// ============================================================

import { NextResponse } from "next/server";
import { fetchAnnouncements } from "@/lib/fetchers/newsFeeds";

/** Fifteen minutes. The ECB publishes a handful of press releases a
 *  week and the ONS calendar changes daily, so this is far more often
 *  than either actually moves -- it is set for how quickly a new item
 *  should APPEAR, not for how often the sources change. */
const REVALIDATE_SECONDS = 900;

export const revalidate = 900;

export async function GET() {
  try {
    const items = await fetchAnnouncements();
    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=3600` } },
    );
  } catch {
    // A feed being down is not an error worth showing a reader: the
    // strip and the band simply carry nothing from it.
    return NextResponse.json(
      { items: [] },
      { headers: { "Cache-Control": `public, s-maxage=60` } },
    );
  }
}
