// ============================================================
// 10-year government bond yields, one source per market.
//
// WHY THIS INDICATOR
// The policy rate is what a central bank SETS. The 10-year yield is
// what the market BELIEVES about growth and inflation over a decade.
// When the two diverge, that gap is itself the story. It is also the
// only genuinely macro series that moves every trading day -- CPI, GDP
// and unemployment are surveys published monthly at best, so no amount
// of polling can make them move faster.
//
// This is a DISPLAYED indicator, not a pillar. It does not enter the
// MMAI composite. Making Monetary Conditions reflect market rates as
// well as the policy rate would be a methodology change and a separate
// decision.
//
// EVERY SOURCE AND LICENCE VERIFIED LIVE 2026-08-29:
//   US  US Treasury      Public Domain, citation requested (data.gov)
//   UK  Bank of England   Open Government Licence v3.0
//   EA  ECB               ECB free access and reuse policy
//   CA  Bank of Canada    BoC Terms -- free to use, copy, distribute
//   AU  RBA               CC BY 4.0 (the cash-rate carve-out does not
//                         apply to capital market yields)
//   JP  Ministry of Finance  Public Data License 1.0 -- commercial use
//                         explicitly permitted, attribution required
// Four of the six are APIs this project already calls for policy rates.
//
// FOUR TRAPS FOUND BY TESTING, not by reading docs:
//  1. RBA publishes TWO tables. f2.1-data.csv is MONTHLY (end-of-month
//     values); the daily one is f2-data.csv. Reading the wrong file
//     yields monthly data labelled daily.
//  2. Japan's CSV 404s without the /english/ path, and is Shift-JIS
//     encoded with a trailing human-readable footer note to skip.
//  3. BoE needs the database/_iadb-fromshowcolumns.asp path; the
//     shorter iadb/ path 302-redirects.
//  4. BoE's series identity was CONFIRMED from its own metadata
//     (IUDMNPY = "10 year Nominal Par Yield") rather than inferred from
//     the numbers, which would have been a guess.
//
// Markets close at weekends and on holidays. A missing day is normal and
// must never be read as a zero -- every reader below sorts by parsed
// date and takes the newest row that actually carries a number.
// ============================================================

export interface BondYield {
  market: string;
  /** 10-year nominal government bond yield, %. */
  yield10y: number;
  /** 2-year, where the source publishes it. Only the US curve does
   *  today, which is what makes the 10y-2y spread available. */
  yield2y: number | null;
  /** The trading day this yield is for, YYYY-MM-DD. */
  observationDate: string;
}

const TIMEOUT_MS = 8000;

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** Quote-aware CSV line split. Several of these feeds carry commas
 *  inside quoted description fields -- the same trap documented in
 *  lib/fetchers/bis.ts, where a naive split silently reads the wrong
 *  column. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; }
      } else current += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { fields.push(current); current = ""; }
    else current += ch;
  }
  fields.push(current);
  return fields;
}

async function getText(url: string, decodeLatin1 = false): Promise<string> {
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`request failed: ${res.status} ${res.statusText}`);
  if (!decodeLatin1) return res.text();
  // Japan's file is not UTF-8. Decoding it as UTF-8 mangles the footer
  // and can corrupt the parse; latin1 keeps every byte addressable and
  // the numeric columns are ASCII regardless.
  const buf = await res.arrayBuffer();
  return new TextDecoder("latin1").decode(buf);
}

function num(s: string | undefined): number | null {
  if (!s) return null;
  const t = s.trim();
  // Strict: a stray "N/A" or a thousands separator must fail loudly
  // rather than parseFloat-ing into a wrong number.
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/** Every usable row, oldest first. Sorted explicitly and filtered to
 *  rows that actually parsed -- never "the last row", since none of
 *  these feeds guarantee ordering, and never a row whose date failed to
 *  parse (that is how a footer note or a blank line gets in). */
function toSeries(
  market: string,
  rows: Array<{ date: string; v10: number; v2?: number | null }>
): BondYield[] {
  const usable = rows
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(r.v10))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      market,
      yield10y: r.v10,
      yield2y: r.v2 ?? null,
      observationDate: r.date,
    }));
  if (usable.length === 0) throw new Error("no usable observations");
  return usable;
}

/** Newest reading in a series. */
export function latestOf(series: BondYield[]): BondYield {
  return series[series.length - 1];
}

// ---------- United States ----------
export async function fetchUsBondYields(): Promise<BondYield[]> {
  const year = new Date().getUTCFullYear();
  const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_year=${year}&page&_format=csv`;
  const lines = (await getText(url)).trim().split("\n");
  const header = parseCsvLine(lines[0]).map((h) => h.replace(/"/g, "").trim());
  const di = header.indexOf("Date");
  const i10 = header.indexOf("10 Yr");
  const i2 = header.indexOf("2 Yr");
  if (di === -1 || i10 === -1) throw new Error("US Treasury: expected columns not found");

  const rows = lines.slice(1).map(parseCsvLine).map((c) => {
    // MM/DD/YYYY
    const m = (c[di] ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return {
      date: m ? `${m[3]}-${m[1]}-${m[2]}` : "",
      v10: num(c[i10]) ?? NaN,
      v2: i2 === -1 ? null : num(c[i2]),
    };
  });
  return toSeries("US", rows);
}

// ---------- United Kingdom ----------
export async function fetchUkBondYields(): Promise<BondYield[]> {
  // IUDMNPY confirmed from BoE's own metadata as "10 year Nominal Par
  // Yield". 120 days rather than a handful: BoE needs an explicit range,
  // and this is the one source where the window size decides how much
  // history a backfill can reach. Also means a run over a bank holiday
  // still finds plenty of rows.
  const to = new Date();
  const from = new Date(to.getTime() - 120 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}/${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()]}/${d.getUTCFullYear()}`;
  const url = `https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&SeriesCodes=IUDMNPY&UsingCodes=Y&CSVF=TN&Datefrom=${fmt(from)}&Dateto=${fmt(to)}`;
  const lines = (await getText(url)).trim().split("\n");
  if (lines.length < 2) throw new Error("BoE: no data rows");

  const rows = lines.slice(1).map(parseCsvLine).map((c) => {
    // "20 Aug 2026"
    const m = (c[0] ?? "").trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
    const mo = m ? MONTHS[m[2].toLowerCase()] : undefined;
    return {
      date: m && mo ? `${m[3]}-${mo}-${m[1].padStart(2, "0")}` : "",
      v10: num(c[1]) ?? NaN,
    };
  });
  return toSeries("UK", rows);
}

// ---------- Euro Area ----------
export async function fetchEuroAreaBondYields(): Promise<BondYield[]> {
  // AAA-rated euro-area government yield curve, 10-year spot.
  const url =
    "https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y?lastNObservations=150&format=csvdata";
  const lines = (await getText(url)).trim().split("\n");
  const header = parseCsvLine(lines[0]);
  const di = header.indexOf("TIME_PERIOD");
  const vi = header.indexOf("OBS_VALUE");
  if (di === -1 || vi === -1) throw new Error("ECB: expected columns not found");

  const rows = lines.slice(1).map(parseCsvLine).map((c) => ({
    date: (c[di] ?? "").trim(),
    v10: num(c[vi]) ?? NaN,
  }));
  return toSeries("EA", rows);
}

// ---------- Canada ----------
export async function fetchCanadaBondYields(): Promise<BondYield[]> {
  const url = "https://www.bankofcanada.ca/valet/observations/BD.CDN.10YR.DQ.YLD/json?recent=150";
  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Bank of Canada request failed: ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { observations?: Array<Record<string, { v?: string } | string>> };
  const obs = json.observations ?? [];
  const rows = obs.map((o) => {
    const cell = o["BD.CDN.10YR.DQ.YLD"];
    const v = typeof cell === "object" && cell ? num(cell.v ?? "") : null;
    return { date: typeof o.d === "string" ? o.d : "", v10: v ?? NaN };
  });
  return toSeries("CA", rows);
}

// ---------- Australia ----------
export async function fetchAustraliaBondYields(): Promise<BondYield[]> {
  // f2-data.csv is the DAILY table. f2.1-data.csv is monthly -- reading
  // that one would publish end-of-month values as if they were today's.
  const url = "https://www.rba.gov.au/statistics/tables/csv/f2-data.csv";
  const lines = (await getText(url)).trim().split("\n");
  const idRow = lines.findIndex((l) => l.startsWith("Series ID"));
  if (idRow === -1) throw new Error("RBA: no Series ID row");

  // "FCMYGBAG10D" -- the trailing D means DAILY. The monthly table
  // (f2.1-data.csv) names the same maturity "FCMYGBAG10" without it, so
  // a substring match would happily accept either and silently read
  // whichever file it was handed. Matched exactly for that reason.
  const ids = parseCsvLine(lines[idRow]).map((c) => c.trim());
  const col = ids.indexOf("FCMYGBAG10D");
  const col2 = ids.indexOf("FCMYGBAG2D");
  if (col === -1) throw new Error("RBA: series FCMYGBAG10D not found");

  const rows = lines.slice(idRow + 1).map(parseCsvLine).map((c) => {
    // "26-Aug-2026"
    const m = (c[0] ?? "").trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    const mo = m ? MONTHS[m[2].toLowerCase()] : undefined;
    return {
      date: m && mo ? `${m[3]}-${mo}-${m[1].padStart(2, "0")}` : "",
      v10: num(c[col]) ?? NaN,
      v2: col2 === -1 ? null : num(c[col2]),
    };
  });
  return toSeries("AU", rows);
}

// ---------- Japan ----------
export async function fetchJapanBondYields(): Promise<BondYield[]> {
  // The /english/ path is required; without it the URL 404s. The file
  // covers the CURRENT MONTH only and ends with a human-readable note,
  // which the date regex below simply fails to match and skips.
  const url = "https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/jgbcme.csv";
  const text = await getText(url, true);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const headerRow = lines.findIndex((l) => /^Date,/.test(l.trim()));
  if (headerRow === -1) throw new Error("Japan MoF: header row not found");
  const header = parseCsvLine(lines[headerRow]).map((h) => h.trim());
  const i10 = header.indexOf("10Y");
  if (i10 === -1) throw new Error("Japan MoF: 10Y column not found");

  const rows = lines.slice(headerRow + 1).map(parseCsvLine).map((c) => {
    // "2026/8/3" -- single-digit month and day
    const m = (c[0] ?? "").trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    return {
      date: m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : "",
      v10: num(c[i10]) ?? NaN,
    };
  });
  return toSeries("JP", rows);
}

export const BOND_YIELD_MARKETS = ["US", "UK", "EA", "CA", "AU", "JP"] as const;

const READERS: Record<string, () => Promise<BondYield[]>> = {
  US: fetchUsBondYields,
  UK: fetchUkBondYields,
  EA: fetchEuroAreaBondYields,
  CA: fetchCanadaBondYields,
  AU: fetchAustraliaBondYields,
  JP: fetchJapanBondYields,
};

/** Named per market so a row can say where it came from, the same way
 *  raw_indicators carries source_note. */
export const BOND_YIELD_SOURCE: Record<string, string> = {
  US: "US Treasury daily yield curve",
  UK: "Bank of England IADB IUDMNPY",
  EA: "ECB AAA euro-area yield curve, 10y spot",
  CA: "Bank of Canada Valet BD.CDN.10YR.DQ.YLD",
  AU: "RBA F2 FCMYGBAG10D",
  JP: "Japan Ministry of Finance JGB daily",
};

/** A government bond yield outside this range means the parse found the
 *  wrong column, not an extraordinary market. */
function plausible(y: BondYield): boolean {
  return Number.isFinite(y.yield10y) && y.yield10y >= -5 && y.yield10y <= 30;
}

/** Full available series per market, oldest first. Used by the backfill
 *  and by anything that wants more than today's number. */
export async function fetchAllBondYieldSeries(): Promise<Record<string, BondYield[]>> {
  const out: Record<string, BondYield[]> = {};
  await Promise.all(
    Object.entries(READERS).map(async ([market, read]) => {
      try {
        const series = (await read()).filter(plausible);
        if (series.length) out[market] = series;
      } catch (err) {
        console.error(`Bond yield series ${market} failed:`, err instanceof Error ? err.message : err);
      }
    })
  );
  return out;
}

/** Reads every market concurrently and returns only the newest reading.
 *  One source failing yields null for that market rather than sinking
 *  the run -- six independent government endpoints, so all-or-nothing
 *  would rarely complete. */
export async function fetchAllBondYields(): Promise<Array<BondYield | null>> {
  return Promise.all(
    Object.entries(READERS).map(async ([market, read]) => {
      try {
        const series = (await read()).filter(plausible);
        if (!series.length) throw new Error("no plausible observations");
        return latestOf(series);
      } catch (err) {
        console.error(`Bond yield ${market} failed:`, err instanceof Error ? err.message : err);
        return null;
      }
    })
  );
}
