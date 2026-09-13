// ============================================================
//  A WITHHELD SCORE MUST STILL BE A ROW
//
//  MMAI withholds rather than reweighting: if any indicator is missing,
//  the composite is null and no score is published. That is the design.
//
//  What the design did NOT survive was contact with the schema. The
//  refresh route wrote:
//
//      const band = composite != null ? { label: ... } : null;
//
//  above a comment stating that a row with no score and no band "is the
//  intended behaviour and what the mmai_scores check constraint
//  enforces". The schema says the opposite -- `band text not null` -- so
//  the insert was REFUSED and the market got no row at all. On the site a
//  market with no row is indistinguishable from one never configured.
//
//  It lay dormant for months because every market always returned all
//  five indicators. Korea was added on 13 September 2026 reading three
//  series from OECD, OECD returns nothing from Vercel, and the run
//  reported a Postgres constraint violation instead of a withheld score.
//
//  Nothing caught it. It type-checked (band was legitimately nullable in
//  TypeScript), it passed every test, and it only fires when a market
//  genuinely has missing data -- which is exactly the moment the site
//  most needs to record something.
//
//    npx tsx scripts/test-withheld-score-is-storable.ts
// ============================================================

import { readFileSync } from "node:fs";
import { percentileBandLabel, computeMmai } from "@/lib/composite";

let failed = false;
const fail = (m: string) => { failed = true; console.error("  FAIL  " + m); };
const ok = (m: string) => console.log("  ok    " + m);

console.log("\nA withheld score must still be storable\n");

// ---------- 1. the label function always answers ----------
for (const input of [null, 0, 0.1, 12.5, 50, 85.1, 99.9, 100]) {
  const label = percentileBandLabel(input);
  if (typeof label !== "string" || label.trim() === "") {
    fail(`percentileBandLabel(${input}) returned ${JSON.stringify(label)} — the band column is NOT NULL`);
  }
}
if (!failed) ok("percentileBandLabel returns a non-empty label for every input, including null");

// A percentile ABOVE every band floor must still land on a band. Korea
// scores 95.3, higher than any market before it, and a table of bands
// with a gap at the top would have been the other way to produce a null.
const top = percentileBandLabel(100);
if (!top || top === "Not published") {
  fail(`percentileBandLabel(100) returned "${top}" — the highest possible score has no band`);
} else {
  ok(`a perfect 100 lands on "${top}", not off the end of the table`);
}

// ---------- 2. a market missing an indicator really does withhold ----------
const complete = { inflation: 3.0, gdpGrowth: 2.0, unemployment: 4.0, policyRate: 3.0, debtPctGdp: 60 };
if (computeMmai(complete, "TEST").percentile == null) {
  fail("a complete set of indicators produced no score — the fixture is wrong, not the engine");
} else {
  ok("a complete set of indicators produces a score");
}

for (const missing of ["inflation", "gdpGrowth", "unemployment", "policyRate", "debtPctGdp"] as const) {
  const partial = { ...complete, [missing]: null };
  const r = computeMmai(partial, "TEST");
  if (r.percentile != null) {
    fail(`a market missing ${missing} still produced a score of ${r.percentile} — it must withhold`);
    continue;
  }
  // …and that withheld score must still produce a storable band.
  const label = percentileBandLabel(r.percentile);
  if (typeof label !== "string" || label.trim() === "") {
    fail(`missing ${missing}: withheld score produced band ${JSON.stringify(label)}, which cannot be stored`);
  }
}
if (!failed) ok("every missing indicator withholds the score AND still yields a storable band");

// ---------- 3. the route must not reintroduce the conditional ----------
// The bug was one ternary. Reading the source is crude, and it is the
// only thing here that can see the defect -- the shape that broke is not
// reachable without a database.
const route = readFileSync("app/api/refresh/route.ts", "utf8");
if (/const band\s*=\s*composite\s*!=\s*null\s*\?/.test(route)) {
  fail(
    "app/api/refresh/route.ts sets band conditionally on composite again. " +
      "band is NOT NULL in supabase/schema.sql, so a withheld score cannot be written that way.",
  );
} else {
  ok("the refresh route sets a band unconditionally");
}

// ---------- 4. and the schema still says NOT NULL ----------
// If the column is ever relaxed to nullable, the check above stops being
// necessary and this test should be revisited rather than left asserting
// a constraint that no longer exists.
const schema = readFileSync("supabase/schema.sql", "utf8");
if (!/band\s+text\s+not\s+null/i.test(schema)) {
  fail(
    "supabase/schema.sql no longer declares `band text not null`. If that is deliberate, " +
      "this test's reasoning needs updating — it exists because the column is mandatory.",
  );
} else {
  ok("supabase/schema.sql still declares band NOT NULL, so the guarantee is still needed");
}

console.log("");
if (failed) {
  console.error("A market with missing data must still write a row saying so.");
  console.error("No row at all reads, on the site, as a market that was never configured.\n");
  process.exit(1);
}
console.log("A withheld score is a stored fact, not a failed write.\n");
export {};
