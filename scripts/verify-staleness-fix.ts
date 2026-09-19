// Standalone logic check for the stale/missing-market fix in app/page.tsx
// and components/SiteFooter.tsx. Mirrors the exact transformation those
// files apply, against safe mock data -- does not touch the real database.

import { STALE_THRESHOLD_MS } from "../lib/constants";

function isStale(row: { fetched_at: string } | undefined, now: number): boolean {
  return !row || now - new Date(row.fetched_at).getTime() > STALE_THRESHOLD_MS;
}

const now = Date.now();
const cases: Array<{ name: string; row: { fetched_at: string } | undefined; expectStale: boolean }> = [
  { name: "fresh row, fetched 1 hour ago", row: { fetched_at: new Date(now - 1 * 60 * 60 * 1000).toISOString() }, expectStale: false },
  { name: "fresh row, fetched 24 hours ago (normal daily cadence)", row: { fetched_at: new Date(now - 24 * 60 * 60 * 1000).toISOString() }, expectStale: false },
  { name: "borderline, fetched 71 hours ago", row: { fetched_at: new Date(now - 71 * 60 * 60 * 1000).toISOString() }, expectStale: false },
  { name: "stale, fetched 73 hours ago", row: { fetched_at: new Date(now - 73 * 60 * 60 * 1000).toISOString() }, expectStale: true },
  { name: "stale, fetched 10 days ago", row: { fetched_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString() }, expectStale: true },
  { name: "no row at all (market missing entirely)", row: undefined, expectStale: true },
];

let allPass = true;
for (const c of cases) {
  const actual = isStale(c.row, now);
  const pass = actual === c.expectStale;
  allPass = allPass && pass;
  console.log(`${pass ? "PASS" : "FAIL"}  ${c.name.padEnd(55)} stale=${actual} (expected ${c.expectStale})`);
}

console.log("\n" + (allPass ? "ALL CASES PASSED" : "SOME CASES FAILED"));
process.exit(allPass ? 0 : 1);
