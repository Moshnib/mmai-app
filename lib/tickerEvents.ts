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
  /** When MMAI first stored the new figure (WeeklyMarketResult.changedAt).
   *  NOT the newest reading: that is always this morning, which kept the
   *  age gate below from ever firing. */
  at: string;
}

const SCORED: IndicatorKey[] = ["infGap", "une", "gdp", "debt", "rate"];

function format(key: IndicatorKey, v: number): string {
  const f = INDICATOR_FIELD[key];
  return `${v.toFixed(f.decimals)}${f.unit.includes("%") ? "%" : ""}`;
}

function eventsForMarket(m: WeeklyMarketResult): TickerEvent[] {
  const [now, then] = m.buckets;
  if (!now || !then || !m.changedAt) return [];
  const at = m.changedAt;
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
      at,
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
      at,
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

  // BY DAY, NOT BY THE SECOND. One refresh writes every market a few
  // seconds apart, always in the same order, so sorting by the exact
  // time ranked markets by the order the job happened to save them: the
  // US is written first and so always came last, and on 19 September the
  // strip carried five markets and dropped the US rate rise. Within a
  // day: band changes first, then the markets in the site's own order.
  const order = new Map(result.markets.map((m, i) => [m.marketCode, i]));
  const day = (iso: string) => iso.slice(0, 10);

  return [...perMarket.values()]
    .filter((e) => {
      const t = Date.parse(e.at);
      // A stamp in the future is a broken clock somewhere, not news.
      return Number.isFinite(t) && t >= cutoff && t <= now + 60_000;
    })
    .sort((a, b) => {
      const byDay = day(new Date(b.at).toISOString()).localeCompare(day(new Date(a.at).toISOString()));
      if (byDay !== 0) return byDay;
      if (a.kind !== b.kind) return a.kind === "band" ? -1 : 1;
      return (order.get(a.marketCode) ?? 99) - (order.get(b.marketCode) ?? 99);
    })
    .slice(0, limit);
}
