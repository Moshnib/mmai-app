"use client";

import worldPaths from "@/lib/mapdata/world-paths.json";

// ============================================================
// A small filled silhouette of a market's landmass, used in the
// homepage's Compare Markets strip (design reference shows each market
// as its own shape rather than a flag).
//
// Reuses lib/mapdata/world-paths.json -- the same geometry WorldMap
// already renders -- rather than adding icon assets. The paths are in
// the map's own 960x480 equirectangular space, so each glyph computes
// its own bounding box from the rendered path data and sets a viewBox
// around it; that crops to the country and scales it to fill the box,
// regardless of where it sits on the world map or how big it is.
// ============================================================

// Same grouping WorldMap uses. Euro Area is drawn from its largest
// constituent economies -- recognisable as "Europe" at this size
// without claiming to be all 20 members.
const MARKET_COUNTRY_IDS: Record<string, string[]> = {
  US: ["840"],
  CA: ["124"],
  UK: ["826"],
  JP: ["392"],
  AU: ["036"],
  EA: ["250", "276", "380", "724", "528", "056", "040", "620", "372", "246", "300"],
  NO: ["578"],
};

/** Cheap bounding box straight off the path's numeric pairs. Good
 *  enough for framing a silhouette -- it ignores curve control points,
 *  which can only ever make the box slightly generous, never crop the
 *  shape. */
function boundsOf(paths: string[]): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of paths) {
    const nums = d.match(/-?\d+(\.\d+)?/g);
    if (!nums) continue;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = Number(nums[i]);
      const y = Number(nums[i + 1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export default function CountryGlyph({
  code,
  size = 46,
  color,
}: {
  code: string;
  size?: number;
  color: string;
}) {
  const ids = MARKET_COUNTRY_IDS[code];
  if (!ids) return null;

  const paths = worldPaths.countries.filter((c) => ids.includes(String(c.id))).map((c) => c.d);
  if (paths.length === 0) return null;

  const b = boundsOf(paths);
  if (!b) return null;

  // A little breathing room so the shape doesn't touch the edges.
  const pad = Math.max(b.w, b.h) * 0.08;

  return (
    <svg
      viewBox={`${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`}
      width={size}
      height={size * 0.62}
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
      preserveAspectRatio="xMidYMid meet"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} fill={color} fillOpacity={0.85} stroke={color} strokeWidth={0.4} strokeLinejoin="round" />
      ))}
    </svg>
  );
}
