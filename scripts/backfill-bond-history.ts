// ============================================================
// BOND YIELD HISTORY — 10-YEAR AND 5-YEAR, ALL SIX MARKETS
//
// The live fetchers pull only the most recent readings, and only the
// 10-year. That is enough to draw a chart and nowhere near enough to
// standardise: a z-score needs a mean and a standard deviation, and
// Japan held 21 days of data.
//
// WHY 5-YEAR AND NOT 2-YEAR. The classic recession signal is the slope
// between a long and a short government yield, usually 10y minus 2y. The
// Bank of England does not publish a 2-year gilt yield -- only 5, 10 and
// 20. Using 2y for five markets and 5y for the UK would make the six
// non-comparable while looking entirely reasonable, which is the exact
// failure this project has already been bitten by on GDP. So the slope
// is 10y - 5y everywhere.
//
// COMMON WINDOW. Japan reaches back to 1974 and the US to 1990, but
// Australia's RBA table F2 starts in 2013 and that binds the pooled
// window for all six.
//
//   npx tsx scripts/backfill-bond-history.ts            report only
//   npx tsx scripts/backfill-bond-history.ts --write    write to Supabase
// ============================================================

interface Row { market: string; date: string; y10: number; y5: number | null }

const UA = { "User-Agent": "Mozilla/5.0 (compatible; MMAI/1.0; +https://mmai-app.vercel.app)" };

/** Quote-aware CSV line splitter. The naive split(",") that abs.ts once
 *  used breaks the moment a source puts a comma inside a quoted note --
 *  and several of these do. */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const num = (s: string | undefined): number | null => {
  if (s == null) return null;
  const v = Number(String(s).trim());
  return Number.isFinite(v) ? v : null;
};

async function text(url: string): Promise<string> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

// ---------- United States: Treasury, one file per year ----------
async function us(fromYear: number, toYear: number): Promise<Row[]> {
  const out: Row[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=daily_treasury_yield_curve&field_tdr_date_year=${y}&page&_format=csv`;
    let body: string;
    try { body = await text(url); } catch { continue; }
    const lines = body.trim().split(/\r?\n/);
    const head = splitCsv(lines[0]).map((h) => h.replace(/"/g, "").trim());
    const i10 = head.indexOf("10 Yr"), i5 = head.indexOf("5 Yr");
    if (i10 < 0) continue;
    for (const ln of lines.slice(1)) {
      const c = splitCsv(ln);
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((c[0] || "").trim());
      const v10 = num(c[i10]);
      if (!m || v10 == null) continue;
      out.push({ market: "US", date: `${m[3]}-${m[1]}-${m[2]}`, y10: v10, y5: i5 >= 0 ? num(c[i5]) : null });
    }
  }
  return out;
}

// ---------- Japan: Ministry of Finance, whole archive in one file ----------
async function jp(): Promise<Row[]> {
  const body = await text("https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/historical/jgbcme_all.csv");
  const out: Row[] = [];
  for (const ln of body.trim().split(/\r?\n/)) {
    const c = splitCsv(ln);
    // Japanese fiscal-era dates appear as YYYY/M/D.
    const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec((c[0] || "").replace(/^﻿/, "").trim());
    if (!m) continue;
    // Header order: Date,1Y,2Y,3Y,4Y,5Y,6Y,7Y,8Y,9Y,10Y,...
    const y5 = num(c[5]), y10 = num(c[10]);
    if (y10 == null) continue;
    const d = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    out.push({ market: "JP", date: d, y10, y5 });
  }
  return out;
}

// ---------- United Kingdom: Bank of England IADB ----------
async function uk(from: string, to: string): Promise<Row[]> {
  const url = `https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&UsingCodes=Y&CSVF=TN&Datefrom=${from}&Dateto=${to}&SeriesCodes=IUDMNPY,IUDSNPY`;
  const body = await text(url);
  const lines = body.trim().split(/\r?\n/);
  const head = splitCsv(lines[0]).map((h) => h.trim());
  const i10 = head.indexOf("IUDMNPY"), i5 = head.indexOf("IUDSNPY");
  const out: Row[] = [];
  const MON: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
  for (const ln of lines.slice(1)) {
    const c = splitCsv(ln);
    const m = /^(\d{2}) (\w{3}) (\d{4})$/.exec((c[0] || "").trim());
    const v10 = i10 >= 0 ? num(c[i10]) : null;
    if (!m || v10 == null) continue;
    out.push({ market: "UK", date: `${m[3]}-${MON[m[2]]}-${m[1]}`, y10: v10, y5: i5 >= 0 ? num(c[i5]) : null });
  }
  return out;
}

// ---------- Euro Area: ECB AAA yield curve ----------
async function ea(start: string): Promise<Row[]> {
  const get = async (mat: string) => {
    const body = await text(`https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_${mat}?startPeriod=${start}&format=csvdata`);
    const lines = body.trim().split(/\r?\n/);
    const head = splitCsv(lines[0]);
    const ti = head.indexOf("TIME_PERIOD"), vi = head.indexOf("OBS_VALUE");
    const map = new Map<string, number>();
    for (const ln of lines.slice(1)) {
      const c = splitCsv(ln);
      const d = (c[ti] || "").trim(), v = num(c[vi]);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v != null) map.set(d, v);
    }
    return map;
  };
  const [m10, m5] = await Promise.all([get("10Y"), get("5Y")]);
  return [...m10].map(([date, y10]) => ({ market: "EA", date, y10, y5: m5.get(date) ?? null }));
}

// ---------- Canada: Bank of Canada Valet ----------
async function ca(start: string): Promise<Row[]> {
  const body = await text(`https://www.bankofcanada.ca/valet/observations/BD.CDN.10YR.DQ.YLD,BD.CDN.5YR.DQ.YLD/json?start_date=${start}`);
  const j = JSON.parse(body) as { observations?: Array<Record<string, { v?: string } | string>> };
  const out: Row[] = [];
  for (const o of j.observations ?? []) {
    const date = o.d as string;
    const a = o["BD.CDN.10YR.DQ.YLD"], b = o["BD.CDN.5YR.DQ.YLD"];
    const y10 = num(typeof a === "object" ? a?.v : undefined);
    const y5 = num(typeof b === "object" ? b?.v : undefined);
    if (!date || y10 == null) continue;
    out.push({ market: "CA", date, y10, y5 });
  }
  return out;
}

// ---------- Australia: RBA table F2 ----------
async function au(): Promise<Row[]> {
  const body = await text("https://www.rba.gov.au/statistics/tables/csv/f2-data.csv");
  const lines = body.trim().split(/\r?\n/);
  let idRow = -1;
  for (let i = 0; i < lines.length; i++) if (/^Series ID/i.test(lines[i])) { idRow = i; break; }
  if (idRow < 0) throw new Error("RBA F2: Series ID row not found");
  const ids = splitCsv(lines[idRow]).map((s) => s.trim());
  const i10 = ids.indexOf("FCMYGBAG10D"), i5 = ids.indexOf("FCMYGBAG5D");
  if (i10 < 0) throw new Error("RBA F2: 10-year series not found");
  const MON: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
  const out: Row[] = [];
  for (const ln of lines.slice(idRow + 1)) {
    const c = splitCsv(ln);
    const m = /^(\d{1,2})-(\w{3})-(\d{4})$/.exec((c[0] || "").trim());
    const v10 = num(c[i10]);
    if (!m || v10 == null) continue;
    out.push({ market: "AU", date: `${m[3]}-${MON[m[2]]}-${m[1].padStart(2, "0")}`, y10: v10, y5: i5 >= 0 ? num(c[i5]) : null });
  }
  return out;
}

// ---------- run ----------
async function main() {
  const jobs: Array<[string, () => Promise<Row[]>]> = [
    ["US", () => us(2013, 2026)],
    ["JP", () => jp()],
    ["UK", () => uk("01/Jan/2013", "03/Sep/2026")],
    ["EA", () => ea("2013-01-01")],
    ["CA", () => ca("2013-01-01")],
    ["AU", () => au()],
  ];

  const all: Row[] = [];
  console.log("market   rows    earliest      latest       with 5y   slope avail");
  console.log("-".repeat(72));
  for (const [name, fn] of jobs) {
    try {
      const rows = (await fn()).filter((r) => r.date >= "2013-01-01");
      rows.sort((a, b) => a.date.localeCompare(b.date));
      all.push(...rows);
      const with5 = rows.filter((r) => r.y5 != null).length;
      console.log(
        `${name.padEnd(8)} ${String(rows.length).padStart(5)}   ${(rows[0]?.date ?? "-").padEnd(12)} ${(rows[rows.length - 1]?.date ?? "-").padEnd(12)} ${String(with5).padStart(6)}   ${with5 > 0 ? "yes" : "NO"}`
      );
    } catch (e) {
      console.log(`${name.padEnd(8)} FAILED  ${(e as Error).message.slice(0, 50)}`);
    }
  }

  console.log(`\ntotal rows: ${all.length}`);
  const commonStart = Math.max(...["US", "JP", "UK", "EA", "CA", "AU"].map((m) => {
    const f = all.filter((r) => r.market === m)[0];
    return f ? Date.parse(f.date) : 0;
  }));
  console.log(`common window starts: ${new Date(commonStart).toISOString().slice(0, 10)}`);

  // ---------- CSV for import ----------
  //
  // Written rather than inserted because SUPABASE_SERVICE_ROLE_KEY is
  // deliberately a placeholder on this machine -- that key bypasses every
  // row-level security policy, and it belongs in Vercel, not in a
  // developer's .env.local. The CSV goes in through the dashboard's own
  // import, which is authenticated as the project owner.
  //
  // The table already carries UNIQUE (market, observation_date), so a
  // re-import cannot silently double the history.
  if (process.argv.includes("--csv")) {
    const fs = await import("node:fs");
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const SRC: Record<string, string> = {
      US: "U.S. Treasury daily yield curve",
      JP: "Japan Ministry of Finance, JGB interest rates",
      UK: "Bank of England IADB (IUDMNPY, IUDSNPY)",
      EA: "ECB AAA euro area yield curve",
      CA: "Bank of Canada Valet benchmark bond yields",
      AU: "Reserve Bank of Australia table F2",
    };
    // fetched_at records WHEN WE ASKED, not what the row is about. The
    // observation date is its own column; conflating the two is the
    // mistake that let a nine-month-old euro area figure read as live.
    const stamp = new Date().toISOString();
    const lines = ["market,observation_date,yield_10y,yield_5y,source_note,fetched_at"];
    for (const r of all) {
      lines.push([
        r.market, r.date, String(r.y10), r.y5 == null ? "" : String(r.y5),
        esc(`${SRC[r.market]} — historical backfill`), stamp,
      ].join(","));
    }
    const path = "bond-history-backfill.csv";
    fs.writeFileSync(path, lines.join("\n"), "utf8");
    console.log(`\nwrote ${path}  (${lines.length - 1} rows, ${(lines.join("\n").length / 1048576).toFixed(2)} MB)`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

// No imports, so this would otherwise be a global script whose top-level
// type names collide with the other standalone scripts.
export {};
