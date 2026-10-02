// ============================================================
//  THE LAST PUBLISHED PRICE, AND WHAT IT MOVED FROM
//
//  Every other figure on this site is published monthly or quarterly. A
//  daily price is a different animal, and it brings two problems that
//  have each already bitten this project once:
//
//  1. THE PREVIOUS PRICE IS NOT YESTERDAY'S. Markets close at weekends
//     and on holidays, so Monday's move is measured against Friday.
//     components/BondYieldPanel.tsx gets the arithmetic right (it takes
//     the previous element of the array) and then labels it "vs prev.
//     day", which is false every Monday. Here the baseline's own date is
//     returned, so whatever prints it has no way to guess wrong.
//
//  2. THE NEWEST PRICE IS NOT TODAY'S. The EIA publishes its daily spot
//     two to four days in arrears -- on 2 October the newest was 29
//     September. That is normal and permanent, not an outage, so the date
//     travels with the price everywhere it goes. The site has twice
//     shipped a figure that was correct and looked wrong (the Fed's
//     target range, the UTC timestamp); a three-day-old oil price
//     presented as "today" would be the third.
//
//  Pure, so scripts/test-commodity-prices.ts can hold it to all of that
//  without a network or a browser.
// ============================================================

export interface PricePoint {
  /** YYYY-MM-DD, the trading day the price is for. */
  date: string;
  price: number;
}

export interface PriceReading {
  price: number;
  date: string;
  /** The previous PUBLISHED observation -- Friday, when today is Monday.
   *  Null when there is only one point, which is not the same as zero
   *  change and must not be printed as "unchanged". */
  prevPrice: number | null;
  prevDate: string | null;
  absChange: number | null;
  pctChange: number | null;
  /** The source has published nothing for longer than its usual lag.
   *  Shown as "no new price since ..." rather than a stale figure wearing
   *  today's clothes. */
  stale: boolean;
}

/** How many days without a new observation before the price is reported
 *  as stale rather than current. The EIA's lag is two to four days and
 *  weekends stretch that, so six is the first number that cannot fire on
 *  a healthy week. */
export const PRICE_STALE_AFTER_DAYS = 6;

const DAY_MS = 86_400_000;

/** The newest point, what it moved from, and whether the source has gone
 *  quiet. Null when there is nothing to show -- the caller renders
 *  nothing rather than a zero.
 *
 *  Input may arrive in any order and with repeats (a revised price for a
 *  day it already holds); the newest row for a date wins, which matches
 *  the upsert that writes them. */
export function latestWithChange(
  points: PricePoint[],
  now: number = Date.now(),
  staleAfterDays: number = PRICE_STALE_AFTER_DAYS,
): PriceReading | null {
  const byDate = new Map<string, number>();
  for (const p of points) {
    // `== null` and not a truthiness test: a price of 0 is a price, and a
    // date of "" is not a date.
    if (!p || typeof p.date !== "string" || p.date === "" || p.price == null || !Number.isFinite(p.price)) continue;
    byDate.set(p.date, p.price);
  }
  const sorted = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (sorted.length === 0) return null;

  const [date, price] = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const prevDate = previous ? previous[0] : null;
  const prevPrice = previous ? previous[1] : null;

  const absChange = prevPrice == null ? null : price - prevPrice;
  // Against the PREVIOUS price, not the new one. Flipping the denominator
  // gives -5.0% where the truth is -5.3% on the real 28->29 September
  // pair: wrong by exactly the amount nobody notices.
  const pctChange = prevPrice == null || prevPrice === 0 ? null : ((price - prevPrice) / prevPrice) * 100;

  const ageDays = (now - Date.parse(`${date}T00:00:00Z`)) / DAY_MS;
  return { price, date, prevPrice, prevDate, absChange, pctChange, stale: ageDays > staleAfterDays };
}

/** "29 September", for a date that is already a day and not a moment.
 *  Formatted in UTC deliberately: these are date-only strings, and in a
 *  reader's own zone they shift a day backwards west of UTC -- see the
 *  warning on formatWhen in lib/liveTime.ts. */
export function formatPriceDay(date: string, withYear = false): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", ...(withYear ? { year: "numeric" as const } : {}), timeZone: "UTC",
  });
}

/** "$113.96". Two decimals, which is how the EIA publishes it. */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/** "−$6.01 (−5.0%) since 28 September", or null when there is no
 *  baseline to measure from. THE BASELINE NAMES ITSELF: no "today", no
 *  "on the day", nothing a weekend can falsify. */
export function describeChange(reading: PriceReading): string | null {
  if (reading.absChange == null || reading.pctChange == null || reading.prevDate == null) return null;
  const sign = reading.absChange < 0 ? "−" : "+";
  const abs = Math.abs(reading.absChange).toFixed(2);
  const pct = Math.abs(reading.pctChange).toFixed(1);
  return `${sign}$${abs} (${sign}${pct}%) since ${formatPriceDay(reading.prevDate)}`;
}
