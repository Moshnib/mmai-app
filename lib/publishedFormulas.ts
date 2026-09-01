// ============================================================
// THE FORMULAS AS PUBLISHED TO READERS.
//
// The Learn page tells every visitor: "You can take the raw numbers for
// any market, run them through the formulas shown here, and get the
// exact score shown on the Overview page — no hidden adjustments."
//
// That is a promise, and on 2026-08-31 it was briefly broken: Australia's
// inflation target moved to 2.5% and the published formula still said
// "|inflation − 2%|". Nothing caught it, because the formula was prose
// typed into a page and the engine was code in another file. Two strings
// that mean the same thing can only stay equal by accident.
//
// So the formulas live HERE, in one place, and
// scripts/verify-published-formulas.ts parses these strings, evaluates
// them, and asserts they reproduce lib/scoring.ts exactly across a sweep
// of inputs. If someone changes a coefficient in the engine without
// changing the sentence a reader sees, CI fails.
//
// KEEP THE SYNTAX PARSEABLE. The verifier understands exactly:
//     clamp( A ± B × <term> , 0, 100 )
// where <term> is one of
//     |var − target|      absolute deviation from the market's target
//     |var|               absolute value
//     (var − C)           shifted
//     var                 bare
// Unicode − × | are used deliberately: this is typeset for a reader, not
// for a machine. If a future pillar needs a shape this cannot express,
// EXTEND THE VERIFIER — do not quietly drop the pillar from the check.
// ============================================================

import type { PillarKey } from "./scoring";

export interface PublishedFormula {
  /** Human label shown before the "=" on the Learn page. */
  label: string;
  /** The expression itself. Parsed and executed by the verifier. */
  expression: string;
  /** Which raw indicator the expression's variable refers to. */
  variable: string;
}

export const PUBLISHED_FORMULAS: Record<PillarKey, PublishedFormula> = {
  PS: {
    label: "Price Stability Score",
    expression: "clamp(100 − 15 × |inflation − target|, 0, 100)",
    variable: "inflation",
  },
  GM: {
    label: "Growth Momentum Score",
    expression: "clamp(50 + 10 × (GDP growth %), 0, 100)",
    variable: "GDP growth",
  },
  LM: {
    label: "Labour Market Score",
    expression: "clamp(100 − 10 × (unemployment% − 2%), 0, 100)",
    variable: "unemployment",
  },
  MC: {
    label: "Monetary Conditions Score",
    expression: "clamp(100 − 12 × |policy rate − neutral|, 0, 100)",
    variable: "policy rate",
  },
  EC: {
    label: "External & Commodities Score",
    expression: "clamp(100 − 1.2 × |Brent YoY % change|, 0, 100)",
    variable: "Brent YoY",
  },
};

/** One line, exactly as a reader sees it. */
export function formulaLine(key: PillarKey): string {
  const f = PUBLISHED_FORMULAS[key];
  return `${f.label} = ${f.expression}`;
}
