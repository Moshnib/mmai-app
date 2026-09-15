// ============================================================
//  COUNTRIES THAT CROSS THE EDGE OF THE MAP
//
//  world-paths.json is a flat 960x480 projection, and three countries
//  cross the 180° line: Russia, Fiji and Antarctica. Their outlines hop
//  from one edge of the map to the other mid-ring, so an SVG fill joins
//  the two sides with a band the full width of the map. On the homepage
//  that drew a stripe across Canada and Alaska, a line through the
//  Pacific and another above the crop -- reported by the owner from a
//  photo of the live page on 15 September 2026.
//
//  The fix is the textbook one. Each ring is "unwrapped" so its x values
//  run continuously (a jump of more than half the map means the ring
//  crossed the seam, so 960 is added or removed), which leaves a ring
//  hanging off one edge. It is then drawn twice -- where it is, and
//  shifted by one map width -- and the SVG viewport clips both copies to
//  the map. Nothing is dropped, nothing is re-projected.
//
//  The paths use only M, L and Z, which is what makes this a few lines
//  rather than a geometry library. If the data is ever regenerated with
//  curves, parse() refuses it rather than drawing something wrong.
// ============================================================

type Ring = Array<[number, number]>;

/** A full number: sign, integer or leading-dot decimal, and exponent. A
 *  narrower pattern read "1e-5" as two numbers and ".5" as "5". */
const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

function parse(d: string, width: number): Ring[] {
  // Uppercase only: lowercase m/l/z are RELATIVE commands, and reading
  // them as absolute would draw a wrong shape rather than fail.
  if (/[^MLZ\d\s.,eE+\-]/.test(d)) {
    throw new Error("map path uses commands other than absolute M/L/Z; seam repair cannot handle it");
  }
  const rings: Ring[] = [];
  for (const chunk of d.split(/(?=M)/)) {
    const nums = chunk.match(NUM);
    if (!nums || nums.length < 4) continue;
    const ring: Ring = [];
    for (let i = 0; i + 1 < nums.length; i += 2) ring.push([Number(nums[i]), Number(nums[i + 1])]);
    // Unwrap: carry an offset forward whenever consecutive points are
    // further apart than half the map.
    let offset = 0;
    for (let i = 1; i < ring.length; i++) {
      const raw = ring[i][0];
      const prev = ring[i - 1][0];
      const dx = raw + offset - prev;
      if (dx > width / 2) offset -= width;
      else if (dx < -width / 2) offset += width;
      ring[i] = [raw + offset, ring[i][1]];
    }
    rings.push(ring);
  }
  return rings;
}

const toPath = (ring: Ring, shift: number) =>
  "M" + ring.map(([x, y]) => `${(x + shift).toFixed(2)},${y.toFixed(2)}`).join(" L") + " Z";

/** The same outline with every seam-crossing ring drawn on both sides of
 *  the map. A path that never crosses comes back unchanged in shape. */
export function repairSeam(d: string, width: number): string {
  return parse(d, width)
    .map((ring) => {
      const xs = ring.map((p) => p[0]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      if (maxX > width) return toPath(ring, 0) + " " + toPath(ring, -width);
      if (minX < 0) return toPath(ring, 0) + " " + toPath(ring, width);
      return toPath(ring, 0);
    })
    .join(" ");
}

/** Largest jump between consecutive points in any single ring, as drawn,
 *  INCLUDING the closing line from the last point back to the first --
 *  Z draws that line too, and it can be the stripe on its own.
 *  Used by scripts/test-map-seam.ts: after repair nothing may jump more
 *  than half the map. */
export function widestJump(d: string): number {
  let worst = 0;
  for (const chunk of d.split(/(?=M)/)) {
    const nums = chunk.match(NUM);
    if (!nums || nums.length < 4) continue;
    const xs = nums.filter((_, i) => i % 2 === 0).map(Number);
    for (let i = 1; i < xs.length; i++) worst = Math.max(worst, Math.abs(xs[i] - xs[i - 1]));
    worst = Math.max(worst, Math.abs(xs[xs.length - 1] - xs[0]));
  }
  return worst;
}
