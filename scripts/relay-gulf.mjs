// ============================================================
//  GULF WATCH FIGURES FETCHED BY THE REFRESH WORKFLOW, AND HANDED ON
//
//  Run by .github/workflows/refresh.yml before it calls /api/refresh-gulf,
//  which takes these as query parameters -- the same relay that already
//  carries Japan's and Korea's OECD figures, for the same kind of reason:
//
//    Bahrain CPI   data.gov.bh answers a laptop in under a second and
//                  failed from Vercel on every run from 14 September.
//    IMF           monthly CPI for Oman and Kuwait, quarterly for the UAE,
//                  and Qatar's monetary-policy-related rate. The site had
//                  World Bank ANNUAL figures for the first three and no
//                  Qatar rate at all. Fetched here, not in the route,
//                  because every refresh starts here anyway and it needs
//                  no answer to "does the IMF talk to Vercel?".
//
//  IMF licence (read 19 September 2026, imf.org/en/About/copyright-and-terms,
//  "The Use of IMF Data"): Data may be downloaded, published and
//  distributed with attribution; commercial reuse needs permission from
//  copyright@imf.org (on the pre-monetization list). Six small keyed
//  requests three times a day is not the "bulk download" the general
//  terms forbid: explicit keys, one country and series each, a year of
//  observations at most.
//
//  NO DEPENDENCIES. Plain Node with its built-in fetch, so the workflow
//  needs a checkout but not `npm ci`. Every figure is optional: a failure
//  or a failed guard simply leaves that parameter out, and the route
//  stores null, which carry-forward covers for fourteen days.
//
//    node scripts/relay-gulf.mjs        (prints key=value; in Actions,
//                                        appends them to $GITHUB_OUTPUT)
// ============================================================

import { appendFileSync } from "node:fs";

const IMF = "https://api.imf.org/external/sdmx/2.1/data";
const HEADERS = {
  Accept: "application/vnd.sdmx.data+csv;version=1.0.0",
  "User-Agent": "Mozilla/5.0 (compatible; MMAI/1.0; +https://www.mmai.markets)",
};

/** RFC 4180, properly: quoted fields may hold commas, doubled quotes AND
 *  line breaks -- the IMF's FULL_DESCRIPTION column holds all three, and a
 *  line-by-line split turns one observation into several broken rows. */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, j) => [h, r[j] ?? ""])));
}

/** "2026-M07" -> 2026-07-01; "2025-Q4" -> 2025-12-01 (a quarter is dated
 *  at its LAST month, as every quarterly figure on this site is). */
export function periodToDate(period) {
  let m = /^(\d{4})-M(\d{2})$/.exec(period);
  if (m) return `${m[1]}-${m[2]}-01`;
  m = /^(\d{4})-Q([1-4])$/.exec(period);
  if (m) return `${m[1]}-${String(Number(m[2]) * 3).padStart(2, "0")}-01`;
  return null;
}

/** Days from the END of the period (the last day of its month) to now.
 *  Measured from the end, so a quarter is not "older" than the month
 *  that closes it. */
export function ageDays(date, now) {
  const [y, mo] = date.split("-").map(Number);
  const end = Date.UTC(y, mo, 0); // day 0 of the next month = last day of this one
  return (now - end) / 86_400_000;
}

/** The newest usable observation, or null with the reason.
 *
 *  EXACTLY ZERO IS SKIPPED. The IMF has shipped a literal 0 as Kuwait's
 *  newest month (June 2026, beside a real 2.49 for May) -- a placeholder,
 *  not an inflation rate. Genuine 0.00% inflation to every decimal the
 *  IMF publishes is not a thing a Gulf economy has produced; publishing a
 *  placeholder as a figure would be. */
export function pickLatest(rows, { now, maxAgeDays, min, max }) {
  const usable = rows
    .map((r) => ({ period: r.TIME_PERIOD, value: Number(r.OBS_VALUE), raw: r.OBS_VALUE }))
    .filter((o) => periodToDate(o.period) && o.raw !== "" && Number.isFinite(o.value) && o.value !== 0)
    .sort((a, b) => (a.period < b.period ? 1 : -1));
  const newest = usable[0];
  if (!newest) return { value: null, reason: "no usable observation" };
  const date = periodToDate(newest.period);
  if (newest.value < min || newest.value > max) return { value: null, reason: `${newest.value} outside ${min}..${max}` };
  const age = ageDays(date, now);
  if (age > maxAgeDays) return { value: null, reason: `${newest.period} is ${Math.round(age)} days past its period, over ${maxAgeDays}` };
  return { value: newest.value, date, period: newest.period };
}

/** Bahrain's newest headline row, from data.gov.bh's own response
 *  shape. The month field reads "07 July": its first two digits are the
 *  month number. */
export function pickBahrain(json, { now, maxAgeDays }) {
  const f = json?.records?.[0]?.record?.fields;
  if (!f || typeof f.percentage_change !== "number" || !/^\d{4}$/.test(String(f.year)) || !/^\d{2}/.test(String(f.month))) {
    return { value: null, reason: "no usable value" };
  }
  const date = `${f.year}-${String(f.month).slice(0, 2)}-01`;
  if (f.percentage_change < -20 || f.percentage_change > 60) return { value: null, reason: `${f.percentage_change} outside -20..60` };
  const age = ageDays(date, now);
  if (age > maxAgeDays) return { value: null, reason: `${date} is ${Math.round(age)} days past its month, over ${maxAgeDays}` };
  return { value: f.percentage_change, date };
}

/** What is fetched, and the guard each passes. The key is the name of
 *  the query parameter the route reads. */
export const SERIES = [
  { key: "om_cpi", what: "Oman CPI (IMF, monthly)", flow: "IMF.STA,CPI", series: "OMN.CPI._T.YOY_PCH_PA_PT.M", maxAgeDays: 150, min: -20, max: 60 },
  { key: "kw_cpi", what: "Kuwait CPI (IMF, monthly)", flow: "IMF.STA,CPI", series: "KWT.CPI._T.YOY_PCH_PA_PT.M", maxAgeDays: 150, min: -20, max: 60 },
  // Quarterly, dated at the quarter's last month. IMF posts the UAE a
  // long way behind: Q4 2025 was the newest on 19 September 2026, 262
  // days past its end. 400 keeps the newest quarter and drops a dead one.
  { key: "ae_cpi", what: "UAE CPI (IMF, quarterly)", flow: "IMF.STA,CPI", series: "ARE.CPI._T.YOY_PCH_PA_PT.Q", maxAgeDays: 400, min: -20, max: 60 },
  { key: "qa_rate", what: "Qatar policy rate (IMF MFS_IR, monthly)", flow: "IMF.STA,MFS_IR", series: "QAT.MFS166_RT_PT_A_PT.M", maxAgeDays: 100, min: 0, max: 30 },
];

export async function fetchImf(s, now) {
  const start = new Date(now - 400 * 86_400_000).toISOString().slice(0, 4);
  const url = `${IMF}/${s.flow}/${s.series}?startPeriod=${start}`;
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return { value: null, reason: `HTTP ${res.status}` };
  return pickLatest(parseCsv(await res.text()), { now, ...s });
}

export async function fetchBahrain(now) {
  const url = new URL("https://www.data.gov.bh/api/v2/catalog/datasets/06-percentage-change-from-previous-year/records");
  url.searchParams.set("where", "level=1");
  url.searchParams.set("order_by", "year desc, month desc");
  url.searchParams.set("limit", "1");
  const res = await fetch(url, { headers: { "User-Agent": HEADERS["User-Agent"] }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return { value: null, reason: `HTTP ${res.status}` };
  return pickBahrain(await res.json(), { now, maxAgeDays: 150 });
}

async function main() {
  const now = Date.now();
  const out = [];
  const report = (key, what, r) => {
    if (r.value == null) { console.log(`skip  ${what}: ${r.reason}`); return; }
    console.log(`ok    ${what}: ${r.value} (${r.date})`);
    out.push(`${key}=${r.value}`, `${key}_date=${r.date}`);
  };

  // One after another, with a pause, like the Korea step: polite to both
  // hosts, and nothing here is in a hurry.
  report("bh_cpi", "Bahrain CPI (data.gov.bh)", await fetchBahrain(now).catch((e) => ({ value: null, reason: e.message })));
  for (const s of SERIES) {
    await new Promise((r) => setTimeout(r, 1500));
    report(s.key, s.what, await fetchImf(s, now).catch((e) => ({ value: null, reason: e.message })));
  }

  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, out.map((l) => l + "\n").join(""));
  else console.log("\n" + out.join("\n"));
}

// Run only when executed, not when a test imports the functions above.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/relay-gulf.mjs")) main();
