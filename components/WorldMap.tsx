"use client";

import { useRef, useState } from "react";
import worldPaths from "@/lib/mapdata/world-paths.json";
import { colorForScore } from "@/lib/indicators";
import { percentileBandLabel } from "@/lib/composite";
import { scoreMarketV2, type MarketData } from "@/lib/markets";

/** One place for the score-plus-label pair, so the map cannot drift onto a
 *  different engine from the panel above it — which it briefly did. */
function scoreOf(m: MarketData) {
  const { percentile } = scoreMarketV2(m);
  return { composite: percentile, band: { color: colorForScore(percentile), label: percentileBandLabel(percentile) } };
}
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
  NO: ["578"],
};

// Approximate [longitude, latitude] label anchor per market — not a precise
// geographic centroid, just a readable point roughly inside each market's
// landmass, nudged apart where markets sit close together (UK/Euro Area).
const MARKET_LABEL_LONLAT: Record<string, [number, number]> = {
  US: [-98, 39],
  CA: [-100, 62],
  UK: [-3.5, 55.5],
  JP: [138, 37],
  AU: [134, -27],
  EA: [14, 47],
  NO: [15, 64],
};

// Crops out the empty Antarctica band at the bottom of the equirectangular
// projection (lat below roughly -60) so the six scored markets fill more of
// the frame -- same underlying map data, just a tighter viewBox. Confirmed
// this keeps Australia's full landmass (Tasmania's southern tip projects to
// y≈355 of 480) with real margin to spare.
const CROP_HEIGHT = 420;

function project(lon: number, lat: number, width: number, height: number): [number, number] {
  const x = ((lon + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return [x, y];
}

// Every click target on this map (country shape, score label, legend entry)
// was mouse/touch-only -- no role, no tabIndex, no way to tell a keyboard or
// screen-reader user it was interactive at all, let alone activate it. This
// makes any of them behave like a real button: focusable, announced, and
// activatable with Enter or Space, on top of the click handler each element
// already has.
function a11yButtonProps(label: string, onActivate: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": label,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
  };
}

interface HoverState {
  code: string;
  x: number;
  y: number;
}

export default function WorldMap({ markets, current, onSelect }: { markets: MarketData[]; current: string; onSelect: (code: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  const countryToMarket: Record<string, string> = {};
  Object.entries(MARKET_COUNTRY_IDS).forEach(([market, ids]) => {
    ids.forEach((id) => { countryToMarket[id] = market; });
  });

  const marketByCode = Object.fromEntries(markets.map((m) => [m.code, m]));

  function handleHoverMove(code: string, e: React.MouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Skip the re-render (177 country paths + 6 labels) on sub-pixel
    // jitter -- the tooltip only needs to track the cursor closely enough
    // to look attached, not on every single mousemove tick.
    setHover((prev) => (prev && prev.code === code && Math.abs(prev.x - x) < 2 && Math.abs(prev.y - y) < 2 ? prev : { code, x, y }));
  }
  function handleHoverEnd() {
    setHover(null);
  }

  const hoverMarket = hover ? marketByCode[hover.code] : null;
  const hoverBand = hoverMarket ? scoreOf(hoverMarket).band : null;

  return (
    <div
      ref={containerRef}
      style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "22px 26px", backdropFilter: "blur(14px)", position: "relative" }}
    >
      <svg viewBox={`0 0 ${worldPaths.width} ${CROP_HEIGHT}`} width="100%" style={{ display: "block" }}>
        {worldPaths.countries.map((c, i) => {
          const key = c.id ?? `country-${i}`;
          const marketCode = countryToMarket[String(c.id)];
          const market = marketCode ? marketByCode[marketCode] : undefined;
          const isSelected = !!marketCode && marketCode === current;

          if (!market) {
            return <path key={key} d={c.d} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.4} />;
          }

          const { band } = scoreOf(market);

          return (
            <path
              key={key}
              d={c.d}
              fill={band.color}
              fillOpacity={isSelected ? 1 : 0.8}
              stroke={isSelected ? "#fff" : band.color}
              strokeWidth={isSelected ? 1.3 : 0.4}
              style={{ cursor: "pointer", transition: "fill-opacity 0.15s ease, stroke-width 0.15s ease" }}
              onClick={() => onSelect(marketCode)}
              onMouseMove={(e) => handleHoverMove(marketCode, e)}
              onMouseLeave={handleHoverEnd}
              // Not a keyboard/screen-reader target: Euro Area alone would
              // otherwise expose 11 identically-labeled tab stops (one per
              // constituent country path). The score label below is the
              // one focusable target per market and carries the full
              // accessible name; this shape is mouse/touch-only.
              tabIndex={-1}
              aria-hidden="true"
            />
          );
        })}

        {/* Score labels, drawn on top of the country shapes so the number
            is always visible without needing to hover -- a dark halo
            (paint-order: stroke) keeps a same-colored number legible
            against its own country's fill. */}
        {markets.map((m) => {
          const pos = MARKET_LABEL_LONLAT[m.code];
          if (!pos) return null;
          const [x, y] = project(pos[0], pos[1], worldPaths.width, worldPaths.height);
          const { composite, band } = scoreOf(m);
          const label = composite === null ? "N/A" : composite.toFixed(1);
          const isSelected = m.code === current;
          // The visible label is just the number (62.4) -- WCAG 2.5.3
          // (Label in Name) needs that value inside the accessible name
          // too, not just the navigation action, so it folds the score
          // and band back in. This is the one keyboard/screen-reader
          // target per market on the map (see the country paths above).
          const actionLabel = `View ${m.name}, score ${label}, ${band.label}, on the Data Over Time page`;

          return (
            <text
              key={m.code}
              x={x}
              y={y}
              textAnchor="middle"
              fontFamily="'Space Grotesk', sans-serif"
              fontWeight={700}
              fontSize={isSelected ? 15 : 12.5}
              fill={band.color}
              stroke="#0b0b12"
              strokeWidth={3}
              strokeLinejoin="round"
              style={{ paintOrder: "stroke", cursor: "pointer" }}
              onClick={() => onSelect(m.code)}
              onMouseMove={(e) => handleHoverMove(m.code, e)}
              onMouseLeave={handleHoverEnd}
              {...a11yButtonProps(actionLabel, () => onSelect(m.code))}
            >
              {label}
            </text>
          );
        })}
      </svg>

      {hoverMarket && hoverBand && hover && (
        <div
          style={{
            position: "absolute",
            left: hover.x,
            top: hover.y,
            transform: "translate(-50%, calc(-100% - 10px))",
            background: "rgba(6,6,10,0.94)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "7px 10px",
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 12,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          <span style={{ color: "var(--ink)", fontWeight: 600 }}>{hoverMarket.name}</span>
          <span style={{ color: "var(--slate)", marginLeft: 8 }}>{hoverBand.label}</span>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 18px", marginTop: 14, fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }}>
        {markets.map((m) => {
          const { composite, band } = scoreOf(m);
          const label = composite === null ? "N/A" : composite.toFixed(1);
          // Visible text includes the score (below), so the accessible
          // name does too -- same Label in Name reasoning as the map's
          // score labels above.
          const actionLabel = `View ${m.name}, score ${label}, ${band.label}, on the Data Over Time page`;
          return (
            <span
              key={m.code}
              onClick={() => onSelect(m.code)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", color: m.code === current ? "#fff" : "var(--slate)" }}
              {...a11yButtonProps(actionLabel, () => onSelect(m.code))}
            >
              <i style={{ width: 8, height: 8, borderRadius: "50%", background: band.color, boxShadow: `0 0 6px ${band.color}` }} />
              <Flag code={m.code} size={16} />
              {m.name}
              <span style={{ color: band.color, fontWeight: 700 }}>{label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
