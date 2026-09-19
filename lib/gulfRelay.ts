// ============================================================
//  GULF FIGURES HANDED IN BY THE REFRESH WORKFLOW
//
//  scripts/relay-gulf.mjs fetches Bahrain's CPI and four IMF series on the
//  GitHub runner and passes them to /api/refresh-gulf as query parameters
//  (bh_cpi=3&bh_cpi_date=2026-07-01, ...). This reads them back, and
//  refuses anything that is not a plausible number with a first-of-month
//  date: a query string is input, and a malformed one must be dropped,
//  never stored. What is dropped becomes null, which carry-forward covers.
//
//  Also builds each row's source note, because the note now depends on
//  which path produced the figure -- and it travels with the data: the
//  Gulf CSV export carries the column, so the IMF's required attribution
//  goes wherever the data goes.
// ============================================================

export interface RelayedFigure {
  value: number;
  observationDate: string;
}

export type RelayKey = "bh_cpi" | "om_cpi" | "kw_cpi" | "ae_cpi" | "qa_rate";

const RANGE: Record<RelayKey, [number, number]> = {
  bh_cpi: [-20, 60],
  om_cpi: [-20, 60],
  kw_cpi: [-20, 60],
  ae_cpi: [-20, 60],
  qa_rate: [0, 30],
};

export function parseGulfRelay(url: URL): Partial<Record<RelayKey, RelayedFigure>> {
  const out: Partial<Record<RelayKey, RelayedFigure>> = {};
  for (const key of Object.keys(RANGE) as RelayKey[]) {
    const raw = url.searchParams.get(key);
    const date = url.searchParams.get(`${key}_date`);
    if (raw == null || date == null || raw.trim() === "") continue;
    const value = Number(raw);
    const [min, max] = RANGE[key];
    if (!Number.isFinite(value) || value < min || value > max) continue;
    // The relay dates every figure at the first of its (last) month.
    if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(date)) continue;
    // An exact zero is the IMF's placeholder, not a rate (see the relay).
    // Checked here too: the route should not trust the script to have.
    if (value === 0 && key !== "qa_rate") continue;
    out[key] = { value, observationDate: date };
  }
  return out;
}

export const IMF_CPI_ATTRIBUTION =
  "Source: International Monetary Fund, Consumer Price Index (CPI), https://data.imf.org/en/datasets/IMF.STA:CPI";
export const IMF_RATE_ATTRIBUTION =
  "Source: International Monetary Fund, Monetary and Financial Statistics: Interest Rates (MFS_IR), https://data.imf.org/en/datasets/IMF.STA:MFS_IR";

/** The row's source note, from what actually produced its figures. */
export function gulfSourceNote(country: string, used: { imfCpi: boolean; imfRate: boolean }): string {
  const base: Record<string, string> = {
    AE: used.imfCpi ? "IMF CPI (quarterly) + World Bank" : "World Bank",
    BH: "data.gov.bh + World Bank",
    QA: used.imfRate ? "data.gov.qa + IMF MFS_IR + World Bank" : "data.gov.qa + World Bank",
    SA: "Data Saudi + World Bank + BIS",
    KW: used.imfCpi ? "IMF CPI (monthly) + World Bank + BIS" : "World Bank + BIS",
    OM: used.imfCpi ? "IMF CPI (monthly) + World Bank" : "World Bank",
  };
  const credits = [used.imfCpi ? IMF_CPI_ATTRIBUTION : null, used.imfRate ? IMF_RATE_ATTRIBUTION : null].filter(Boolean);
  return `${base[country] ?? "World Bank"} (live)${credits.length ? `. ${credits.join(". ")}` : ""}`;
}
