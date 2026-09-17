"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPublicSupabaseClient } from "@/lib/supabase";
import { FALLBACK_MARKETS } from "@/lib/markets";
import { STALE_THRESHOLD_MS } from "@/lib/constants";

// The one footer for the whole site (rendered from app/layout.tsx), carrying a
// live "last updated" stamp.
//
// It re-checks on its own in two situations, which between them cover every
// realistic way a visitor sees a stale figure:
//   - the tab is refocused after being left open (the common case -- the daily
//     refresh lands at 06:00 UTC, usually while nobody is looking)
//   - a long-open tab crosses that refresh, via a slow interval
//
// Deliberately NOT a realtime websocket subscription: the underlying data
// changes once per day, so holding a live connection open for every visitor
// would cost far more than it returns. If the refresh cadence ever becomes
// intraday, swapping this for Supabase Realtime is the right move.
const RECHECK_MS = 10 * 60 * 1000; // 10 minutes

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export default function SiteFooter() {
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [staleCount, setStaleCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
        const supabase = getPublicSupabaseClient();
        const { data, error } = await supabase
          .from("raw_indicators")
          .select("market, fetched_at")
          .order("observation_date", { ascending: false })
          .order("fetched_at", { ascending: false })
          .limit(200);
        if (cancelled || error || !data) return;

        // Only markets actually on the site. raw_indicators still holds rows
        // for retired (UAE) and paused (Norway) markets; those stopped
        // refreshing by definition, and letting them set this stamp would
        // report the site as days staler than it really is.
        const shown = new Set(FALLBACK_MARKETS.map((m) => m.code));
        const seen = new Set<string>();
        const latestPerMarket: string[] = [];
        for (const row of data as Array<{ market: string; fetched_at: string }>) {
          if (!shown.has(row.market) || seen.has(row.market)) continue;
          seen.add(row.market);
          latestPerMarket.push(row.fetched_at);
        }
        if (latestPerMarket.length === 0) return;

        // A market missing entirely from this result set (zero rows) is the
        // worst case and wouldn't otherwise show up anywhere in this
        // calculation -- count it as stale explicitly rather than let its
        // total absence silently make the site look fresher than it is.
        const now = Date.now();
        const staleFromMissing = shown.size - seen.size;
        const staleFromOldRows = latestPerMarket.filter((ts) => now - new Date(ts).getTime() > STALE_THRESHOLD_MS).length;
        setStaleCount(staleFromMissing + staleFromOldRows);

        // Oldest of the per-market latest fetches -- if one market stalled, say
        // so rather than claim the freshness of the one that happened to run.
        setLastUpdated(latestPerMarket.sort()[0]);
      } catch {
        // Unreachable -- keep whatever was last shown rather than blanking it.
      }
    }

    check();
    const interval = setInterval(check, RECHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <footer>
      {/* Contact left the top bar in September 2026; this is where readers
          look for it, beside the pages about the index itself. */}
      <nav className="wrap" aria-label="Site information">
        <ul className="site-footer-links">
          <li><Link href="/about">About MMAI</Link></li>
          <li><Link href="/learn">How the score works</Link></li>
          <li><Link href="/sources">Data sources</Link></li>
          <li><Link href="/contact">Contact</Link></li>
        </ul>
      </nav>
      <div className="wrap" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span>© 2026 MMAI — Moshnib Macro Analysis Index. Measuring the Pulse of the Economy. An analytical communication tool, not investment advice.</span>
        {lastUpdated && (
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11 }}>
            Data last updated {formatStamp(lastUpdated)}
            {staleCount > 0 && ` · ${staleCount} market${staleCount === 1 ? "" : "s"} not currently refreshing`}
          </span>
        )}
      </div>
    </footer>
  );
}
