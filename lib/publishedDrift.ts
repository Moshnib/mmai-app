// ============================================================
//  ARE THE STATISTICS THE LEARN PAGE PUBLISHES STILL TRUE?
//
//  The Learn page prints DIMENSION_CROSS_MARKET_SD (lib/composite.ts) as a
//  measured fact: how far each dimension spreads the scored markets. The
//  refresh compares it with the live spread after every run, and the
//  refresh workflow fails the run on any drift -- so this must never raise
//  a false alarm.
//
//  ONLY WHEN EVERY MARKET WAS SCORED THIS RUN. The published figure is the
//  spread across all of them; the spread across a subset is a different
//  number. On 22 September 2026 Japan's sources failed for one run, Japan
//  kept its earlier reading (correctly), and the spread of the other eight
//  -- without Japan, the Capacity outlier -- read 12.4 against a published
//  21.8. The false alarm failed the step and skipped the Gulf refresh
//  behind it. A run that scores only some markets (a source down, or the
//  freshness guard leaving the rest) says nothing about the page.
//
//  Tolerance is 1.0 SD points: published to one decimal, moving as real
//  economies move; 1.0 is roughly where the published ordering starts to
//  change, which is when a reader would be told something untrue.
// ============================================================

import { DIMENSION_CROSS_MARKET_SD, type DimensionKey } from "@/lib/composite";

export interface DriftCheck {
  /** One line per dimension that has drifted; empty when all hold. */
  drift: string[];
  /** Why nothing was compared, when nothing was. */
  skipped?: string;
}

export function checkPublishedDrift(
  live: Array<Record<DimensionKey, number>>,
  marketCount: number,
  published: Record<DimensionKey, number> = DIMENSION_CROSS_MARKET_SD,
): DriftCheck {
  if (live.length < marketCount) {
    return { drift: [], skipped: `${live.length} of ${marketCount} markets scored this run` };
  }
  const drift: string[] = [];
  for (const key of Object.keys(published) as DimensionKey[]) {
    const vals = live.map((p) => p[key]).filter((v): v is number => v != null);
    if (vals.length < 4) continue;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const liveSd = Math.sqrt(vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / vals.length);
    if (Math.abs(liveSd - published[key]) > 1.0) {
      drift.push(`${key}: Learn page publishes ${published[key].toFixed(1)}, live is ${liveSd.toFixed(1)}`);
    }
  }
  return { drift };
}
