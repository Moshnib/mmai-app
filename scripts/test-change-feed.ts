// ============================================================
//  THE EVENT-DRIVEN CHANGE FEED
//
//  The feed used to compare "now" with "roughly a week ago". Measured
//  against 30 days of live rows, that window was arbitrary: something
//  moved on 27 of 92 market-days, and on 7 of the last 16 days nothing
//  changed in any market at all. Official statistics arrive on release
//  schedules, so a fixed window is either empty or lumps unrelated
//  releases together.
//
//  The rule is now "compare with the most recent reading that was
//  different". These cases pin the behaviour that makes that safe.
//
//    npx tsx scripts/test-change-feed.ts
// ============================================================

type Row = {
  market: string; fetched_at: string;
  inflation: number | null; gdp_growth: number | null; unemployment: number | null;
  policy_rate: number | null; debt_pct_gdp: number | null; brent_yoy: number | null;
};

const MAX_LOOKBACK_DAYS = 45;

function scoredDiffers(a: Row, b: Row): boolean {
  return (
    a.inflation !== b.inflation ||
    a.gdp_growth !== b.gdp_growth ||
    a.unemployment !== b.unemployment ||
    a.policy_rate !== b.policy_rate ||
    a.debt_pct_gdp !== b.debt_pct_gdp
  );
}

/** Mirrors buildBuckets in lib/weeklyChanges.ts. */
function build(rowsDesc: Row[]): { buckets: Row[]; steadySince: string | null } {
  if (rowsDesc.length === 0) return { buckets: [], steadySince: null };
  const newest = rowsDesc[0];
  const t = new Date(newest.fetched_at).getTime();
  let steadySince: string | null = null;
  for (const row of rowsDesc.slice(1)) {
    const age = (t - new Date(row.fetched_at).getTime()) / 86_400_000;
    if (age > MAX_LOOKBACK_DAYS) break;
    if (scoredDiffers(newest, row)) return { buckets: [newest, row], steadySince: null };
    steadySince = row.fetched_at;
  }
  return { buckets: [newest], steadySince };
}

const pick = (rowsDesc: Row[]): Row[] => build(rowsDesc).buckets;

const day = (n: number) => new Date(Date.UTC(2026, 8, 30 - n)).toISOString();
const base = (over: Partial<Row> & { fetched_at: string }): Row => ({
  market: "CA", inflation: 3.03, gdp_growth: 1.13, unemployment: 6.4,
  policy_rate: 2.25, debt_pct_gdp: 96.1, brent_yoy: 17.91, ...over,
});

let fails = 0;
const ok = (label: string, cond: boolean, note = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}${note ? "  — " + note : ""}`);
};

console.log("\nFINDING THE MOST RECENT CHANGE\n");
{
  // Nothing moved for three days, then unemployment did four days ago.
  const rows = [
    base({ fetched_at: day(0) }),
    base({ fetched_at: day(1) }),
    base({ fetched_at: day(2) }),
    base({ fetched_at: day(3) }),
    base({ fetched_at: day(4), unemployment: 6.6 }),
    base({ fetched_at: day(5), unemployment: 6.6 }),
  ];
  const got = pick(rows);
  ok("reaches past the still days to the real change", got.length === 2 && got[1].fetched_at === day(4));
  ok("does not stop at the first older row", got[1].unemployment === 6.6);
}

console.log("\nNOTHING HAS MOVED\n");
{
  const rows = [0, 1, 2, 3, 4].map((n) => base({ fetched_at: day(n) }));
  const got = pick(rows);
  ok("returns one bucket, not a false comparison", got.length === 1);
}

console.log("\nTHE LOOKBACK BOUND\n");
{
  // The only difference sits well beyond the bound: a stalled market, not news.
  const rows = [base({ fetched_at: day(0) }), base({ fetched_at: day(60), unemployment: 5.1 })];
  ok("refuses a comparison older than the bound", pick(rows).length === 1, `${MAX_LOOKBACK_DAYS}-day limit`);

  const inside = [base({ fetched_at: day(0) }), base({ fetched_at: day(40), unemployment: 5.1 })];
  ok("accepts one inside the bound", pick(inside).length === 2);
}

console.log("\nWHAT COUNTS AS A CHANGE\n");
{
  // Brent is still fetched and still shown, but stopped being scored on
  // 1 September. A move in it is not a move in anything the index reports.
  const rows = [base({ fetched_at: day(0), brent_yoy: 22.4 }), base({ fetched_at: day(1) })];
  ok("an unscored indicator does not trigger a change", pick(rows).length === 1);

  const debt = [base({ fetched_at: day(0) }), base({ fetched_at: day(1), debt_pct_gdp: 94.8 })];
  ok("a scored indicator does", pick(debt).length === 2);

  // A source failing writes null. That IS a change worth reporting -- the
  // feed should say a figure went missing, not silently skip past it.
  const gone = [base({ fetched_at: day(0), unemployment: null }), base({ fetched_at: day(1) })];
  ok("a figure going missing counts as a change", pick(gone).length === 2);
}

console.log("\nHOW LONG IT HAS STOOD\n");
{
  // The feed only fires on a change, so most rows on most days have no
  // comparison. The row still has to say something true, and this is the
  // fact it says: how far back the current figures reach.
  const still = [0, 1, 2, 3].map((n) => base({ fetched_at: day(n) }));
  ok("names the oldest identical reading, not the newest", build(still).steadySince === day(3));

  const moved = [base({ fetched_at: day(0) }), base({ fetched_at: day(1), unemployment: 6.6 })];
  ok("stays null when there IS a comparison to draw", build(moved).steadySince === null);

  ok("null on a single row, so the feed says 'first reading'", build([base({ fetched_at: day(0) })]).steadySince === null);

  // Rows beyond the bound are not evidence the figures have stood: the
  // gap between them was never inspected.
  const beyond = [base({ fetched_at: day(0) }), base({ fetched_at: day(60) })];
  ok("does not reach past the lookback bound", build(beyond).steadySince === null, `${MAX_LOOKBACK_DAYS}-day limit`);
}

console.log("\nEDGE CASES\n");
{
  ok("no rows is safe", pick([]).length === 0);
  ok("a single row yields no comparison", pick([base({ fetched_at: day(0) })]).length === 1);
}

console.log("\n" + (fails === 0 ? "ALL PASS" : `${fails} FAILURE(S)`));
if (fails) process.exit(1);

// No imports, so TypeScript would treat this as a global script and its
// top-level names would collide with every other script. This makes it a
// module.
export {};
