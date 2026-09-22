// ============================================================
//  THE LEARN-PAGE STATISTICS CHECK RAISES REAL ALARMS ONLY
//
//  lib/publishedDrift.ts compares the spread the Learn page publishes with
//  the live spread after each refresh, and the refresh workflow fails the
//  run on drift. On 22 September 2026 a run that scored eight of nine
//  markets (Japan's sources were down) compared the spread of eight with
//  the published spread of nine, failed, and skipped the Gulf refresh.
//
//  Run: npx tsx scripts/test-published-drift.ts
// ============================================================

import { checkPublishedDrift } from "../lib/publishedDrift";
import type { DimensionKey } from "../lib/composite";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
  if (!ok) failures++;
}

const published: Record<DimensionKey, number> = { C: 10, D: 10, K: 21.8 };
// Nine markets: Japan the Capacity outlier, as on 22 September.
const nine: Array<Record<DimensionKey, number>> = [
  { C: 50, D: 50, K: 5 }, // Japan
  ...[60, 62, 64, 66, 68, 70, 72, 74].map((k, i) => ({ C: 40 + i * 3.5, D: 40 + i * 3.5, K: k })),
];
const sd = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, v) => a + (v - m) ** 2, 0) / xs.length); };
published.K = Math.round(sd(nine.map((p) => p.K)) * 10) / 10;
published.C = Math.round(sd(nine.map((p) => p.C)) * 10) / 10;
published.D = published.C;

check("all nine scored and matching the page: no drift", checkPublishedDrift(nine, 9, published), { drift: [] });
const eight = nine.slice(1);
check("eight of nine scored (Japan's sources down): skipped, not a false alarm",
  checkPublishedDrift(eight, 9, published), { drift: [], skipped: "8 of 9 markets scored this run" });
const moved = nine.map((p, i) => (i === 0 ? { ...p, K: 60 } : p));
check("all nine scored and the spread really moved: reported",
  checkPublishedDrift(moved, 9, published).drift.length, 1);
check("a movement under the tolerance is not reported",
  checkPublishedDrift(nine.map((p, i) => (i === 1 ? { ...p, K: p.K + 1 } : p)), 9, published).drift, []);

console.log(failures === 0 ? "\nAll published-drift checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
