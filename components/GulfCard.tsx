"use client";

import Flag from "@/components/Flag";

export interface GulfCardData {
  code: string;
  name: string;
  cpiYoy: number | null;
  realEstateValue: number | null;
  realEstateMetricLabel: string | null;
  fxReservesMonthsImports: number | null;
  currentAccountPctGdp: number | null;
  fetchedAt: string | null;
  hasScore?: boolean; // Oman-shaped escape hatch for later, unused today
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0" }}>
      <span style={{ fontSize: 11.5, color: "var(--slate)" }}>{label}</span>
      <span style={{ fontFamily: "Space Grotesk, monospace", fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export default function GulfCard({ country }: { country: GulfCardData }) {
  const isStale = !country.fetchedAt || Date.now() - new Date(country.fetchedAt).getTime() > 72 * 60 * 60 * 1000;

  return (
    <div className="compare-card" style={{ cursor: "default" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Flag code={country.code} size={22} />
        <span className="compare-name">{country.name}</span>
      </div>

      <div style={{ borderTop: "1px solid var(--hair)", paddingTop: 4 }}>
        <Stat label="Inflation (YoY)" value={isStale || country.cpiYoy == null ? null : `${country.cpiYoy.toFixed(1)}%`} />
        <Stat
          label={country.realEstateMetricLabel ?? "Real estate activity"}
          value={isStale || country.realEstateValue == null ? null : country.realEstateValue.toLocaleString()}
        />
        <Stat
          label="FX reserves"
          value={isStale || country.fxReservesMonthsImports == null ? null : `${country.fxReservesMonthsImports.toFixed(1)} mo. imports`}
        />
        <Stat
          label="Current account"
          value={isStale || country.currentAccountPctGdp == null ? null : `${country.currentAccountPctGdp.toFixed(1)}% of GDP`}
        />
      </div>

      <div style={{ borderTop: "1px solid var(--hair)", marginTop: 8, paddingTop: 8, fontSize: 10.5, color: "var(--slate)", lineHeight: 1.5 }}>
        {isStale ? (
          "Not currently refreshing — no recent data available."
        ) : (
          "No composite score — policy rate data isn't available for this country."
        )}
      </div>
    </div>
  );
}
