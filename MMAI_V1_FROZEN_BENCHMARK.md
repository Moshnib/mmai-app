# MMAI V1 — Frozen Benchmark

**Frozen:** 31 August 2026
**Commit:** `68534f2`
**Git tag:** `v1-benchmark`
**Formula version:** v1.0

Created to satisfy §14 of the *Full Methodology, Research and Intellectual Property Working Charter* (30 August 2026), which requires a dated copy of the current V1 source code, equations, data schema and known outputs before methodology research begins.

> **What this document is for.** V1 is a **read-only benchmark**, not the final methodology. The charter (§8) is explicit that the constants and unequal weights are not yet scientifically justified. Nothing here is a claim that these equations are correct — only an exact, reproducible record of what production computed on this date, so any candidate V2 can be compared against it rather than against memory.

---

## 1. Scoring equations

Reproduced from `lib/scoring.ts` at commit `68534f2`. `clip` bounds a value to 0–100.

| Pillar | Equation | Weight |
|---|---|---|
| Price Stability | `PS = clip(100 − 15 × abs(inflation − 2))` | 0.2500 |
| Growth Momentum | `GM = clip(50 + 10 × gdpGrowth)` | 0.2500 |
| Labour Market | `LM = clip(120 − 10 × unemployment)` | 0.1875 |
| Monetary Conditions | `MC = clip(100 − 12 × abs(policyRate − 2.5))` | 0.1875 |
| External & Commodities | `EC = clip(100 − 1.2 × abs(brentYoY))` | 0.1250 |

**Composite:** `MMAI = 0.25·PS + 0.25·GM + 0.1875·LM + 0.1875·MC + 0.125·EC`

Two implementation details that matter for reproduction:

- The code writes Labour Market as `clip(100 − 10 × (u − 2))`. That is algebraically identical to the charter's `clip(120 − 10u)`; both forms appear here so neither reads as a discrepancy later.
- The inflation target (2.0) and neutral rate (2.5) are **hard-coded constants applied to every market**, not per-market policy targets. The charter's §9 research register treats both as open.

### Missing pillars

Weights are **renormalised**, never zero-filled:

```
composite = Σ(pillarScore × weight) / Σ(weight of populated pillars)
coverage  = populatedPillars / 5
```

A score is withheld entirely when `coverage < 0.70` — i.e. fewer than 4 of 5 pillars. This is why a single failed fetcher moves a published score rather than blanking it, which is how Japan silently published 75.35 instead of 79.1 for two days in August 2026.

### Bands

Categorical labels applied to the composite:

| Range | Label |
|---|---|
| ≥ 80 | Strongly Supportive |
| ≥ 65 | Supportive |
| ≥ 45 | Balanced |
| ≥ 30 | Challenging |
| < 30 | Highly Challenging |
| `null` | Not Publishable |

Per charter §15 these thresholds are **design choices, not researched values**, and are listed here as part of the record rather than as justified science.

---

## 2. Known outputs — 31 August 2026

The frozen benchmark. Every market at coverage 1.0.

| Market | PS | GM | LM | MC | EC | Composite | Band |
|---|---|---|---|---|---|---|---|
| Euro Area | 100.0000 | 62.0000 | 57.0000 | 97.0000 | 78.5080 | **79.1885** | Supportive |
| Japan | 82.4120 | 61.9311 | 95.4900 | 81.7240 | 78.5080 | **79.1269** | Supportive |
| United States | 79.6000 | 71.0000 | 79.0000 | 86.4400 | 78.5080 | **78.4835** | Supportive |
| United Kingdom | 86.5000 | 63.8844 | 71.0000 | 85.0000 | 78.5080 | **76.6596** | Supportive |
| Canada | 84.5500 | 67.4269 | 56.0000 | 97.0000 | 78.5080 | **76.4952** | Supportive |
| Australia | 78.2500 | 63.5040 | 75.3818 | 77.8000 | 78.5080 | **73.9736** | Supportive |

### Inputs that produced them

| Market | Inflation % | GDP growth % | Unemployment % | Policy rate % | Brent YoY % |
|---|---|---|---|---|---|
| United States | 3.36 | 2.10 | 4.10 | 3.63 | 17.91 |
| Euro Area | 2.00 | 1.20 | 6.30 | 2.25 | 17.91 |
| Canada | 3.03 | 1.7427 | 6.40 | 2.25 | 17.91 |
| United Kingdom | 2.90 | 1.3884 | 4.90 | 3.75 | 17.91 |
| Japan | 3.1725 | 1.1931 | 2.451 | 0.977 | 17.91 |
| Australia | 3.45 | 1.3504 | 4.4618 | 4.35 | 17.91 |

Brent is a single global input shared by all markets, not a per-market figure.

### Reproduction check

The equations in §1 were run against the inputs above and compared with the composites stored in `mmai_scores`. **Largest disagreement: 0.0000267** — pure rounding of the stored four-decimal values.

This is the property that makes the benchmark usable: the record reproduces production, so a V2 comparison measures a real methodology change and not a transcription error.

---

## 3. Data sources at freeze

One source per market per indicator. Licence detail lives in `lib/sources.ts`.

| Market | Price Stability | Growth | Labour | Monetary |
|---|---|---|---|---|
| United States | BLS | BEA | BLS | NY Fed (EFFR) |
| Euro Area | Eurostat (HICP) | Eurostat | Eurostat | ECB (deposit facility) |
| Canada | Statistics Canada | World Bank | Statistics Canada | Bank of Canada |
| United Kingdom | ONS | World Bank | ONS | Bank of England |
| Japan | World Bank | World Bank | OECD → World Bank fallback | Bank of Japan |
| Australia | ABS | World Bank | ABS | RBA |

**External & Commodities:** US EIA, Brent crude, shared across all markets.

Two source facts worth freezing explicitly:

- **Japan's labour source is unreliable in production.** OECD answers from a laptop and from GitHub's runners and fails from Vercel. A World Bank annual fallback was added 31 Aug 2026; when it engages, the row's `source_note` says so. Japan's unemployment at this freeze (2.451) is the **fallback annual figure**, not OECD's monthly one.
- **GDP is annual for five of six markets** (World Bank), and annual for the US too — the BEA fetcher requests `Frequency=A` although BEA publishes quarterly.

---

## 4. Database schema at freeze

| Table | Columns | Purpose |
|---|---|---|
| `raw_indicators` | 11 | Per-market indicator readings, appended per run |
| `mmai_scores` | 14 | Computed pillars, composite, coverage, band |
| `gulf_indicators` | 18 | Gulf Watch, unscored |
| `bond_yields` | 7 | 10y/2y government yields, unique per market+date |
| `subscribers` | 5 | Email notification list |
| `feedback_submissions` | 7 | Contact form |

`mmai_scores` retains a `pillar_mm` column from the removed Market Momentum pillar and a `formula_version` column. Full DDL is in `supabase/schema.sql`.

---

## 5. What is deliberately NOT claimed

Per charter §4 — "never invent a coefficient, target, threshold, neutral rate, weight or score and call it scientific" — the following are **explicit MMAI design choices, not evidence-backed values**:

- Every coefficient: 15, 10, 10, 12, 1.2
- The 2.0% inflation target applied uniformly to all six markets
- The 2.5% neutral rate applied uniformly to all six markets
- All five pillar weights
- The 0.70 coverage gate
- All five band thresholds
- Using absolute deviation, symmetrically, in PS and MC — inflation below target and above target are scored identically, as are policy rates below and above neutral

Charter §17 records Growth, Labour, Monetary and Fiscal/External equations as **Open**, and the five-pillar structure as a **working hypothesis** to be tested against four and six.

---

## 6. Restoring this version

```bash
git checkout v1-benchmark      # exact source at freeze
git diff v1-benchmark -- lib/scoring.ts   # what changed since
```

Per charter §14, methodology experiments belong on a separate branch. Production equations are not to be edited in place during testing, and any candidate must be run side-by-side against the outputs in §2 before release.

---

## 7. Known deviation from the charter, recorded honestly

Charter §4 requires that no production source change without "a documented reason, historical comparison, sensitivity test and rollback path", and §14 requires side-by-side V1-vs-candidate output before release.

Between 28 and 31 August 2026 — **before this charter was supplied** — the unemployment source changed for four markets (Canada → Statistics Canada, UK → ONS, Australia → ABS, Japan → OECD). Published scores moved: Canada +0.94, Australia −0.70, UK −0.28, Japan −0.09. Each change carried a documented reason and a measured before/after in its commit message, but none produced a formal side-by-side release comparison or a rollback path.

The `raw_indicators` history retains the pre-change values, so that comparison remains reconstructable. It is recorded here rather than left for someone to discover.
