"use client";

import { useEffect, useState } from "react";
import Flag from "@/components/Flag";
import { getPublicSupabaseClient } from "@/lib/supabase";
import type { FetchStatus } from "@/lib/sources";

// Structural, not the concrete SourceEntry type: this lets both
// lib/sources.ts's SourceEntry[] and lib/gulfSources.ts's
// GulfSourceEntry[] satisfy it directly (they share these field names),
// without a "market"/"pillar" vs "country"/"category" mapping step --
// this component never reads those fields anyway.
interface DisplayableSource {
  indicator: string;
  institution: string;
  license: string;
  status: FetchStatus;
  /** Publishing cadence of the issuing institution. Optional because the
   *  Gulf registry shares this shape and does not carry it yet. */
  cadence?: string;
  note?: string;
  url?: string;
}

/** Cadence values are adjectives ("annual"), so interpolating them raw
 *  produced "updates annual". Mapped to adverbs here rather than storing
 *  display strings in the registry, which should hold facts not prose. */
function cadenceLabel(c: string | undefined): string | null {
  switch (c) {
    case "daily": return "updates daily";
    case "monthly": return "updates monthly";
    case "quarterly": return "updates quarterly";
    case "annual": return "updates once a year";
    case "per decision": return "updates per rate decision";
    default: return null;
  }
}

// The Sources table, with a live "last refreshed" column.
//
// It deliberately does NOT surface SourceEntry.lastVerified (the date a human
// last read the institution's licence terms). That date is real and worth
// keeping, but it's maintenance metadata: it only moves when someone actually
// re-reads a licence, so on a public page it reads as staleness. What a
// visitor wants here is when the numbers last came in, which is what this
// shows.
//
// Freshness is per-market, not per-indicator: one refresh writes a single row
// covering all of a market's indicators, so every row in a market's group
// shares the same timestamp. The shared Brent row (market "All markets") takes
// the most recent refresh across the site, since that's when it last landed.

interface FreshRow {
  [key: string]: string; // "market" or "country_code", plus fetched_at
  fetched_at: string;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export default function SourcesTable({
  groups,
  codeForName,
  freshnessTable = "raw_indicators",
  freshnessKeyColumn = "market",
}: {
  groups: Array<{ name: string; entries: DisplayableSource[] }>;
  codeForName: Record<string, string>;
  /** Which table to read "last refreshed" timestamps from. Gulf Watch's
   *  panel countries live in gulf_indicators, not raw_indicators. */
  freshnessTable?: "raw_indicators" | "gulf_indicators";
  /** The column identifying which group a freshness row belongs to --
   *  "market" for the 6 scored markets, "country_code" for Gulf Watch. */
  freshnessKeyColumn?: "market" | "country_code";
}) {
  const [freshness, setFreshness] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
        const supabase = getPublicSupabaseClient();
        // gulf_indicators sorts by fetched_at ONLY -- a row's
        // observation_date can fall back to "today" when a fetch fails
        // (see app/gulf-watch/GulfWatchPageInner.tsx for the full story),
        // which would otherwise sort a failed run ahead of a real, earlier
        // -dated successful one. raw_indicators doesn't have this failure
        // mode, so its existing observation_date-first order is untouched.
        let query = supabase.from(freshnessTable).select(`${freshnessKeyColumn}, fetched_at`);
        query = freshnessTable === "gulf_indicators" ? query.order("fetched_at", { ascending: false }) : query.order("observation_date", { ascending: false }).order("fetched_at", { ascending: false });
        const { data, error } = await query.limit(200);
        if (cancelled || error || !data) return;

        const byMarket: Record<string, string> = {};
        for (const row of data as FreshRow[]) {
          const key = row[freshnessKeyColumn];
          if (key && !byMarket[key]) byMarket[key] = row.fetched_at;
        }
        setFreshness(byMarket);
      } catch {
        // Unreachable -- the column falls back to "—" rather than guessing.
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [freshnessTable, freshnessKeyColumn]);

  function refreshedFor(groupName: string, entry: DisplayableSource): string {
    if (entry.status === "unavailable") return "—";
    if (entry.status !== "live") return "not live";
    if (!freshness) return "—";
    if (groupName === "All markets") {
      const all = Object.values(freshness).sort();
      return all.length ? formatWhen(all[all.length - 1]) : "—";
    }
    const code = codeForName[groupName];
    const stamp = code ? freshness[code] : undefined;
    return stamp ? formatWhen(stamp) : "—";
  }

  return (
    <>
      {groups.map((group) => (
        <div key={group.name} style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, margin: "0 0 12px", color: "var(--ink)", display: "flex", alignItems: "center", gap: 10 }}>
            {codeForName[group.name] && <Flag code={codeForName[group.name]} size={22} />}
            {group.name}
          </h2>
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--hair)", borderRadius: 6, overflow: "hidden" }}>
            <div className="sources-head" style={{ background: "var(--hover)", fontFamily: "IBM Plex Mono, monospace", fontWeight: 700, color: "var(--slate)", letterSpacing: 0.5 }}>
              <span>INDICATOR</span>
              <span>INSTITUTION</span>
              <span>LICENCE</span>
              <span>STATUS</span>
              <span>LAST REFRESHED</span>
            </div>
            {group.entries.map((e, i) => (
              <div
                key={i}
                className="sources-row"
                style={{ borderTop: i > 0 ? "1px solid var(--hair)" : undefined }}
              >
                <span data-label="Indicator" style={{ fontWeight: 700, color: "var(--ink)" }}>{e.indicator}</span>
                <span data-label="Institution" style={{ color: "var(--ink-soft)" }}>
                  {e.url ? (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--ink-soft)", textDecoration: "underline", textDecorationColor: "var(--hair)", textUnderlineOffset: 3 }}
                    >
                      {e.institution} <span style={{ color: "var(--slate)", fontSize: 11 }}>↗</span>
                    </a>
                  ) : (
                    e.institution
                  )}
                </span>
                <span data-label="Licence" style={{ color: "var(--slate)" }}>
                  {e.license}
                  {e.note && <div style={{ fontSize: 11, fontStyle: "italic", color: "var(--accent-2)", marginTop: 2 }}>{e.note}</div>}
                </span>
                <span data-label="Status">
                  <span
                    style={{
                      fontFamily: "IBM Plex Mono, monospace",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 9px",
                      borderRadius: 3,
                      background: e.status === "live" ? "var(--status-live-bg)" : e.status === "manual" ? "var(--status-manual-bg)" : "rgba(255,255,255,0.06)",
                      color: e.status === "live" ? "var(--status-live)" : e.status === "manual" ? "var(--accent-2)" : "var(--slate)",
                    }}
                  >
                    {e.status === "live" ? "LIVE" : e.status === "manual" ? "MANUAL" : "UNAVAILABLE"}
                  </span>
                  {/* Audit M-5: "live" says the FETCHER works, not that the
                      figure is current. A World Bank annual series fetched
                      today is working, not new. Cadence separates the two. */}
                  {e.status === "live" && e.cadence && (
                    <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "var(--slate)", marginLeft: 7 }}>
                      {cadenceLabel(e.cadence)}
                    </span>
                  )}
                </span>
                <span data-label="Last refreshed" style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "var(--slate)" }}>
                  {refreshedFor(group.name, e)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
