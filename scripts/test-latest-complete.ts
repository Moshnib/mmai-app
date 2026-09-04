import { latestCompleteObservation, fallbackNote, MAX_FALLBACK_DAYS } from "../lib/latestComplete";

type Row = { observation_date: string; inflation: number | null; gdp_growth: number | null;
             unemployment: number | null; policy_rate: number | null; debt_pct_gdp: number | null };
const REQ = ["inflation","gdp_growth","unemployment","policy_rate","debt_pct_gdp"] as const;
const fmt = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const pick = (rows: Row[]) => latestCompleteObservation(rows, REQ as unknown as (keyof Row)[], (r) => r.observation_date);

// Canada's actual rows, 4 September 2026
const canada: Row[] = [
  { observation_date: "2026-09-04", inflation: 3.03, gdp_growth: 1.13, unemployment: null, policy_rate: 2.25, debt_pct_gdp: 96.1 },
  { observation_date: "2026-09-03", inflation: 3.03, gdp_growth: 1.13, unemployment: 6.4,  policy_rate: 2.25, debt_pct_gdp: 96.1 },
  { observation_date: "2026-09-02", inflation: 3.03, gdp_growth: 1.13, unemployment: 6.4,  policy_rate: 2.25, debt_pct_gdp: null },
];
let fails = 0;
const ok = (label: string, cond: boolean, detail = "") => { if (!cond) fails++; console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`); };

console.log("\nCANADA, the live case\n");
const c = pick(canada);
ok("falls back one day", c.isFallback && c.daysBack === 1, `used ${c.usedDate}`);
ok("uses the complete row", c.row?.unemployment === 6.4);
ok("names what was missing", c.missingInNewest.join() === "unemployment");
ok("skips the 2 Sep row with null debt", c.usedDate === "2026-09-03");
console.log("  note: " + fallbackNote(c, fmt));

console.log("\nNEWEST ROW COMPLETE — no fallback\n");
const fresh = pick([{ observation_date: "2026-09-04", inflation: 3, gdp_growth: 1, unemployment: 6, policy_rate: 2, debt_pct_gdp: 90 }]);
ok("not a fallback", !fresh.isFallback && fresh.daysBack === 0);
ok("no note", fallbackNote(fresh, fmt) === null);

console.log(`\nBOUND — nothing complete within ${MAX_FALLBACK_DAYS} days\n`);
const stale = pick([
  { observation_date: "2026-09-04", inflation: 3, gdp_growth: 1, unemployment: null, policy_rate: 2, debt_pct_gdp: 90 },
  { observation_date: "2026-08-01", inflation: 3, gdp_growth: 1, unemployment: 6,    policy_rate: 2, debt_pct_gdp: 90 },
]);
ok("refuses to reach past the bound", stale.exhausted && stale.row === null, `${stale.daysBack} days`);
console.log("  note: " + fallbackNote(stale, fmt));

console.log("\nEDGE CASES\n");
ok("empty input is safe", pick([]).row === null);
const allBad = pick([{ observation_date: "2026-09-04", inflation: null, gdp_growth: null, unemployment: null, policy_rate: null, debt_pct_gdp: null }]);
ok("all-null newest, nothing behind it", allBad.exhausted && allBad.missingInNewest.length === 5);
const exactly14 = pick([
  { observation_date: "2026-09-15", inflation: 3, gdp_growth: 1, unemployment: null, policy_rate: 2, debt_pct_gdp: 90 },
  { observation_date: "2026-09-01", inflation: 3, gdp_growth: 1, unemployment: 6,    policy_rate: 2, debt_pct_gdp: 90 },
]);
ok("14 days is inside the bound", exactly14.isFallback && exactly14.daysBack === 14);

console.log("\n" + (fails === 0 ? "ALL PASS" : `${fails} FAILURE(S)`));
if (fails) process.exit(1);
