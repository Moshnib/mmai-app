"use client";

import { useRef, useState } from "react";
import worldPaths from "@/lib/mapdata/world-paths.json";
import { repairSeam } from "@/lib/mapdata/seam";
import { colorForScore } from "@/lib/indicators";
import { percentileBandLabel } from "@/lib/composite";
import { scoreMarketV2, type MarketData } from "@/lib/markets";
import Flag from "@/components/Flag";

/** One place for the score-plus-label pair, so the map cannot drift onto a
 *  different engine from the panel above it — which it briefly did. */
function scoreOf(m: MarketData) {
  const { percentile } = scoreMarketV2(m);
  return { composite: percentile, band: { color: colorForScore(percentile), label: percentileBandLabel(percentile) } };
}

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
  SE: ["752"],
  NO: ["578"],
  KR: ["410"],
};

// Crops the bottom of the equirectangular projection (below roughly -60°)
// so the scored markets fill more of the frame. Tasmania's southern tip
// projects to y≈355 of 480, so Australia keeps its whole landmass.
const CROP_HEIGHT = 400;

/** Drawn once, not per render: the seam repair walks every point of 176
 *  outlines. Antarctica is dropped outright -- it sits below the crop, and
 *  its ring crossing the 180° line was one of the three stripes. */
const COUNTRIES = worldPaths.countries
  .filter((c) => String(c.id) !== "010")
  .map((c) => ({ id: String(c.id), d: repairSeam(c.d, worldPaths.width) }));

interface HoverState {
  code: string;
  x: number;
  y: number;
}

/**
 * NO NUMBERS ON THE MAP ITSELF.
 *
 * The map used to print each score on its country. Four markets sit
 * within a few hundred kilometres of each other in northern Europe, so
 * Norway's and Sweden's numbers were drawn on top of each other, the UK's
 * crowded the Euro Area's, and South Korea -- too small to hold a label --
 * had none at all. Nudging anchors apart was tried and only moves the
 * collision. The ranked key beneath the map carries every score, readably,
 * and the tooltip gives the one under the pointer; the map's job is to say
 * where, and roughly how well, at a glance.
 *
 * Colour is the score ramp, softened so nine shapes do not shout, with
 * the chosen market in full strength and outlined in the accent.
 */
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
    // Skip the re-render on sub-pixel jitter -- the tooltip only needs to
    // track the cursor closely enough to look attached.
    setHover((prev) => (prev && prev.code === code && Math.abs(prev.x - x) < 2 && Math.abs(prev.y - y) < 2 ? prev : { code, x, y }));
  }
  function handleHoverEnd() {
    setHover(null);
  }

  const hoverMarket = hover ? marketByCode[hover.code] : null;
  const hoverScore = hoverMarket ? scoreOf(hoverMarket) : null;

  // Highest first, so the key reads as a ranking rather than a list in
  // whatever order the markets happen to be stored.
  const ranked = [...markets]
    .map((m) => ({ m, ...scoreOf(m) }))
    .sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1));

  return (
    <div ref={containerRef} className="world-map">
      <svg viewBox={`0 0 ${worldPaths.width} ${CROP_HEIGHT}`} width="100%" style={{ display: "block" }} aria-hidden="true">
        {COUNTRIES.map((c) => {
          const marketCode = countryToMarket[c.id];
          const market = marketCode ? marketByCode[marketCode] : undefined;

          if (!market) {
            return <path key={c.id} d={c.d} fill="var(--track)" stroke="var(--card-bg)" strokeWidth={0.5} />;
          }

          const { band } = scoreOf(market);
          const isSelected = marketCode === current;

          return (
            <path
              key={c.id}
              d={c.d}
              fill={band.color}
              fillOpacity={isSelected ? 0.95 : 0.55}
              stroke={isSelected ? "var(--accent)" : "var(--card-bg)"}
              strokeWidth={isSelected ? 1.4 : 0.5}
              style={{ cursor: "pointer", transition: "fill-opacity 0.15s ease" }}
              onClick={() => onSelect(marketCode)}
              onMouseMove={(e) => handleHoverMove(marketCode, e)}
              onMouseLeave={handleHoverEnd}
            />
          );
        })}
      </svg>

      {hoverMarket && hoverScore && hover && (
        <div className="world-map-tip" style={{ left: hover.x, top: hover.y }}>
          <b>{hoverMarket.name}</b>
          <span>{hoverScore.composite === null ? "N/A" : hoverScore.composite.toFixed(1)}</span>
          <span className="world-map-tip-band">{hoverScore.band.label}</span>
        </div>
      )}

      {/* The keyboard and screen-reader way in. The country shapes stay
          mouse and touch only: the Euro Area alone is eleven shapes, and
          eleven identical tab stops would be worse than none. Real
          buttons here, not spans given a role. */}
      <div className="world-map-key">
        {ranked.map(({ m, composite, band }) => {
          const label = composite === null ? "N/A" : composite.toFixed(1);
          // Visible text includes the score, so the accessible name does
          // too (WCAG 2.5.3, Label in Name).
          const actionLabel = `Show ${m.name}, score ${label}, ${band.label}`;
          return (
            <button
              type="button"
              key={m.code}
              className={m.code === current ? "on" : undefined}
              onClick={() => onSelect(m.code)}
              aria-label={actionLabel}
              aria-pressed={m.code === current}
            >
              <i style={{ background: band.color }} aria-hidden="true" />
              <Flag code={m.code} size={16} />
              <span className="world-map-key-name">{m.name}</span>
              <span className="world-map-key-score">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
