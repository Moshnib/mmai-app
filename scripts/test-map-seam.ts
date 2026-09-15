// ============================================================
//  NO STRIPES ACROSS THE WORLD MAP
//
//  Russia, Fiji and Antarctica cross the 180° line, and their outlines
//  jumped from one edge of the flat map to the other. An SVG fill joins
//  those two sides, which drew a full-width band over Canada and Alaska
//  and lines through the Pacific on the homepage for as long as the map
//  existed -- visible on the live page, invisible to every check the
//  site had, because nothing overflowed, nothing threw, and the source
//  looked fine.
//
//  After lib/mapdata/seam.ts repairs the outlines, no two consecutive
//  points in any ring may be more than half the map apart: that jump IS
//  the stripe. The raw data is asserted to still contain the problem, so
//  this cannot pass because the data changed underneath it.
//
//    npx tsx scripts/test-map-seam.ts
// ============================================================

import worldPaths from "@/lib/mapdata/world-paths.json";
import { repairSeam, widestJump } from "@/lib/mapdata/seam";

let failed = false;
const fail = (m: string) => { failed = true; console.error("  FAIL  " + m); };
const ok = (m: string) => console.log("  ok    " + m);

const HALF = worldPaths.width / 2;

// ---------- the problem exists in the raw data ----------
const crossing = worldPaths.countries.filter((c) => widestJump(c.d) > HALF).map((c) => c.name);
if (crossing.length === 0) fail("no raw outline crosses the seam -- this test no longer tests anything; re-check the map data");
else ok(`raw data: ${crossing.length} outlines cross the 180° line (${crossing.join(", ")})`);

// ---------- and the repair removes it from everything the map draws ----------
// Antarctica is the exception, and the map leaves it out: a ring that
// wraps the whole pole spans the full width, so no shift can make it
// continuous. It is also below the map's crop. Asserting it still FAILS
// the check proves the closing line from last point to first is measured
// -- the version of this test that skipped that line passed Antarctica.
const antarctica = worldPaths.countries.find((c) => String(c.id) === "010")!;
if (widestJump(repairSeam(antarctica.d, worldPaths.width)) <= HALF) {
  fail("Antarctica now passes the stripe check -- the closing-line measurement has stopped working");
} else ok("Antarctica is still caught by the closing-line check, and is dropped by the map");

const drawn = worldPaths.countries.filter((c) => String(c.id) !== "010");
for (const c of drawn) {
  const repaired = repairSeam(c.d, worldPaths.width);
  const jump = widestJump(repaired);
  if (jump > HALF) fail(`${c.name} still jumps ${jump.toFixed(0)} units after repair -- it will draw a stripe`);
}
if (!failed) ok(`all ${drawn.length} drawn outlines repaired: no ring jumps more than half the map, closing lines included`);

// ---------- a country that never crossed keeps its shape ----------
const norway = worldPaths.countries.find((c) => String(c.id) === "578")!;
const nums = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
const before = nums(norway.d);
const after = nums(repairSeam(norway.d, worldPaths.width));
if (before.length !== after.length || before.some((v, i) => Math.abs(v - after[i]) > 0.01)) {
  fail("Norway's outline changed shape, though it never crosses the seam");
} else ok("an outline that never crosses the seam comes back point for point");

console.log("");
if (failed) process.exit(1);
console.log("The world map draws no band across it.\n");
