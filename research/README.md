# research/ — candidate scoring, never production

Per charter §14: production equations are never edited in place during
testing, and V1 remains a read-only benchmark until a replacement is
validated. Nothing in this folder is imported by the site.

```
npx tsx research/compare.ts
```

## Files

- **`v2-candidate.ts`** — a candidate scoring set. Every parameter is
  labelled `[SOURCED]`, `[DESIGN]` or `[PLACEHOLDER]`, per charter §4's
  rule against inventing a coefficient and calling it scientific.
- **`compare.ts`** — the side-by-side harness §14 requires. It imports V1
  from `lib/scoring.ts` rather than copying it, so the comparison cannot
  drift from what production actually computes.

## What the candidate changes

Exactly two things, chosen because they are the only parts of V1 that are
arguably *indefensible* rather than merely unproven:

1. **Per-market neutral rate** instead of one 2.5% for all six markets.
2. **Asymmetric penalties** in Price Stability and Monetary Conditions —
   V1 scores inflation 1pp below target identically to 1pp above.

Weights, coverage gate, bands, and the GM/LM/EC equations are held
identical so the diff is interpretable. Charter §13's "remove one
indicator and one pillar at a time" is the same discipline.

## Findings as of 31 Aug 2026

Run against the 48 stored historical points:

- **10 of 48 points (21%) change BAND.** A published label changing one
  time in five is a product decision, not only a methodology one.
- Historical means are mostly **negative** (−1.1 to −1.4) while the
  latest reading is mostly **positive**. The candidate is more volatile,
  not merely shifted.
- Australia's worst historical point moves **−10.11**.
- Japan crosses Supportive → **Strongly Supportive** — driven almost
  entirely by its placeholder neutral rate of 1.0 against V1's 2.5.

None of this justifies a release. The neutral rates and the undershoot
penalty producing most of the movement are **placeholders**, so the
comparison shows what would happen *if* those values were right, which is
a different question from whether they are.

## The sixth-pillar question is currently unanswerable

Charter §6 lists "Financial Conditions / Stability" as a possible sixth
pillar, to be tested *as a separate pillar vs part of Monetary
Conditions*. §7 cites BIS WP No. 1272, separating **safe yields** from
**financial risk** — the 10-year yield is the safe-yields factor.

Measured against live data on 31 Aug 2026, the redundancy test **cannot
be computed**: the policy rate did not vary over the window where the two
series overlap, so correlation was undefined for four of six markets and
meaningless (n = 6 to 8) for the other two.

This is not a null result. It is the absence of one. Deciding between the
two variants needs multiple rate *cycles* — years — and bond collection
only began 2025-08-29.

## Blocker for everything else

§13 requires testing across the Global Financial Crisis. MMAI's stored
history begins in **2019**. Until a historical calibration dataset exists
(§18 lists it as a required deliverable), the validation plan cannot run
at all.
