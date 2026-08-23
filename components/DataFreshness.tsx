"use client";

import { useEffect, useState } from "react";
import { getPublicSupabaseClient } from "@/lib/supabase";
import { FALLBACK_MARKETS } from "@/lib/markets";
import Flag from "@/components/Flag";

// The Sources table's "Licence checked" column is a hand-maintained date --
// when someone last read the institution's licence terms. It deliberately
// does NOT move when data refreshes, which reads as staleness if you expect
// it to. This panel shows the thing people actually look for there: when each
// market's numbers were last pulled.

interface Row {
  market: string;
  observation_date: string;
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

export default function DataFreshness() {
  const [latest, setLatest] = useState<Record<string, Row> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
        const supabase = getPublicSupabaseClient();
        const { data, error } = await supabase
          .from("raw_indicators")
          .select("market, observation_date, fetched_at")
          .order("observation_date", { ascending: false })
          .order("fetched_at", { ascending: false })
          .limit(200);
        if (error || !data) return;

        const byMarket: Record<string, Row> = {};
        for (const row of data as Row[]) {
          if (!byMarket[row.market]) byMarket[row.market] = row;
        }
        setLatest(byMarket);
      } catch {
        // Supabase unreachable -- render nothing rather than a wrong claim.
      }
    }
    load();
  }, []);

  if (!latest) return null;

  // Only markets actually on the site: raw_indicators still holds rows for
  // retired (UAE) and paused (Norway) markets, which stopped refreshing by
  // definition and would look alarmingly stale here.
  const shown = FALLBACK_MARKETS.filter((m) => latest[m.code]);
  if (shown.length === 0) return null;

  return (
    <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--hair)", borderRadius: 16, padding: "20px 24px", backdropFilter: "blur(10px)", marginBottom: 28 }}>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5, fontWeight: 700, color: "var(--gold-deep)", letterSpacing: 1, marginBottom: 10 }}>
        WHEN THE DATA LAST REFRESHED
      </div>
      <p style={{ fontSize: 12.5, color: "var(--slate)", margin: "0 0 14px" }}>
        Every market re-fetches automatically once a day at 06:00 UTC. This is the last time each one actually
        landed — separate from the licence-check dates in the table below, which are maintained by hand.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
        {shown.map((m) => (
          <div
            key={m.code}
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink-soft)", background: "var(--glass)", border: "1px solid var(--hair)", borderRadius: 10, padding: "8px 12px" }}
          >
            <Flag code={m.code} size={16} />
            <span style={{ fontWeight: 600 }}>{m.name}</span>
            <span style={{ marginLeft: "auto", fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "var(--slate)" }}>
              {formatWhen(latest[m.code].fetched_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
