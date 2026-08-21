"use client";

import worldPaths from "@/lib/mapdata/world-paths.json";
import { bandFor } from "@/lib/scoring";
import { scoreMarket, type MarketData } from "@/lib/markets";
import Flag from "@/components/Flag";

// ISO 3166-1 numeric country IDs (topojson world-atlas) grouped by market.
// Euro Area is represented by its largest constituent economies by land
// area/population, not all 20 members — enough to be visually recognizable
// as "Europe" on a low-resolution map without claiming precision it doesn't have.
const MARKET_COUNTRY_IDS: Record<string, string[]> = {
  US: ["840"],
  CA: ["124"],
  UK: ["826"],
  JP: ["392"],
  AU: ["036"],
  EA: ["250", "276", "380", "724", "528", "056", "040", "620", "372", "246", "300"],
};

// Approximate [longitude, latitude] label anchor per market — not a precise
// geographic centroid, just a readable point roughly inside each market's
// landmass, nudged apart where markets sit close together (UK/Euro Area).
const MARKET_LABEL_LONLAT: Record<string, [number, number]> = {
  US: [-98, 39],
  CA: [-100, 58],
  UK: [-3.5, 55.5],
  JP: [138, 37],
  AU: [134, -25],
  EA: [14, 47],
};

function project(lon: number, lat: number, width: number, height: number): [number, number] {
  const x = ((lon + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return [x, y];
}

export default function WorldMap({ markets, current, onSelect }: { markets: MarketData[]; current: string; onSelect: (code: string) => void }) {
  const countryToMarket: Record<string, string> = {};
  Object.entries(MARKET_COUNTRY_IDS).forEach(([market, ids]) => {
    ids.forEach((id) => { countryToMarket[id] = market; });
  });

  const marketByCode = Object.fromEntries(markets.map((m) => [m.code, m]));

  return (
    <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "22px 26px", backdropFilter: "blur(14px)" }}>
      <svg viewBox={`0 0 ${worldPaths.width} ${worldPaths.height}`} width="100%" style={{ display: "block" }}>
        {worldPaths.countries.map((c, i) => {
          const key = c.id ?? `country-${i}`;
          const marketCode = countryToMarket[String(c.id)];
          const market = marketCode ? marketByCode[marketCode] : undefined;
          const isSelected = !!marketCode && marketCode === current;

          if (!market) {
            return <path key={key} d={c.d} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.4} />;
          }

          const { composite } = scoreMarket(market);
          const band = bandFor(composite);
          const tooltipText = `${market.name}: ${composite === null ? "N/A" : composite.toFixed(1)} — ${band.label}`;

          return (
            <path
              key={key}
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

        {/* Score labels, drawn on top of the country shapes so the number
            is always visible without needing to hover. */}
        {markets.map((m) => {
          const pos = MARKET_LABEL_LONLAT[m.code];
          if (!pos) return null;
          const [x, y] = project(pos[0], pos[1], worldPaths.width, worldPaths.height);
          const { composite } = scoreMarket(m);
          const band = bandFor(composite);
          const label = composite === null ? "N/A" : composite.toFixed(1);
          const isSelected = m.code === current;
          const pillW = label.length > 3 ? 40 : 34;

          return (
            <g
              key={m.code}
              style={{ cursor: "pointer", pointerEvents: "auto" }}
              onClick={() => onSelect(m.code)}
            >
              <rect
                x={x - pillW / 2}
                y={y - 11}
                width={pillW}
                height={22}
                rx={11}
                fill="rgba(8,8,13,0.82)"
                stroke={band.color}
                strokeWidth={isSelected ? 1.4 : 0.8}
                style={{ filter: isSelected ? `drop-shadow(0 0 6px ${band.color})` : undefined }}
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fontFamily="'Space Grotesk', sans-serif"
                fontWeight={700}
                fontSize={10.5}
                fill={band.color}
                style={{ pointerEvents: "none" }}
              >
                {label}
              </text>
            </g>
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
              <Flag code={m.code} size={16} />
              {m.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}
