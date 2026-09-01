// ============================================================
// e-Stat — the Portal Site of Official Statistics of Japan.
//
// WHY THIS EXISTS
// Japan's inflation was the last badly stale figure in MMAI: a World
// Bank ANNUAL number dated January 2025, while Japan sat at the top of
// the table. Every other route was closed --
//
//   OECD's Japanese CPI series ends June 2021 (verified: NoRecordsFound
//   for 2026 on any methodology value).
//   Statistics Bureau's English pages link back to e-Stat rather than
//   publishing a machine-readable file.
//
// e-Stat is Japan's official statistics portal and publishes the real
// series. It requires a free registered application ID, which is why
// this was blocked until the site owner obtained one.
//
// LICENCE / KEY
// ESTAT_APP_ID is server-side only and must never reach the browser.
// Without it this throws, and the refresh route's settle() turns that
// into a null for the indicator rather than failing the whole market.
//
// ------------------------------------------------------------
// THE QUERY, AND WHY EACH PART IS WHAT IT IS
//
//   statsDataId=0003427113   2020-base Consumer Price Index, table 1
//   cdTab=3                  表章項目 = 前年同月比
//                            "change from the same month, previous year"
//   cdCat01=0001             品目 = 総合  (All items -- headline CPI,
//                            not core, not ex-food-and-energy)
//   cdArea=00000             地域 = 全国  (All Japan, NOT the Tokyo
//                            ku-area series, which is published earlier
//                            each month and is a different population)
//
// cdTab=3 is the important one. e-Stat also offers tab=1 (the index
// LEVEL) and tab=2 (月比/前年比 mixed). Only tab=3 is the year-over-year
// rate, which is the concept every MMAI market must use -- the same rule
// that governs the GDP fetchers.
// ============================================================

interface EstatValue {
  "@time": string; // "2026000707" -> 2026, July
  $: string;       // the observation, as a string
}

const CPI_STATS_DATA_ID = "0003427113";

export async function fetchJapanInflation(): Promise<{ inflation: number; observationDate: string }> {
  const appId = process.env.ESTAT_APP_ID;
  if (!appId) throw new Error("ESTAT_APP_ID is not configured");

  const url =
    `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${appId}` +
    `&statsDataId=${CPI_STATS_DATA_ID}` +
    `&cdTab=3&cdCat01=0001&cdArea=00000` +
    `&limit=6&metaGetFlg=N`;

  const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`e-Stat request failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const root = json?.GET_STATS_DATA;
  const status = root?.RESULT?.STATUS;
  // e-Stat answers HTTP 200 with the error inside the body, like BEA.
  // STATUS 0 is success; anything else carries a Japanese ERROR_MSG.
  if (status !== 0) {
    throw new Error(`e-Stat returned status ${status}: ${root?.RESULT?.ERROR_MSG ?? "unknown"}`);
  }

  const raw = root?.STATISTICAL_DATA?.DATA_INF?.VALUE;
  if (!raw) throw new Error("e-Stat: no VALUE block in response");
  // A single observation comes back as an object, not an array.
  const values: EstatValue[] = Array.isArray(raw) ? raw : [raw];

  // Newest first is not guaranteed, so sort rather than assume.
  const rows = values
    .map((v) => ({ time: String(v["@time"]), value: parseFloat(v.$) }))
    .filter((r) => /^\d{10}$/.test(r.time) && Number.isFinite(r.value))
    .sort((a, b) => a.time.localeCompare(b.time));

  if (rows.length === 0) throw new Error("e-Stat: no usable observations returned");

  const latest = rows[rows.length - 1];
  // "2026000707" -> year 2026, month 07. The middle digits repeat the
  // month in e-Stat's own encoding; first four and last two are the
  // parts that matter.
  const year = latest.time.slice(0, 4);
  const month = latest.time.slice(8, 10);
  if (Number(month) < 1 || Number(month) > 12) {
    throw new Error(`e-Stat: unexpected time code "${latest.time}"`);
  }

  return {
    inflation: Math.round(latest.value * 100) / 100,
    observationDate: `${year}-${month}-01`,
  };
}
