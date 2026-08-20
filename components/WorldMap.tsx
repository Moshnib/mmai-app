"use client";

import worldPaths from "@/lib/mapdata/world-paths.json";
import { bandFor } from "@/lib/scoring";
import { scoreMarket, type MarketData } from "@/lib/markets";

// ISO 3166-1 numeric country IDs (topojson world-atlas) grouped by market.
// Euro Area is represented by its largest constituent economies by land
// area/population, not all 20 members — enough to be visually recognizable
// as "Europe" on a low-resolution map without claiming precision it doesn't have.
const MARKET_COUNTRY_IDS: Record<string, string[]> = {
  US: ["840"],
  CA: ["124"],
  UK: ["826"],
  EA: ["250", "276", "380", "724", "528", "056", "040", "620", "372", "246", "300"],
};

export default function WorldMap({ markets, current, onSelect }: { markets: MarketData[]; current: string; onSelect: (code: string) => void }) {
  const countryToMarket: Record<string, string> = {};
  Object.entries(MARKET_COUNTRY_IDS).forEach(([market, ids]) => {
    ids.forEach((id) => { countryToMarket[id] = market; });
  });

  const marketByCode = Object.fromEntries(markets.map((m) => [m.code, m]));

  return (
    <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "22px 26px", backdropFilter: "blur(14px)" }}>
      <svg viewBox={`0 0 ${worldPaths.width} ${worldPaths.height}`} width="100%" style={{ display: "block" }}>
        {worldPaths.countries.map((c) => {
          const marketCode = countryToMarket[String(c.id)];
          const market = marketCode ? marketByCode[marketCode] : undefined;
          const isSelected = !!marketCode && marketCode === current;

          if (!market) {
            return <path key={c.id} d={c.d} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.4} />;
          }

          const { composite } = scoreMarket(market);
          const band = bandFor(composite);

          const tooltipText = `${market.name}: ${composite === null ? "N/A" : composite.toFixed(1)} — ${band.label}`;

          return (
            <path
              key={c.id}
              d={c.d}
              fill={band.color}
              fillOpacity={isSelected ? 0.95 : 0.72}
              stroke={isSelected ? "#fff" : band.color}
              strokeWidth={isSelected ? 1.1 : 0.5}
              style={{
                cursor: "pointer",
                filter: isSelected ? `drop-shadow(0 0 8px ${band.color})` : `drop-shadow(0 0 3px ${band.color}80)`,
                transition: "fill-opacity 0.25s ease, filter 0.25s ease",
              }}
              onClick={() => onSelect(marketCode)}
            >
              <title>{tooltipText}</title>
            </path>
          );
        })}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 18px", marginTop: 14, fontSize: 11, fontFamily: "monospace" }}>
        {markets.map((m) => {
          const { composite } = scoreMarket(m);
          const band = bandFor(composite);
          return (
            <span
              key={m.code}
              onClick={() => onSelect(m.code)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", color: m.code === current ? "#fff" : "#9296AB" }}
            >
              <i style={{ width: 8, height: 8, borderRadius: "50%", background: band.color, boxShadow: `0 0 6px ${band.color}` }} />
              {m.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}
