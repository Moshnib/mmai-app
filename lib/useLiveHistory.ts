"use client";

import { useEffect, useState } from "react";
import { HISTORY, type HistoryPoint } from "@/lib/history";
import { getPublicSupabaseClient } from "@/lib/supabase";

export interface RawIndicatorRow {
  market: string;
  inflation: number | null;
  gdp_growth: number | null;
  unemployment: number | null;
  policy_rate: number | null;
  brent_yoy: number | null;
  observation_date: string;
  // Per-indicator observation dates (audit M-6). OPTIONAL because not every
  // query selects them -- useLiveHistory does not need them, the homepage does.
  inflation_observation_date?: string | null;
  gdp_observation_date?: string | null;
  unemployment_observation_date?: string | null;
  policy_rate_observation_date?: string | null;
  brent_observation_date?: string | null;
}

/** Shared by the Trends and Compare pages (Overview/page.tsx has its own
 *  separate live-data pattern for a different data shape). Static
 *  lib/history.ts is the only source either page reads by default; this
 *  overlays live Supabase data on top so a fresh /api/refresh actually
 *  shows up on these pages, not just the Overview homepage.
 *
 *  Only the LAST point per market (the current-snapshot slot the
 *  project's convention already reserves for this -- see the comment at
 *  the top of lib/history.ts) gets its indicators replaced by the
 *  latest live row, when one exists. Its year label is derived from
 *  that row's own observation_date, not hardcoded, so this doesn't
 *  quietly start lying about the year once "2026" isn't current anymore. */
export function useLiveHistory(): { history: Record<string, HistoryPoint[]>; dataSource: "live" | "fallback" } {
  const [history, setHistory] = useState<Record<string, HistoryPoint[]>>(HISTORY);
  const [dataSource, setDataSource] = useState<"live" | "fallback">("fallback");

  useEffect(() => {
    async function load() {
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return; // not configured yet -- stay on the static snapshot
        const supabase = getPublicSupabaseClient();
        const { data, error } = await supabase
          .from("raw_indicators")
          .select("market, inflation, gdp_growth, unemployment, policy_rate, brent_yoy, observation_date")
          .order("observation_date", { ascending: false })
          .order("fetched_at", { ascending: false }) // tiebreak same-day reruns
          // 7 markets x daily refreshes -- 200 rows covers roughly a
          // month even with a couple of same-day reruns, so one market
          // stalling silently while the others keep refreshing doesn't
          // push its (still-recent) row past the cutoff.
          .limit(200);
        if (error || !data || data.length === 0) return;

        const latestByMarket = new Map<string, RawIndicatorRow>();
        for (const row of data as RawIndicatorRow[]) {
          if (!latestByMarket.has(row.market)) latestByMarket.set(row.market, row);
        }

        const merged: Record<string, HistoryPoint[]> = {};
        for (const [market, points] of Object.entries(HISTORY)) {
          const row = latestByMarket.get(market);
          if (!row || points.length === 0) {
            merged[market] = points;
            continue;
          }
          const liveYear = row.observation_date.slice(0, 4);
          const liveIndicators = {
            inflation: row.inflation,
            gdpGrowth: row.gdp_growth,
            unemployment: row.unemployment,
            policyRate: row.policy_rate,
            brentYoY: row.brent_yoy,
          };
          merged[market] = [...points.slice(0, -1), { year: liveYear, indicators: liveIndicators }];
        }
        setHistory(merged);
        setDataSource("live");
      } catch {
        // Supabase not reachable / not configured -- silently stay on the static snapshot.
      }
    }
    load();
  }, []);

  return { history, dataSource };
}
