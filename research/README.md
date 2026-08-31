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

## Neutral rates: sourced for three of six, and why that blocks release

Charter §9.4 records the 2.5% neutral policy rate as unjustified. The
recognised source is the **Holston-Laubach-Williams** model, published free
by the New York Fed and updated quarterly (latest release 27 Aug 2026).

Read from `Holston_Laubach_Williams_current_estimates.xlsx`, 2026Q2:

| Market | HLW r* (real) | Nominal neutral (r* + 2%) | MMAI uses |
|---|---|---|---|
| United States | 1.009 | **3.01%** | 2.50% |
| Canada | 1.759 | **3.76%** | 2.50% |
| Euro Area | 0.086 | **2.09%** | 2.50% |
| United Kingdom | — | not covered | 2.50% |
| Japan | — | not covered | 2.50% |
| Australia | — | not covered | 2.50% |

**HLW covers three of MMAI's six markets, not four.** An earlier note in
this session said four; that was wrong, corrected on reading the file.

Measured effect (`npx tsx research/rstar-impact.ts`):

```
United States   77.21 -> 78.35   +1.15
Euro Area       79.19 -> 79.38   +0.19
Canada          76.50 -> 73.66   -2.83
rank now  : EA > JP > US > UK > CA > AU
rank after: EA > JP > US > UK > AU > CA
```

### Why this is NOT ready to ship

Applying researched neutral rates to three markets while the other three
keep an unsourced 2.5% makes the index **internally inconsistent**. Canada
would be measured properly and Japan by guess, and the cross-country
comparison — the entire purpose of the index — stops meaning the same thing
for each row.

That is arguably worse than being uniformly wrong: a uniform error is at
least a *comparable* error.

**This needs all six or none.** UK, Japan and Australia need either a
documented alternative estimate or an explicit, disclosed design choice
before any of it ships.

### Also unresolved
The NY Fed publishes HLW freely and states how to cite it, but Federal
Reserve Bank content is not automatically public domain the way BLS and BEA
federal works are. **The licence must be checked before this enters
production**, per charter §12: free access is not automatic redistribution
rights.

---

## The historical calibration panel (charter §18) — BUILT

`npx tsx research/build-historical-panel.ts` rebuilds it; `historical-panel.json`
is the output. **1990–2018, six markets, five indicators, 96.6% coverage.**

Only sources already cleared for this project were used, so the panel adds
no new licensing question: World Bank (CC BY 4.0), BIS (unrestricted with
citation), EIA (public domain).

It is a **script, not a spreadsheet**. A hand-assembled file cannot be
audited or rebuilt when a source revises, and is worth little as an
intellectual asset.

### Three limits that travel with the data
1. **Revised, not vintage.** Supports full-information backtests only. It can
   never support a claim that MMAI "would have signalled" anything live.
2. **The euro area has no policy rate before 1999.** Flagged `preRegime`.
3. **Japan has no policy rate for 1999, 2001–2005 and 2013–2015.** Verified
   absent at BIS. The BoJ was targeting the monetary base, not a rate — the
   instrument MMAI scores did not exist. Those years score on four pillars
   (coverage 0.80). **Exclude Japan when calibrating the MC coefficient.**

## First results — the GFC test the charter has been blocked on

`npx tsx research/score-historical-panel.ts`

**MMAI detects the Global Financial Crisis, unambiguously.**

| Market | 2007 | 2008/09 low | Change |
|---|---|---|---|
| United States | 78.8 | 47.8 | **−31.0** |
| Euro Area | 77.7 | 47.7 | −30.1 |
| Japan | 74.8 | 45.8 | −29.0 |
| Canada | 78.7 | 51.2 | −27.5 |
| United Kingdom | 78.6 | 55.3 | −23.3 |
| **Australia** | 80.6 | 74.7 | **−5.9** |

Every market falls from *Supportive* to *Balanced* — **except Australia**,
which barely moves. That is the correct answer: Australia avoided a technical
recession in 2008–09 on Chinese commodity demand. **The index reproduces both
the crisis and its most famous exception without being told about either.**

This is the strongest evidence for MMAI produced so far.

### But the bands are badly calibrated

Across 173 market-years including the GFC:

```
min 30.5   p25 66.3   median 73.5   p75 77.9   max 87.4
Supportive 109 · Balanced 34 · Strongly Supportive 25 · Challenging 5
```

- **63% of all observations fall in one band.** The label is nearly constant.
- **Nothing ever reached "Highly Challenging"** — not in the worst financial
  crisis since 1929.
- The index **never used the bottom 30% of its scale** in 29 years.

Charter §15 requires that verbal bands "must themselves be researched and
documented. They should not be invented merely for visual appeal." This is
the evidence that they were not, and now the data exists to fix them.

---

## Band calibration (charter §15) — evidence now exists

```
npx tsx research/calibrate-bands.ts        compare three schemes against named episodes
npx tsx research/band-uniqueness.ts        is the answer unique? (no)
npx tsx research/band-recommendation.ts    pick within the defensible region
```

Charter §15 requires verbal bands be researched, "not invented merely for
visual appeal." The current 30/45/65/80 were invented. Scored over the
1990–2018 panel they put **63% of all observations in one band** and never
once reached the bottom label — not in 2009.

### Method: anchor to identified episodes, not to quantiles

Charter §9.1 cautions against purely percentile-based approaches: they are
sample-relative and drift as data accumulates. So thresholds are instead
required to classify **ten named macroeconomic episodes** the way an
economist would. The anchors are the argument — to dispute the bands you
must dispute a specific historical claim.

A pure-quantile scheme was run as the baseline and **fails badly: 3/10**.
It labels US 2008 "Highly Challenging", which is simply wrong.

### The result, and the honest caveat

An episode-anchored search satisfies **10/10**. That is exactly the result to
distrust — the search was designed to maximise anchor hits.

Checking for uniqueness: **2,376 threshold sets satisfy all ten anchors.**
The anchors CONSTRAIN each threshold to a range; they do not fix a point:

| Threshold | Defensible range | Current value | Verdict |
|---|---|---|---|
| Highly Challenging / Challenging | 40 – 45 | 30 | **outside** |
| Challenging / Balanced | 48 – 59 | 45 | **outside** |
| Balanced / Supportive | 64 – 74 | 65 | survives |
| Supportive / Strongly Supportive | 85 – 87 | 80 | **outside** |

**Three of the four current thresholds sit outside any defensible range.**
Only the 65 survives — by coincidence, not by design.

Recommended within the feasible region, choosing the most even distribution
and preferring legible numbers: **40 / 55 / 74 / 85**. All five bands are
used and all ten anchors hold.

### The deeper problem bands cannot fix

Even at 40/55/74/85, **91% of observations still land in Balanced or
Supportive**. That is not a band failure — it is score compression. Across
29 years and six markets the composite spans only 30.5 to 87.4, never using
the bottom 30% of its scale even at the trough of the GFC.

Bands only redistribute labels across the range the score actually occupies.
**Fixing the compression requires the coefficients** — which is the next
calibration, and the one this panel now makes possible.

### A rescale was proposed, then rejected — `rescale-demo.ts`

Charter §4 requires rejected equations be preserved with the reason. This is one.

**Proposed:** stretch the composite so the historical floor (30.5) maps to 10
and the ceiling (87.4) to 90, so a crisis reads low.

**Rejected**, for four reasons, any one sufficient:

1. **It is dynamic min-max, which the charter explicitly rejects — twice.**
   §9.1: *"Pure percentile scoring and dynamic min-max are not preferred as
   the core solution because they can make scores excessively sample-relative
   or unstable when extremes change."*
2. **The entire scale hangs on one observation** — UK 1990. A single worse
   year would move the anchor and **retroactively change every score MMAI has
   ever published.** An index whose history rewrites itself is not a benchmark.
3. **It breaks reproducibility by hand,** adding two magic numbers from a
   dataset readers do not have. That property is MMAI's strongest claim.
4. **It adds two unsourced parameters** — the audit would go from 2-of-12
   sourced to 2-of-14. Wrong direction.

### What to do instead: change only the bands

Verified — changing the thresholds from **30/45/65/80 → 40/55/74/85** fixes the
real defect while touching nothing else:

| Episode | Score | Now | After |
|---|---|---|---|
| **US 2009** — worst year since the 1930s | 47.8 | **Balanced** | **Challenging** |
| Euro Area 2009 | 47.7 | Balanced | Challenging |
| Japan 2009 | 45.8 | Balanced | Challenging |
| UK 1990 recession | 30.5 | Challenging | **Highly Challenging** |
| Canada 1991 recession | 39.1 | Challenging | Highly Challenging |
| Australia 2009 (dodged recession) | 74.7 | Supportive | Supportive |

- **"Highly Challenging" goes from used 0 times in 173 years to 3.**
- **All six current market labels are unchanged** — no disruption for readers.
- **No score changes. No parameter is added. Hand-reproducibility intact.**

Strictly better than the rescale on every dimension.

---

## HLW licence: CLEARED (checked 31 Aug 2026)

Charter §12 — *free API access is not automatic commercial redistribution
rights* — required this be settled before the New York Fed's r\* estimates
could enter production. Now settled, and favourably.

From the New York Fed **Terms of Use** (last updated 9 June 2023), read directly:

> "The New York Fed grants you a non-exclusive license, subject to the Terms,
> to use, copy, and distribute Content for your personal or **business**
> purposes. You may: Access the Content, manually or through an **automated
> process or device** …; **Download, store, and use Content in any format or
> media**; **Copy and distribute** the Content …; and **Modify and create
> derivative works** from the Content."

| Need | Permitted |
|---|---|
| Commercial use | ✅ "business purposes" |
| Automated retrieval | ✅ "automated process or device" |
| **Store in a database** | ✅ **"Download, store, and use"** |
| Redistribute / publish | ✅ "copy and distribute" |
| Derive a score from it | ✅ "modify and create derivative works" |

The database-storage clause is the exact permission FRED refused, which
forced FRED's removal from this project. **The New York Fed grants it
explicitly.**

**Condition:** attribution — carry copyright notices and source identifiers,
and use the citation form where one is given. The r\* page gives one:
*Federal Reserve Bank of New York, Measuring the Natural Rate of Interest,
newyorkfed.org/research/policy/rstar/overview*.

**This removes the last non-data blocker on the neutral-rate work.** What
still blocks it: HLW covers three of six markets — the UK, Japan and
Australia have no published estimate.
