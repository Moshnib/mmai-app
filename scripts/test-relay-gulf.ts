// ============================================================
//  GULF WATCH'S RELAYED FIGURES: RIGHT VALUE, RIGHT DATE, OR NOTHING
//
//  Since 19 September the refresh workflow fetches Bahrain's CPI and four
//  IMF series and hands them to /api/refresh-gulf. What must hold, and
//  none of it throws when it goes wrong:
//
//    the IMF's placeholder 0 is never published as an inflation rate
//    a quoted IMF field full of commas and line breaks is still one row
//    a stale or implausible figure is dropped, not stored
//    a malformed query parameter is refused by the route
//    a quarter prints "Q4 2025", never "Dec 2025"
//    the IMF attribution travels in the stored source note
//
//  Fixtures, pinned clock, no network.
//
//    npx tsx scripts/test-relay-gulf.ts
// ============================================================

import { parseCsv, periodToDate, pickLatest, pickBahrain, SERIES } from "./relay-gulf.mjs";
import { parseGulfRelay, gulfSourceNote, IMF_CPI_ATTRIBUTION, IMF_RATE_ATTRIBUTION } from "@/lib/gulfRelay";
import { formatPeriod } from "@/lib/gulfHistoryHelpers";
import { GULF_CPI_GRANULARITY, GULF_POLICY_RATE_GRANULARITY, GULF_POLICY_RATE_LABELS, GULF_MONTHLY_ELSEWHERE } from "@/lib/gulfMarkets";

let failed = false;
const fail = (m: string) => { failed = true; console.error("  FAIL  " + m); };
const ok = (m: string) => console.log("  ok    " + m);
const check = (cond: boolean, pass: string, why: string) => (cond ? ok(pass) : fail(why));

const NOW = Date.parse("2026-09-19T08:00:00Z");
const series = (key: string) => SERIES.find((s: { key: string }) => s.key === key)!;

// The IMF's own CSV shape: a description with a comma, a doubled quote and
// a line break inside quotes, right before the value columns.
const imf = (rows: Array<[string, string]>) =>
  "COUNTRY,TIME_PERIOD,OBS_VALUE,FULL_DESCRIPTION\r\n" +
  rows.map(([p, v]) => `KWT,${p},${v},"Prices, measured ""monthly""\nacross the economy"`).join("\r\n") + "\r\n";

// ---------- CSV ----------
{
  const rows = parseCsv(imf([["2026-M05", "2.49"], ["2026-M06", "0"]]));
  check(rows.length === 2 && rows[0].OBS_VALUE === "2.49" && rows[1].TIME_PERIOD === "2026-M06",
    "a quoted field with commas, doubled quotes and a line break stays inside its row",
    `parsed ${rows.length} rows: ${JSON.stringify(rows.map((r: Record<string, string>) => [r.TIME_PERIOD, r.OBS_VALUE]))}`);
  check(rows[0].FULL_DESCRIPTION === 'Prices, measured "monthly"\nacross the economy',
    "the quoted text itself survives, doubled quotes read as one",
    `description read as ${JSON.stringify(rows[0].FULL_DESCRIPTION)}`);
}

// ---------- periods ----------
check(periodToDate("2026-M07") === "2026-07-01" && periodToDate("2025-Q4") === "2025-12-01" && periodToDate("2025") === null,
  "a month is its first day; a quarter is dated at its last month", `periods: ${periodToDate("2026-M07")} ${periodToDate("2025-Q4")}`);

// ---------- the Kuwait placeholder ----------
{
  const r = pickLatest(parseCsv(imf([["2026-M04", "2.57"], ["2026-M05", "2.49"], ["2026-M06", "0"]])), { now: NOW, ...series("kw_cpi") });
  check(r.value === 2.49 && r.date === "2026-05-01",
    "Kuwait's June placeholder 0 is skipped; May's 2.49 is published",
    `picked ${r.value} (${r.date}) ${r.reason ?? ""}`);
}
// ---------- staleness, measured from the END of the period ----------
{
  const stale = pickLatest(parseCsv(imf([["2026-M03", "2.1"]])), { now: NOW, ...series("kw_cpi") });
  check(stale.value === null, "a monthly figure five months past its month is dropped", `kept ${stale.value}`);
  const q = pickLatest(parseCsv(imf([["2025-Q4", "1.94"]])), { now: NOW, ...series("ae_cpi") });
  check(q.value === 1.94, "the UAE's Q4 2025, 262 days past its end, is still kept", `dropped: ${q.reason}`);
  const deadQ = pickLatest(parseCsv(imf([["2025-Q2", "1.1"]])), { now: NOW, ...series("ae_cpi") });
  check(deadQ.value === null, "a quarter more than 400 days old is dropped", `kept ${deadQ.value}`);
  // The IMF posts the UAE nearly a year behind; the newest quarter must
  // survive until the next one arrives. Q3 2025 ended 354 days before NOW.
  const lateQ = pickLatest(parseCsv(imf([["2025-Q3", "1.05"]])), { now: NOW, ...series("ae_cpi") });
  check(lateQ.value === 1.05, "a quarter 354 days past its end is still the newest, and kept", `dropped: ${lateQ.reason}`);
  // Measured from the END of the month: April 2026 ended 142 days before
  // NOW (kept, under 150); from its first day it would be 171 (dropped).
  const april = pickLatest(parseCsv(imf([["2026-M04", "2.57"]])), { now: NOW, ...series("kw_cpi") });
  check(april.value === 2.57, "age runs from the end of the month, so April is still current in September", `dropped: ${april.reason}`);
}
// ---------- plausibility ----------
{
  const r = pickLatest(parseCsv(imf([["2026-M08", "85"]])), { now: NOW, ...series("om_cpi") });
  check(r.value === null, "an implausible 85% inflation is dropped, not published", `kept ${r.value}`);
}

// ---------- Bahrain ----------
{
  const good = pickBahrain({ records: [{ record: { fields: { year: "2026", month: "07 July", percentage_change: 3 } } }] }, { now: NOW, maxAgeDays: 150 });
  check(good.value === 3 && good.date === "2026-07-01", "Bahrain's '07 July' becomes July 2026", `got ${good.value} ${good.date}`);
  const empty = pickBahrain({ records: [] }, { now: NOW, maxAgeDays: 150 });
  check(empty.value === null, "an empty Bahrain answer is nothing, not a zero", `got ${empty.value}`);
}

// ---------- the route's side ----------
{
  const url = new URL("https://x/api/refresh-gulf?force=0&bh_cpi=3&bh_cpi_date=2026-07-01&om_cpi=3.17&om_cpi_date=2026-07-01&kw_cpi=&kw_cpi_date=&ae_cpi=abc&ae_cpi_date=2025-12-01&qa_rate=4.35&qa_rate_date=2026-08-15");
  const r = parseGulfRelay(url);
  check(r.bh_cpi?.value === 3 && r.om_cpi?.value === 3.17, "well-formed relayed figures are read", JSON.stringify(r));
  check(!r.kw_cpi, "an empty pair (the relay got nothing) is absent, not zero", `kw_cpi = ${JSON.stringify(r.kw_cpi)}`);
  check(!r.ae_cpi, "a non-number is refused", `ae_cpi = ${JSON.stringify(r.ae_cpi)}`);
  check(!r.qa_rate, "a date that is not the first of a month is refused", `qa_rate = ${JSON.stringify(r.qa_rate)}`);
  const zero = parseGulfRelay(new URL("https://x/?kw_cpi=0&kw_cpi_date=2026-06-01"));
  check(!zero.kw_cpi, "the route refuses an exact-zero CPI even if the relay let one through", JSON.stringify(zero));
}

// ---------- the note carries the IMF's required credit ----------
{
  const om = gulfSourceNote("OM", { imfCpi: true, imfRate: false });
  const qa = gulfSourceNote("QA", { imfCpi: false, imfRate: true });
  const omMissed = gulfSourceNote("OM", { imfCpi: false, imfRate: false });
  check(om.includes(IMF_CPI_ATTRIBUTION) && qa.includes(IMF_RATE_ATTRIBUTION),
    "a row built from IMF data names the IMF, its dataset and link", `OM: ${om} | QA: ${qa}`);
  check(!omMissed.includes("International Monetary Fund"), "a row with no IMF figure does not credit the IMF", omMissed);
}

// ---------- dates as the card prints them ----------
check(formatPeriod("2025-12", "quarterly") === "Q4 2025" && formatPeriod("2026-03", "quarterly") === "Q1 2026",
  'a quarter prints "Q4 2025", never "Dec 2025"', `got ${formatPeriod("2025-12", "quarterly")}`);
check(GULF_CPI_GRANULARITY.AE === "quarterly" && GULF_CPI_GRANULARITY.KW === "monthly" && GULF_CPI_GRANULARITY.OM === "monthly",
  "the card dates the UAE by quarter and Kuwait and Oman by month", JSON.stringify(GULF_CPI_GRANULARITY));
check(GULF_POLICY_RATE_GRANULARITY.QA === "monthly" && GULF_POLICY_RATE_GRANULARITY.SA === "daily" && !!GULF_POLICY_RATE_LABELS.QA,
  "Qatar's monthly rate is dated by month, Saudi's by day, and Qatar shows the row",
  JSON.stringify(GULF_POLICY_RATE_GRANULARITY));

// Links to where a newer month is published (GulfCard): each country's own
// official statistics host only, over https -- a link on this site is a
// recommendation, and a lookalike domain would be the worst place to send
// a reader.
{
  const OFFICIAL: Record<string, RegExp> = {
    AE: /(^|\.)fcsc\.gov\.ae$|^data\.dubai$/,
    QA: /(^|\.)npc\.qa$/,
    KW: /(^|\.)csb\.gov\.kw$/,
  };
  const bad = Object.entries(GULF_MONTHLY_ELSEWHERE).flatMap(([c, links]) => links.filter((l) => {
    try { const u = new URL(l.url); return u.protocol !== "https:" || !OFFICIAL[c]?.test(u.hostname); } catch { return true; }
  }).map((l) => `${c}: ${l.url}`));
  check(Object.keys(GULF_MONTHLY_ELSEWHERE).length > 0 && bad.length === 0,
    "links to newer monthly figures are https and on each country's own official statistics host",
    `an unofficial or insecure link: ${JSON.stringify(bad)}`);
  check(Object.values(GULF_MONTHLY_ELSEWHERE).flat().every((l) => l.scope.trim() !== "" && l.label.trim() !== ""),
    "every link says what it covers", "a link without its scope or label");
}

console.log("");
if (failed) {
  console.error("Gulf Watch would publish a placeholder, a stale figure, or the wrong date.\n");
  process.exit(1);
}
console.log("Relayed Gulf figures: the right value, the right date, credited -- or nothing.\n");
