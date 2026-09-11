// ============================================================
// Bank of Japan fetcher — policy rate (Uncollateralized Overnight Call Rate)
// Public data, no key required. BOJ is a special corporation, not a
// government agency, but its statistical data is published for free public use.
// Endpoint and series code confirmed live 2026-08-21 (verified directly in
// browser after this tool's own fetch was blocked by BOJ's server — see
// MMAI_Full_Rebuild_Guide troubleshooting notes for that distinction).
// ============================================================

interface BojResponse {
  STATUS: number;
  RESULTSET: Array<{
    SERIES_CODE: string;
    NAME_OF_TIME_SERIES: string;
    VALUES: {
      SURVEY_DATES: number[]; // YYYYMMDD
      VALUES: Array<number | null>;
    };
  }>;
}

export async function fetchJapanPolicyRate(): Promise<{ policyRate: number; observationDate: string }> {
  const currentYear = new Date().getFullYear();
  const startDate = `${currentYear - 1}01`; // YYYYMM — one year back is plenty for "most recent"
  const url = `https://www.stat-search.boj.or.jp/api/v1/getDataCode?lang=en&db=FM01&code=STRDCLUCON&startDate=${startDate}`;

  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`BOJ request failed: ${res.status} ${res.statusText}`);

  const json: BojResponse = await res.json();
  if (json.STATUS !== 200) throw new Error(`BOJ API returned status: ${json.STATUS}`);

  const series = json.RESULTSET[0];
  if (!series) throw new Error("BOJ series STRDCLUCON returned no data");

  const dates = series.VALUES.SURVEY_DATES;
  const values = series.VALUES.VALUES;

  // Find the most recent non-null value — daily series has frequent gaps
  // (weekends/holidays), never treat a gap as zero.
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] !== null) {
      const d = String(dates[i]);
      const observationDate = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
      return { policyRate: values[i] as number, observationDate };
    }
  }
  throw new Error("BOJ series STRDCLUCON: no non-null values in range");
}
