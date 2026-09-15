// ============================================================
// Ethereum stablecoin supply, monthly, back three years.
//
// Generated ONCE by querying archive state on Ethereum: for each point,
// a block roughly thirty days apart was read for every token's
// totalSupply(), and the block's own timestamp supplies the date. The
// dates are therefore REAL observation dates, not evenly spaced labels
// -- a block estimate can drift by a day or two and the label follows
// the chain, not the estimate.
//
// Committed as a file rather than a database table, mirroring
// lib/gulfHistory.ts: it is a fixed backfill that never changes, so a
// table would add a schema, a migration and a nightly write for data
// that is already final. The live current figure comes from
// lib/fetchers/stablecoins.ts and sits on top of this.
//
// null means the token DID NOT EXIST at that block, not that the read
// failed. USDS, USDe and PYUSD all launched inside this window, so
// their early points are genuinely absent and must never be drawn as
// zero -- a zero would imply a collapse that never happened.
//
// ETHEREUM ONLY, and the page must say so. Tron holds more USDT than
// Ethereum does and has been growing while Ethereum's share fell, so a
// reader shown this line without that context would conclude
// stablecoins are shrinking. They are not; the supply moved chains.
// Tron and Solana history is not obtainable: TronGrid ignores a block
// reference, Tronscan's supply-history endpoint 404s, and Tether's
// transparency file publishes current values only (all checked
// 2026-08-28).
// ============================================================

export interface StablecoinHistoryPoint {
  /** Real date of the block this was read at, YYYY-MM-DD. */
  date: string;
  /** Sum across every token that existed at that block, in dollars. */
  total: number;
  /** Per-token supply; null where the token had not launched yet. */
  bySymbol: Record<string, number | null>;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** One point as TrendChart wants it: a display label, a value in billions,
 *  and the ISO date to order by. */
export interface StablecoinSeriesPoint {
  year: string;
  value: number;
  sortKey: string;
}

/**
 * The Ethereum supply series, ready to chart.
 *
 * THIS LIVES HERE RATHER THAN IN THE PAGE because of two bugs that the
 * page's own inline version had, and both came from the label.
 *
 * IT WAS SORTED ALPHABETICALLY. TrendChart draws a CATEGORY axis and
 * orders it by each point's `sortKey`, falling back to the display label
 * when none is given. The page gave none, so 38 points labelled "Sep '23",
 * "Oct '23" and so on were ordered as text: Apr '24, Apr '25, Apr '26,
 * Aug '24, Aug '25... The line leapt between years at every step and the
 * chart read as violent zigzag. It was not the data. It was the sort --
 * the identical failure the bond panel hit, which is why `sortKey` exists
 * at all (see the comment above orderOf in components/TrendChart.tsx).
 *
 * THREE POINTS WERE BEING DROPPED. The label was month-and-year only, and
 * the backfill steps roughly thirty days, so it drifts across month ends:
 * 1 and 31 August 2025 both read "Aug '25", as did 1 and 31 October 2025
 * and 1 and 31 March 2026. TrendChart keys its axis by label, so the
 * second of each pair was silently discarded -- including 31 Aug 2025 at
 * $154.1bn, which is $14.8bn above the point that survived it.
 *
 * The label now carries the day, which is both unique and truthful: these
 * are real block dates, not month ends. Ticks are relabelled from the ISO
 * date anyway once a date axis is detected, so the axis stays readable.
 */
export function ethereumSupplySeriesPoints(): StablecoinSeriesPoint[] {
  return ETHEREUM_STABLECOIN_HISTORY.map((p) => {
    const [y, m, d] = p.date.split("-");
    return {
      year: `${Number(d)} ${MONTHS_SHORT[Number(m) - 1]} ${y.slice(2)}`,
      value: Math.round((p.total / 1e9) * 10) / 10,
      sortKey: p.date,
    };
  });
}

export const ETHEREUM_STABLECOIN_HISTORY: StablecoinHistoryPoint[] = [
  { date: "2023-09-06", total: 67002301829, bySymbol: { USDT: 39025187376, USDC: 24078629435, USDS: null, DAI: 3854108578, USDe: null, PYUSD: 44376440 } },
  { date: "2023-10-07", total: 66512756395, bySymbol: { USDT: 39024700486, USDC: 23553895648, USDS: null, DAI: 3824763721, USDe: null, PYUSD: 109396540 } },
  { date: "2023-11-06", total: 65522946439, bySymbol: { USDT: 39022689733, USDC: 22620000151, USDS: null, DAI: 3721299618, USDe: null, PYUSD: 158956937 } },
  { date: "2023-12-06", total: 67113349669, bySymbol: { USDT: 41013387301, USDC: 22267803193, USDS: null, DAI: 3674390762, USDe: 1015345, PYUSD: 156753068 } },
  { date: "2024-01-05", total: 69758027545, bySymbol: { USDT: 43007823220, USDC: 22610302986, USDS: null, DAI: 3759569299, USDe: 106243117, PYUSD: 274088923 } },
  { date: "2024-02-05", total: 71727640387, bySymbol: { USDT: 44005847707, USDC: 23606205937, USDS: null, DAI: 3658645948, USDe: 155765554, PYUSD: 301175241 } },
  { date: "2024-03-06", total: 75316940623, bySymbol: { USDT: 46005847707, USDC: 25042556354, USDS: null, DAI: 3223405587, USDe: 820780369, PYUSD: 224350606 } },
  { date: "2024-04-05", total: 82254687586, bySymbol: { USDT: 49999156520, USDC: 26774680899, USDS: null, DAI: 3277106616, USDe: 2012124817, PYUSD: 191618734 } },
  { date: "2024-05-06", total: 82700913039, bySymbol: { USDT: 50998658368, USDC: 25852379456, USDS: null, DAI: 3229731343, USDe: 2292060769, PYUSD: 328083103 } },
  { date: "2024-06-05", total: 82935655514, bySymbol: { USDT: 51998658368, USDC: 24163521798, USDS: null, DAI: 3257206968, USDe: 3117165650, PYUSD: 399102730 } },
  { date: "2024-07-05", total: 84087028656, bySymbol: { USDT: 51995716057, USDC: 24934012263, USDS: null, DAI: 3228125884, USDe: 3527318322, PYUSD: 401856130 } },
  { date: "2024-08-04", total: 83133455490, bySymbol: { USDT: 51991636685, USDC: 24374583477, USDS: null, DAI: 3200336314, USDe: 3210185393, PYUSD: 356713621 } },
  { date: "2024-09-03", total: 85631765234, bySymbol: { USDT: 53981730120, USDC: 25363743626, USDS: 0, DAI: 3224841073, USDe: 2707386300, PYUSD: 354064115 } },
  { date: "2024-10-03", total: 88240349881, bySymbol: { USDT: 54966606701, USDC: 26277995144, USDS: 997551548, DAI: 3089766258, USDe: 2536647010, PYUSD: 371783220 } },
  { date: "2024-11-03", total: 87911130055, bySymbol: { USDT: 54940840346, USDC: 25404994988, USDS: 1133298644, DAI: 3295619481, USDe: 2755927357, PYUSD: 380449239 } },
  { date: "2024-12-03", total: 110656497257, bySymbol: { USDT: 71929452094, USDC: 28954585147, USDS: 1096405490, DAI: 3566351939, USDe: 4770802261, PYUSD: 338900326 } },
  { date: "2025-01-02", total: 118465291528, bySymbol: { USDT: 76926220145, USDC: 30856106317, USDS: 1207912795, DAI: 3275777848, USDe: 5871866562, PYUSD: 327407861 } },
  { date: "2025-02-01", total: 123600608127, bySymbol: { USDT: 76923002800, USDC: 34271188721, USDS: 2532892850, DAI: 3478496317, USDe: 6060906864, PYUSD: 334120575 } },
  { date: "2025-03-03", total: 126872881511, bySymbol: { USDT: 75918584461, USDC: 37170412154, USDS: 4406446219, DAI: 3304799798, USDe: 5463616548, PYUSD: 609022331 } },
  { date: "2025-04-02", total: 129229273144, bySymbol: { USDT: 75891699897, USDC: 39806944757, USDS: 4558092615, DAI: 3152812129, USDe: 5260852657, PYUSD: 558871089 } },
  { date: "2025-05-02", total: 127492569495, bySymbol: { USDT: 74548182333, USDC: 40030219592, USDS: 4189394770, DAI: 3252659582, USDe: 4685161771, PYUSD: 786951447 } },
  { date: "2025-06-02", total: 126459086592, bySymbol: { USDT: 73045392828, USDC: 39598405961, USDS: 3650881919, DAI: 3984545942, USDe: 5494100992, PYUSD: 685758950 } },
  { date: "2025-07-02", total: 128939555454, bySymbol: { USDT: 73812341693, USDC: 41131515670, USDS: 4392681794, DAI: 3587184836, USDe: 5304899721, PYUSD: 710931740 } },
  { date: "2025-08-01", total: 139308255410, bySymbol: { USDT: 79788546910, USDC: 41781837522, USDS: 4640083735, DAI: 3734574788, USDe: 8579275905, PYUSD: 783936550 } },
  { date: "2025-08-31", total: 154148237613, bySymbol: { USDT: 84785141417, USDC: 47113853950, USDS: 4374735273, DAI: 4587997591, USDe: 12337171208, PYUSD: 949338174 } },
  { date: "2025-10-01", total: 168644431629, bySymbol: { USDT: 94775654692, USDC: 48331445683, USDS: 4270856677, DAI: 4584969656, USDe: 14715408188, PYUSD: 1966096733 } },
  { date: "2025-10-31", total: 173925268179, bySymbol: { USDT: 101742998349, USDC: 51056673650, USDS: 5273509161, DAI: 4644215512, USDe: 9469562084, PYUSD: 1738309423 } },
  { date: "2025-11-30", total: 175408452208, bySymbol: { USDT: 102696605277, USDC: 52418675503, USDS: 5849559630, DAI: 4435495335, USDe: 7193278649, PYUSD: 2814837814 } },
  { date: "2025-12-30", total: 173751604653, bySymbol: { USDT: 102695458676, USDC: 52036828600, USDS: 5817143307, DAI: 4237331061, USDe: 6303188836, PYUSD: 2661654173 } },
  { date: "2026-01-29", total: 168217665626, bySymbol: { USDT: 99639902897, USDC: 48705271789, USDS: 6177215429, DAI: 4342399782, USDe: 6597840212, PYUSD: 2755035517 } },
  { date: "2026-03-01", total: 169208780778, bySymbol: { USDT: 96121184635, USDC: 52932551691, USDS: 7017250070, DAI: 4179346706, USDe: 6038962776, PYUSD: 2919484900 } },
  { date: "2026-03-31", total: 172358954607, bySymbol: { USDT: 96115409244, USDC: 54681692986, USDS: 8452635768, DAI: 4370946548, USDe: 5883872296, PYUSD: 2854397765 } },
  { date: "2026-04-30", total: 171532964028, bySymbol: { USDT: 99082909927, USDC: 54289854127, USDS: 7457444450, DAI: 4417316156, USDe: 3891003615, PYUSD: 2394435753 } },
  { date: "2026-05-30", total: 168921916389, bySymbol: { USDT: 97071854588, USDC: 52462271515, USDS: 8480987167, DAI: 4358688615, USDe: 4505301578, PYUSD: 2042812926 } },
  { date: "2026-06-29", total: 167175225575, bySymbol: { USDT: 97063362283, USDC: 51399861996, USDS: 7876860189, DAI: 4628387549, USDe: 4461554711, PYUSD: 1745198847 } },
  { date: "2026-07-29", total: 158615613063, bySymbol: { USDT: 92058581162, USDC: 49760153209, USDS: 6561470016, DAI: 4597534888, USDe: 3848367864, PYUSD: 1789505924 } },
  { date: "2026-08-28", total: 156083144213, bySymbol: { USDT: 88306390736, USDC: 50644400707, USDS: 6635707740, DAI: 4607070994, USDe: 4077286895, PYUSD: 1812287141 } },
];

/** One colour per token, held here so the chart and any future use agree.
 *
 *  Distinctness is MEASURED, not assumed: scripts/test-stablecoin-series.ts
 *  computes the CIE76 distance between every pair and fails below 20,
 *  which is roughly where two 2px lines stop being tellable apart. Two
 *  market palettes once disagreed on five of six markets and nothing
 *  noticed until a test measured it -- see scripts/test-market-colours.ts.
 *
 *  USDT and USDC keep their issuers' own brand colours because readers
 *  already recognise them; the rest are chosen for separation. */
export const STABLECOIN_TOKEN_COLORS: Record<string, string> = {
  USDT: "#26A17B",
  USDC: "#3B8FE0",
  USDS: "#A78BFA",
  DAI: "#F5AC37",
  USDe: "#E85A5A",
  PYUSD: "#94A3B8",
};

/** Largest first, which is also the order the legend reads in. */
export const STABLECOIN_TOKEN_ORDER = ["USDT", "USDC", "USDS", "DAI", "USDe", "PYUSD"] as const;

/**
 * Each token's SHARE of Ethereum stablecoin supply, as a percentage.
 *
 * WHY SHARE AND NOT DOLLARS. The total line already answers "how big is
 * it". This answers "who is winning", and in dollars it could not: USDT
 * sits near $100bn while PYUSD sits near $2bn, so five of the six tokens
 * would be pressed flat against the axis and the composition -- the whole
 * point of the chart -- would be invisible. As shares they all occupy the
 * same 0-60% range and the shifts are legible.
 *
 * NULL MEANS THE TOKEN DID NOT EXIST at that block, and must stay null
 * rather than becoming 0. USDS, USDe and PYUSD all launched inside this
 * window; a zero would draw a line along the floor and imply a token that
 * existed at nothing, which is a different claim entirely. TrendChart
 * draws null as a gap.
 *
 * A share of ZERO is real and kept: USDS reads 0 on 2024-09-03, the block
 * where it had launched but held no supply yet.
 */
export function ethereumCompositionSeries(): Array<{
  key: string;
  name: string;
  color: string;
  data: Array<{ year: string; value: number | null; sortKey: string }>;
}> {
  return STABLECOIN_TOKEN_ORDER.map((symbol) => ({
    key: `share-${symbol}`,
    name: symbol,
    color: STABLECOIN_TOKEN_COLORS[symbol],
    data: ETHEREUM_STABLECOIN_HISTORY.map((p) => {
      const [y, m, d] = p.date.split("-");
      const supply = p.bySymbol[symbol];
      return {
        year: `${Number(d)} ${MONTHS_SHORT[Number(m) - 1]} ${y.slice(2)}`,
        value: supply == null || p.total === 0 ? null : Math.round((supply / p.total) * 1000) / 10,
        sortKey: p.date,
      };
    }),
  }));
}
