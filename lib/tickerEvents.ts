// ============================================================
//  WHAT ACTUALLY CHANGED, AS A LINE OF TICKER
//
//  The owner asked whether the strip could carry news. It can carry
//  something better than news: what THIS site's own figures did. Every
//  line below is a comparison of two readings already in the database,
//  so there is no new source, no licence to honour, and nothing that can
//  quietly rot -- the worst case is that there is nothing to say, which
//  is itself true and is rendered as nothing.
//
//  Two kinds of event, and the second one matters more:
//
//    a published figure moved   "UK inflation 2.9% -> 3.1%"
//    a market changed band      "Japan moved into Above average"
//
//  A band change is the only thing on this site that a reader might act
//  on, and it is exactly what the alert emails are built around. It
//  leads.
//
//  AGE IS A HARD GATE. A ticker showing a three-week-old move reads as
//  an abandoned site, which is worse than an empty one. Anything older
//  than MAX_EVENT_AGE_DAYS is dropped, whatever else is available.
// ============================================================

import { INDICATOR_FIELD, percentileBandLabel, type IndicatorKey } from "@/lib/composite";
import type { WeeklyChangesResult, WeeklyMarketResult } from "@/lib/weeklyChanges";

/** Older than this and it is history, not news. */
export const MAX_EVENT_AGE_DAYS = 14;

/** Below this a "change" is a rounding artefact: the feed prints one
 *  decimal, so two readings that print the same have not moved as far as
 *  a reader is concerned. Matches the epsilon lib/weeklyChanges.ts uses
 *  for the composite. */
const MOVED = 0.05;

export interface TickerEvent {
  marketCode: string;
  marketName: string;
  /** "band" first: it is the only line here anyone acts on. */
  kind: "band" | "indicator";
  text: string;
  /** When the newer of the two readings was fetched. */
  at: string;
}

const SCORED: IndicatorKey[] = ["infGap", "une", "gdp", "debt", "rate"];

function format(key: IndicatorKey, v: number): string {
  const f = INDICATOR_FIELD[key];
  return `${v.toFixed(f.decimals)}${f.unit.includes("%") ? "%" : ""}`;
}

function eventsForMarket(m: WeeklyMarketResult): TickerEvent[] {
  const [now, then] = m.buckets;
  if (!now || !then) return [];
  const out: TickerEvent[] = [];

  // ---- the band, first ----
  const bandNow = percentileBandLabel(now.composite);
  const bandThen = percentileBandLabel(then.composite);
  if (now.composite != null && then.composite != null && bandNow !== bandThen) {
    const up = now.composite > then.composite;
    out.push({
      marketCode: m.marketCode,
      marketName: m.marketName,
      kind: "band",
      text: `${m.marketName} moved ${up ? "up" : "down"} into ${bandNow}`,
      at: now.fetchedAt,
    });
  }

  // ---- then whichever published figures moved ----
  for (const key of SCORED) {
    const field = INDICATOR_FIELD[key].key;
    const a = then.raw[field];
    const b = now.raw[field];
    if (typeof a !== "number" || typeof b !== "number") continue;
    if (Math.abs(a - b) < MOVED) continue;
    out.push({
      marketCode: m.marketCode,
      marketName: m.marketName,
      kind: "indicator",
      text: `${m.marketName} ${INDICATOR_FIELD[key].label.toLowerCase()} ${format(key, a)} → ${format(key, b)}`,
      at: now.fetchedAt,
    });
  }

  return out;
}

/**
 * Every recent change worth scrolling past, newest first, band changes
 * ahead of figures within the same moment.
 *
 * `now` is passed in rather than read from the clock so the test can
 * pin it; a date-dependent test that reads Date.now() passes today and
 * fails in a fortnight.
 */
export function buildTickerEvents(
  result: WeeklyChangesResult,
  now: number = Date.now(),
  limit = 8,
): TickerEvent[] {
  if (!result.ok) return [];

  const cutoff = now - MAX_EVENT_AGE_DAYS * 86_400_000;

  // ONE LINE PER MARKET. A quarterly source moves every market at once --
  // BIS published government debt on 16 September and the strip filled
  // with nine near-identical debt lines, which reads as a stuck feed
  // rather than a busy one. Each market contributes its most meaningful
  // change: a band move if it had one, otherwise its first moved figure,
  // which eventsForMarket already orders.
  const perMarket = new Map<string, TickerEvent>();
  for (const e of result.markets.flatMap(eventsForMarket)) {
    if (!perMarket.has(e.marketCode)) perMarket.set(e.marketCode, e);
  }

  return [...perMarket.values()]
    .filter((e) => {
      const t = Date.parse(e.at);
      // A stamp in the future is a broken clock somewhere, not news.
      return Number.isFinite(t) && t >= cutoff && t <= now + 60_000;
    })
    .sort((a, b) => {
      const byTime = Date.parse(b.at) - Date.parse(a.at);
      if (byTime !== 0) return byTime;
      if (a.kind !== b.kind) return a.kind === "band" ? -1 : 1;
      return a.marketName.localeCompare(b.marketName);
    })
    .slice(0, limit);
}
