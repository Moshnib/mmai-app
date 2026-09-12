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
  SE: ["752"],
};

// Some markets carry territory so far from the landmass everyone
// recognises that auto-fitting the whole thing shrinks the recognisable
// part to nothing. Measured against the real path data at the size the
// homepage strip renders (124px wide):
//
//   US  -- Alaska, Hawaii and the Pacific territories stretch the
//          bounding box by 1.82x, leaving the contiguous mainland only
//          63px wide (measured: 115px after this fix).
//   EA  -- one French overseas subpath (Reunion, ~x335,y225) stretches
//          the box to 229x182 while the whole of Europe sits inside
//          110x94, so the continent rendered just 54px wide (measured:
//          104px after this fix).
//
// So those two markets declare the window their glyph should frame, in
// the paths' own 960x480 map space; subpaths outside it are dropped
// from BOTH the viewBox and the drawing. Every other market auto-fits
// (measured: their main landmass already fills 78-100% of its box).
//
// This is a framing choice for a decorative identifier, not a claim
// about territory -- WorldMap still draws every country in full.
const GLYPH_FOCUS: Record<string, [number, number, number, number]> = {
  US: [140, 100, 320, 180],
  EA: [430, 40, 590, 170],
};

// These rectangles are only meaningful in the 960x480 space the file
// declares. If world-paths.json is ever regenerated at another size the
// rectangle would still intersect SOMETHING -- plausibly Alaska rather
// than the mainland -- so the "no matches" fallback below wouldn't catch
// it and we'd ship a glyph of Alaska labelled "United States". Checking
// the declared size turns that into a clean fall back to auto-fit.
const MAP_SPACE_OK = worldPaths.width === 960 && worldPaths.height === 480;

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

  // Split into subpaths so a focus window can drop individual islands
  // rather than whole countries -- the Euro Area's outlier is one
  // subpath of France, not a separate entry.
  const allPaths = worldPaths.countries
    .filter((c) => ids.includes(String(c.id)))
    .flatMap((c) => c.d.split(/(?=M)/).filter((s) => s.trim().length > 8));
  if (allPaths.length === 0) return null;

  const focus = MAP_SPACE_OK ? GLYPH_FOCUS[code] : undefined;
  // If a focus window ever stops matching the geometry (someone
  // regenerates world-paths.json), fall back to drawing everything
  // rather than rendering an empty box.
  const focused = focus
    ? allPaths.filter((d) => {
        const sb = boundsOf([d]);
        return sb ? sb.x + sb.w > focus[0] && sb.x < focus[2] && sb.y + sb.h > focus[1] && sb.y < focus[3] : false;
      })
    : allPaths;
  const paths = focused.length > 0 ? focused : allPaths;

  const b = boundsOf(paths);
  if (!b) return null;

  // Minimal breathing room. Each glyph is cropped to its own bounding
  // box and scaled to fill, so a small country (the UK) renders at the
  // same visual size as a large one (Canada) -- the shape is being used
  // as an identifier, not to convey relative land area.
  const pad = Math.max(b.w, b.h) * 0.04;

  return (
    <svg
      viewBox={`${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`}
      width={size}
      height={size * 0.78}
      aria-hidden="true"
      style={{ display: "block", overflow: "visible", filter: `drop-shadow(0 0 8px ${color}55)` }}
      preserveAspectRatio="xMidYMid meet"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} fill={color} fillOpacity={0.92} stroke={color} strokeWidth={0.5} strokeLinejoin="round" />
      ))}
    </svg>
  );
}
