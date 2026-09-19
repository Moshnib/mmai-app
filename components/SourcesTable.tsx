"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { slugify } from "@/lib/download";
import Flag from "@/components/Flag";
import { getPublicSupabaseClient } from "@/lib/supabase";
import type { FetchStatus } from "@/lib/sources";
import LiveBar from "@/components/LiveBar";
import { formatAgo, formatWhen, useNow } from "@/lib/liveTime";

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

export default function SourcesTable({
  groups,
  codeForName,
  freshnessTable = "raw_indicators",
  freshnessKeyColumn = "market",
  idPrefix,
}: {
  groups: Array<{ name: string; entries: DisplayableSource[] }>;
  codeForName: Record<string, string>;
  /** Which table to read "last refreshed" timestamps from. Gulf Watch's
   *  panel countries live in gulf_indicators, not raw_indicators. */
  freshnessTable?: "raw_indicators" | "gulf_indicators" | "observatory_indicators";
  /** The column identifying which group a freshness row belongs to --
   *  "market" for the scored markets, "country_code" for Gulf Watch and
   *  the Observatory. */
  freshnessKeyColumn?: "market" | "country_code";
  /** Prefix for each group's id ("src" -> #src-japan), which the jump
   *  links at the top of /sources point at. */
  idPrefix: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // A group named in the address (#src-japan) opens itself, on arrival and
  // whenever the hash changes. The DOM owns each <details>' open state --
  // never React -- so a re-render when the freshness times arrive cannot
  // snap an open group shut.
  useEffect(() => {
    const openFromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id.startsWith(`${idPrefix}-`)) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement && !el.open) {
        el.open = true;
        el.scrollIntoView({ block: "start" });
      }
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [idPrefix]);

  function setAll(open: boolean) {
    containerRef.current?.querySelectorAll("details").forEach((d) => { d.open = open; });
  }
  const [freshness, setFreshness] = useState<Record<string, string> | null>(null);
  // The clock behind "14 min ago", shared with the homepage bar.
  const now = useNow();

  /** The newest refresh anywhere in this table, for the status line. */
  const newest = useMemo(() => {
    const all = Object.values(freshness ?? {}).sort();
    return all.length ? all[all.length - 1] : null;
  }, [freshness]);

  const liveCount = groups.reduce((n, g) => n + g.entries.filter((e) => e.status === "live").length, 0);
  const totalCount = groups.reduce((n, g) => n + g.entries.length, 0);

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

  /** The raw stamp for a row, or null where there is nothing to show. */
  function stampFor(groupName: string, entry: DisplayableSource): string | null {
    if (entry.status !== "live" || !freshness) return null;
    if (groupName === "All markets") {
      const all = Object.values(freshness).sort();
      return all.length ? all[all.length - 1] : null;
    }
    const code = codeForName[groupName];
    return (code ? freshness[code] : undefined) ?? null;
  }

  return (
    <>
      {/* THE PAGE SHOULD READ LIKE SOMETHING THAT IS RUNNING.
          It is a register of live feeds, and it looked like a filing
          cabinet: every status the same weight, every timestamp the same
          grey as the licence text beside it. The owner asked for the feel
          of a terminal you can watch. So: a status line that counts the
          live feeds and names the last refresh, a LIVE badge with a
          pulsing dot, and times that tick over as you read. */}
      <LiveBar facts={[`${liveCount} of ${totalCount} feeds live`]} stamp={newest} />
      {/* FOLDED BY DEFAULT. Open, every group made /sources 32 screens long
          on a phone. Each fold still says how many sources it holds and how
          many are live, so the page reads as a register at a glance. */}
      <div className="sources-folds-bar">
        <button type="button" className="sources-folds-btn" onClick={() => setAll(true)}>Open all</button>
        <button type="button" className="sources-folds-btn" onClick={() => setAll(false)}>Close all</button>
      </div>
      <div ref={containerRef}>
      {groups.map((group) => {
        const live = group.entries.filter((e) => e.status === "live").length;
        return (
        <details key={group.name} id={`${idPrefix}-${slugify(group.name)}`} className="sources-group">
          <summary className="sources-summary">
            {codeForName[group.name] && (
              <span aria-hidden="true" className="sources-summary-flag"><Flag code={codeForName[group.name]} size={22} /></span>
            )}
            <span className="sources-summary-name">{group.name}</span>
            <span className="sources-summary-meta">
              {group.entries.length} source{group.entries.length === 1 ? "" : "s"}
              <span aria-hidden="true"> · {live} live</span>
            </span>
            <span className="sources-summary-chevron" aria-hidden="true">▾</span>
          </summary>
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
                <span data-label="Indicator" className="src-indicator">{e.indicator}</span>
                <span data-label="Institution" style={{ color: "var(--ink-soft)" }}>
                  {e.url ? (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="src-link"
                    >
                      {e.institution} <span aria-hidden="true">↗</span>
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
                  <span className={`src-badge src-badge-${e.status}`}>
                    {e.status === "live" && <i className="live-dot" aria-hidden="true" />}
                    {e.status === "live" ? "LIVE" : e.status === "manual" ? "MANUAL" : "UNAVAILABLE"}
                  </span>
                  {/* Audit M-5: "live" says the FETCHER works, not that the
                      figure is current. A World Bank annual series fetched
                      today is working, not new. Cadence separates the two. */}
                  {e.status === "live" && e.cadence && (
                    <span className="src-cadence">{cadenceLabel(e.cadence)}</span>
                  )}
                </span>
                <span data-label="Last refreshed" className="src-refreshed">
                  {(() => {
                    const stamp = stampFor(group.name, e);
                    if (e.status === "unavailable") return "—";
                    if (e.status !== "live") return "not live";
                    if (!stamp) return "—";
                    return (
                      <>
                        <span className="src-when">{formatWhen(stamp)}</span>
                        {now !== null && <span className="src-ago">{formatAgo(stamp, now)}</span>}
                      </>
                    );
                  })()}
                </span>
              </div>
            ))}
          </div>
        </details>
        );
      })}
      </div>
    </>
  );
}
