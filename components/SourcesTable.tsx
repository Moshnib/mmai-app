"use client";

import { useEffect, useState } from "react";
import Flag from "@/components/Flag";
import { getPublicSupabaseClient } from "@/lib/supabase";
import type { SourceEntry } from "@/lib/sources";

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
  market: string;
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

const GRID = "1.4fr 1.6fr 2.2fr 0.9fr 1.15fr";

export default function SourcesTable({
  groups,
  codeForName,
}: {
  groups: Array<{ name: string; entries: SourceEntry[] }>;
  codeForName: Record<string, string>;
}) {
  const [freshness, setFreshness] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
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

        const byMarket: Record<string, string> = {};
        for (const row of data as FreshRow[]) {
          if (!byMarket[row.market]) byMarket[row.market] = row.fetched_at;
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
  }, []);

  function refreshedFor(groupName: string, entry: SourceEntry): string {
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
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: 19, fontWeight: 600, margin: "0 0 12px", color: "var(--ink)", display: "flex", alignItems: "center", gap: 10 }}>
            {codeForName[group.name] && <Flag code={codeForName[group.name]} size={22} />}
            {group.name}
          </h2>
          <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--hair)", borderRadius: 14, overflow: "hidden", backdropFilter: "blur(14px)" }}>
            <div style={{ display: "grid", gridTemplateColumns: GRID, background: "rgba(139,92,246,0.18)", padding: "10px 18px", fontSize: 10.5, fontFamily: "monospace", fontWeight: 700, color: "var(--gold)", letterSpacing: 0.5 }}>
              <span>INDICATOR</span>
              <span>INSTITUTION</span>
              <span>LICENCE</span>
              <span>STATUS</span>
              <span>LAST REFRESHED</span>
            </div>
            {group.entries.map((e, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID,
                  padding: "12px 18px",
                  fontSize: 12.5,
                  borderTop: i > 0 ? "1px solid var(--hair)" : undefined,
                  alignItems: "start",
                  gap: 6,
                }}
              >
                <span style={{ fontWeight: 700, color: "var(--ink)" }}>{e.indicator}</span>
                <span style={{ color: "var(--ink-soft)" }}>
                  {e.url ? (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--ink-soft)", textDecoration: "underline", textDecorationColor: "var(--hair)", textUnderlineOffset: 3 }}
                    >
                      {e.institution} <span style={{ color: "var(--slate)", fontSize: 10 }}>↗</span>
                    </a>
                  ) : (
                    e.institution
                  )}
                </span>
                <span style={{ color: "var(--slate)" }}>
                  {e.license}
                  {e.note && <div style={{ fontSize: 10.5, fontStyle: "italic", color: "var(--gold-deep)", marginTop: 2 }}>{e.note}</div>}
                </span>
                <span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "3px 9px",
                      borderRadius: 999,
                      background: e.status === "live" ? "var(--teal-bg)" : "var(--gold-bg)",
                      color: e.status === "live" ? "var(--teal)" : "var(--gold-deep)",
                    }}
                  >
                    {e.status === "live" ? "LIVE" : "MANUAL"}
                  </span>
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--slate)" }}>
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
