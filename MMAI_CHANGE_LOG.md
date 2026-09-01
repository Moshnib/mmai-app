# MMAI Change Log

Required by §14 of the *Full Methodology, Research and Intellectual Property Working Charter* (30 August 2026), which specifies that every proposed change record **old rule, new rule, reason, reference, data used, test results, impact, approval status and rollback method**, and by §18, which lists a "change log from V1 to any approved successor" as a preserved research deliverable.

Entries are newest first. The frozen V1 record is in [`MMAI_V1_FROZEN_BENCHMARK.md`](MMAI_V1_FROZEN_BENCHMARK.md); it is a dated snapshot and is **not** edited by changes recorded here.

---

## 2026-08-31 — US Price Stability switched from CPI to headline PCE

**Category:** Data source change. No equation, weight, band or threshold was modified.

### Old rule
US Price Stability read year-over-year **CPI-U** from the Bureau of Labor Statistics (`fetchUsInflation`, series `CUUR0000SA0`) and scored it against a 2% target.

### New rule
US Price Stability reads year-over-year **headline PCE** from the Bureau of Economic Analysis (`fetchUsPceInflation`, NIPA table `T20804`, line 1, monthly) and scores it against the same 2% target. BLS CPI is retained as an automatic fallback.

### Reason
MMAI's Price Stability pillar scores deviation from a 2% target. For the United States that target belongs to the Federal Reserve, and the Fed's *Statement on Longer-Run Goals and Monetary Policy Strategy* defines the 2% objective on the annual change in the **PCE price index** — not CPI. Feeding CPI into a PCE-defined target measured the United States against a benchmark it does not use.

This was identified independently twice: by the charter (§10, "US scoring should use the Fed-relevant headline PCE concept if the methodology claims to score against the Fed's inflation objective") and by the MMAI evidence audit of 31 August 2026.

### Reference
- Federal Reserve — Statement on Longer-Run Goals and Monetary Policy Strategy
- Working Charter §10, *Price Stability — Conclusions Already Reached*
- BEA NIPA table T20804, *Price Indexes for Personal Consumption Expenditures by Major Type of Product*

### Data used
Both series fetched live on 31 August 2026 for the **same observation month**, 2026M07:

| Series | Source | Value |
|---|---|---|
| CPI-U, YoY | BLS | 3.36% |
| Headline PCE, YoY | BEA | **3.70%** |

**PCE was running 0.34pp *above* CPI.** This is the reverse of the long-run relationship, in which CPI's fixed basket and narrower scope usually place it above PCE. It is the direct evidence for why the correct series must be fetched rather than approximated from the other with an assumed wedge — and it corrects a directional assumption made in the first draft of the evidence audit.

### Test results
- Standalone fetcher test against the live BEA API before wiring, per this project's rule that no fetcher is wired unproven.
- Guard verified: the fetcher throws if table T20804 line 1 ceases to be headline PCE, rather than silently scoring the US on another line.
- `npx tsc --noEmit` clean. `npx eslint` on all six touched files: 0 errors. `npm run build` clean.

### Impact

| | Before | After | Change |
|---|---|---|---|
| US Price Stability | 79.60 | 74.50 | −5.10 |
| **US composite** | **78.48** | **77.21** | **−1.275** |

- **No band changed**, for any market. The US remains *Supportive*.
- **No ranking changed.** Order remains EA > JP > US > UK > CA > AU.
- Five markets are unaffected; this is a US-only source change.
- Sensitivity: each 0.10pp of difference between the two series moves US Price Stability by 1.50 points and the composite by 0.375 points.

### Approval status
Implemented and verified. Committed to `main`.

### Rollback method
```bash
git revert <commit>
```
`fetchUsInflation` is unchanged and still present in `lib/fetchers/bls.ts`; reverting restores CPI with no other edit. Historical rows in `raw_indicators` written before this date retain their CPI-based values, so the pre-change series remains reconstructable — the stored `source_note` distinguishes them.

---

## 2026-08-31 — Compare page stops naming a leader between statistically inseparable markets

**Category:** Display rule. No score, equation or stored value changed.

### Old rule
The Compare page's "What stands out now" card always asserted `"<market> leads at <score>."`

### New rule
Markets within **1.0 composite points** of the top are reported as *level* rather than ranked: `"Euro Area and Japan are level at the top (79.2, 79.1) — too close to separate."` The same rule applies at the bottom.

### Reason
The Euro Area and Japan were separated by **0.06 points**. Naming a leader across a gap that small asserts a precision the methodology does not have.

### Reference
Working Charter §4 ("never invent a coefficient, target, threshold, neutral rate, weight or score and call it scientific") and §15 (bands "should not be invented merely for visual appeal"). OECD/JRC Handbook on Constructing Composite Indicators, on sensitivity analysis as a precondition for publishing normative weights.

### Data used
The sensitivity analysis run for the evidence audit: every market re-scored under **equal 20% pillar weights** — the neutral reference case named in charter §9.6 — holding the pillar scores themselves identical.

### Test results
Every composite moved by **less than one point**, yet **the top three reordered** (EA > JP > US became JP > US > EA), because they sat only 0.71 points apart. Japan additionally crossed from *Supportive* into *Strongly Supportive*. Across all 48 stored historical points, equal weighting changes the published band **8 times**.

The threshold is therefore derived, not chosen: **1.0 is the largest composite shift an equally defensible weighting choice produced, rounded up.** A gap smaller than that is not a gap the data supports naming a leader from.

### Impact
Headline text only. With current scores it reads *"Euro Area and Japan are level at the top (79.2, 79.1) — too close to separate."* and *"Australia is lowest at 74.0."* Charts, scores and stored data are untouched.

### Approval status
Implemented and verified. Committed to `main`.

### Rollback method
`git revert <commit>`, or set `LEVEL_TOLERANCE = 0` in `app/compare/ComparePageInner.tsx` to restore the previous always-rank behaviour.

---

## 2026-08-31 — Learn page publishes measured pillar influence alongside nominal weights

**Category:** Disclosure. No score, equation or stored value changed.

### Old rule
The Learn page published the five nominal pillar weights (25 / 25 / 18.75 / 18.75 / 12.5) as the complete account of how pillars combine.

### New rule
It additionally publishes each pillar's **measured effective influence**, with the date of measurement, and states plainly that External & Commodities cannot differentiate markets.

### Reason
A pillar's influence on a composite is its weight **times how much it varies**. Publishing only nominal weights described intent rather than behaviour, and in two places materially overstated it.

### Reference
OECD/JRC (2008), *Handbook on Constructing Composite Indicators* — nominal versus effective weight, and the requirement that normative weights be disclosed and sensitivity-tested. Working Charter §6, which already notes the current fifth pillar "is effectively driven by Brent-price change."

### Data used
MMAI's full stored panel: 48 market-years, six markets, 2019–2026. Effective influence computed as weight × pillar standard deviation, normalised to 100.

### Test results

| Pillar | Published weight | Measured influence |
|---|---|---|
| Price Stability | 25% | 30.6% |
| Growth Momentum | 25% | 29.4% |
| Labour Market | 18.75% | 15.8% |
| **Monetary Conditions** | **18.75%** | **9.2%** |
| **External & Commodities** | **12.5%** | **15.0%** |

Monetary Conditions operates at roughly half its published weight — policy rates change only a few times a year. External & Commodities operates *above* its published weight, and above Monetary Conditions.

Separately measured: External & Commodities has a cross-market standard deviation of **exactly 0.0000** — it uses one global Brent price, so every market receives an identical score. Removing it entirely leaves the ranking of all six markets **unchanged**.

### Impact
Disclosure only. Figures are stored in `PILLAR_EFFECTIVE_INFLUENCE` in `lib/scoring.ts` and are read by nothing in the scoring path.

### Approval status
Implemented and verified. Committed to `main`.

### Rollback method
`git revert <commit>`.

### Standing note
These figures are **observations about the current panel, not parameters**. They will drift as history accumulates and must be re-measured rather than trusted indefinitely. `PILLAR_INFLUENCE_MEASURED` carries the measurement date for exactly this reason.

---

## 2026-08-31 — Refresh no longer overwrites a published score with a failed fetch

**Category:** Data-integrity guard. No equation, weight, band or source changed.

### Old rule
Every refresh wrote its result unconditionally. If a source was briefly unavailable and coverage fell below the 0.70 publication gate, the market's stored score became `null` / *Not Publishable*, replacing a good reading.

### New rule
A run that produces **no publishable score at all** is skipped for that market when a publishable score already exists and is **less than 3 days old**. Nothing is written, the reason is logged, and the API response reports `skipped` for that market. The next run retries.

### Reason
Found the hard way, an hour after adding the `force` option. A forced re-run to pick up the US PCE change re-fetched all six markets; both Statistics Canada calls — inflation *and* unemployment, which share one source — failed together. Canada's coverage fell to 0.6 and a good **76.4952** was overwritten with *Not Publishable*.

Nothing about Canada's economy changed. A source was briefly unavailable, and the site showed a gap to every visitor until the next run.

The freshness guard added on 29 August prevents duplicate **work**. It does nothing about a re-run producing **worse data** — a risk that only exists because `?force=1` exists. This is the other half of it.

### Data used
Live incident, 31 August 2026:

| Run | CA inflation | CA unemployment | Coverage | Composite |
|---|---|---|---|---|
| 00:44 UTC | 3.03 | 6.4 | 1.00 | 76.4952 |
| 06:00 UTC (forced) | **null** | **null** | **0.60** | **null** |
| 06:01 UTC (forced retry) | 3.03 | 6.4 | 1.00 | 76.4952 |

### Test results
`npx tsc --noEmit` clean, `npx eslint` 0 errors, `npm run build` clean. The retry at 06:01 confirms the failure was transient — the same source answered normally 60 seconds later, which is precisely the case the guard is for.

### Impact
No effect on any current score. The guard is a no-op on every successful run. It changes behaviour only when a market would otherwise go unpublishable, which no market currently is.

**Deliberately narrow.** It fires only when a run yields *nothing publishable*. A market that loses one pillar while staying above the gate still writes, because that is a genuine change in what could be measured — and the existing pillar-shape signature already stops that faking a band-change email.

**Bounded** by `STALE_AFTER_DAYS = 3`, so a permanently dead source cannot freeze a stale score indefinitely. Past that window the gap *is* the truth and the site should show it.

### Approval status
Implemented and verified. Committed to `main`.

### Rollback method
`git revert <commit>`, or set `STALE_AFTER_DAYS = 0` to disable the guard while keeping the logging.

---

## 2026-08-31 — Inflation targets became per-market; Australia scored against 2.5%

**Category:** Parameter correction. The scoring *function* is unchanged; only the benchmark it measures against differs, and only where the issuing central bank differs.

### Old rule
`priceStabilityScore(inflation, target = 2.0)` applied **2.0% to all six markets**.

### New rule
`INFLATION_TARGET` in `lib/scoring.ts` holds each central bank's own stated benchmark. `computePillarScores` now takes a **required** `market` argument.

| Market | Target | Source, read 31 Aug 2026 |
|---|---|---|
| US | 2.0% | Federal Reserve — stated on the PCE index |
| EA | 2.0% | ECB — symmetric 2% medium-term, HICP |
| UK | 2.0% | Bank of England — *"The Government has set us a target of keeping inflation at 2%"* |
| CA | 2.0% | Bank of Canada — *"the 2% midpoint of the 1%–3% control range"* |
| JP | 2.0% | Bank of Japan — *"Price Stability Target" of 2 Percent* |
| **AU** | **2.5%** | Reserve Bank of Australia — see below |

### Reason
Australia is the only one of the six whose target is a **range**, not a point: *"Australia's inflation target is to keep annual consumer price inflation between 2 and 3 per cent."* It was being scored against 2.0% like everyone else, penalising it for inflation its own central bank considers on target.

**2.5% is not MMAI rounding that band to a convenient midpoint.** The RBA's own explainer states that *"the Statement on the Conduct of Monetary Policy specifies that the Reserve Bank sets monetary policy such that inflation is expected to return to the midpoint of the target."* The midpoint of 2–3% is 2.5%. This upgrades the Australian target from a **design choice** to a **sourced value** — the evidence audit had classified it as the former.

The RBA page also confirms Australia's target measure is **CPI**, so unlike the US, the *source* was already correct.

Charter §10 requires precisely this shape: *"common scoring function, economy-appropriate official measure and benchmark."*

### Data used
Each central bank's own page, read live on 31 August 2026. The RBA and Bank of England pages were unreachable via plain HTTP fetch (403) and were read through a browser instead.

### Test results
- `npx tsc --noEmit` clean; `npx eslint` on all ten touched files: **0 errors, 0 new warnings**.
- `npm run build` clean.
- `scripts/verify-scoring.ts` — all cases pass, values unchanged (none is Australia).
- `scripts/verify-history.ts` — all pass; it covers US/EA/CA only, so this is genuine isolation rather than a false pass.
- **Isolation check:** re-scoring every market's latest point shows all five non-AU composites identical to the decimal.

### Impact

| | Before | After | Change |
|---|---|---|---|
| AU Price Stability | 73.75 | 81.25 | +7.50 |
| **AU composite** | **73.54** | **75.42** | **+1.88** |

Across Australia's full stored history the change is **+1.88 in six years and −1.88 in two** (2019 and 2020), because inflation was *below* 2% then and is therefore further from a 2.5 midpoint than from a 2.0 point. **The correction cuts both ways**, which is what distinguishes it from a change tuned to flatter one market.

One band change across eight years: **2025, Supportive → Strongly Supportive**. Australia remains last of six on the current reading; no ranking changed.

### Note on the signature change
`market` was made **required**, not optional-with-default. An optional parameter would let a call site silently score Australia against 2.0 while the refresh route scored it against 2.5 — stored and displayed scores would then disagree, a class of bug this project has already hit. Making it required forced all 16 call sites to be visited by the compiler.

### Approval status
Implemented and verified. Committed to `main`.

### Rollback method
`git revert <commit>`. To keep the per-market structure but restore uniform 2.0, set `AU: 2.0` in `INFLATION_TARGET`.

---

## 2026-08-31 — Band thresholds recalibrated against 173 market-years

**Category:** Interpretation labels. **No score, equation, weight or source changed.**

### Old rule
`80 / 65 / 45 / 30` — invented, never researched.

### New rule
`85 / 74 / 55 / 40`, calibrated against ten named macroeconomic episodes.

### Reason
Charter §15: verbal bands "must themselves be researched and documented. They should not be invented merely for visual appeal." They had not been. Scored over the newly-built 1990–2018 panel, the old thresholds:

- put **63% of all 173 market-years into a single band**;
- **never once reached "Highly Challenging"** in 29 years — not in 2009;
- labelled the **United States in 2009, the worst year since the 1930s, "Balanced."**

That last point is the defect. A reader seeing "Balanced" during a global financial collapse would be badly misled, which is the one thing this project exists to avoid.

### Reference
Charter §15 (bands must be researched), §9.1 (cautions against percentile approaches), §13 (test across regimes including the GFC). Panel built by `research/build-historical-panel.ts` from World Bank, BIS and EIA.

### Data used
173 scored market-years, six markets, 1990–2018.

### Test results
Thresholds were required to classify **ten named episodes** the way an economist would. A pure-quantile scheme was run first as the baseline to beat and **failed at 3/10** — it labels US 2008 "Highly Challenging", which is wrong.

| Episode | Score | Old label | New label |
|---|---|---|---|
| UK 1990 recession | 30.5 | Challenging | **Highly Challenging** |
| Canada 1991 recession | 39.1 | Challenging | **Highly Challenging** |
| Japan 2009 | 45.8 | Balanced | **Challenging** |
| Euro Area 2009 | 47.7 | Balanced | **Challenging** |
| **US 2009** | 47.8 | **Balanced** | **Challenging** |
| US 2008 crisis onset | 63.4 | Balanced | Balanced |
| Australia 2009 | 74.7 | Supportive | Supportive |
| Australia 2012 mining peak | 87.4 | Strongly Supportive | Strongly Supportive |

**"Highly Challenging" goes from used 0 times in 173 years to 3.**

**Honest caveat, recorded deliberately:** an episode-anchored search satisfies 10/10 — precisely the result to distrust, since the search was built to maximise anchor hits. Uniqueness was therefore tested: **2,376 threshold sets satisfy all ten anchors.** The evidence **constrains** each threshold to a range rather than fixing a point — `40–45`, `48–59`, `64–74`, `85–87`. The chosen values sit inside those ranges, selected for the most even distribution and legible numbers.

**Three of the four old thresholds sat outside any defensible range.** Only the 65 survived, by coincidence rather than design.

`tsc`, `eslint`, `npm run build` clean. All three verification scripts pass.

### Impact
**Zero effect on any published score.** Verified: **none of the six current market labels changes** — all six sit in Supportive under both schemes.

One pinned test expectation changed: `verify-scoring.ts`'s Canada case, composite unchanged at 83.4, label moves Strongly Supportive → Supportive because that band now begins at 85. Intended, documented in the file.

### A rejected alternative, preserved per charter §4
Rescaling the composite so the historical floor mapped to 10 and the ceiling to 90 was proposed and **rejected**, for four reasons, any one sufficient:

1. **It is dynamic min-max, which charter §9.1 rejects by name** — twice.
2. **The entire scale would hang on one observation** (UK 1990). A single worse year would move the anchor and **retroactively change every score MMAI has ever published.**
3. **It breaks reproducibility by hand,** adding two magic numbers from a dataset readers do not have — trading away the project's strongest claim for a cosmetic gain.
4. **It adds two unsourced parameters,** moving the audit from 2-of-12 sourced to 2-of-14.

Full record in `research/rescale-demo.ts`.

### Approval status
Implemented and verified. Committed to `main`.

### Rollback method
`git revert <commit>`, or restore `80/65/45/30` in `BAND_LABELS`. No stored data depends on the thresholds — bands are computed at read time, so a revert is complete and immediate.

---

## 2026-09-01 — Minimum-pillar disclosure (audit finding H-1)

**Category:** Disclosure. **No score, equation, weight or band changed.**

### Old rule
None. The composite was published without reference to its weakest component.

### New rule
When the weakest pillar is **more than 40 points below the composite AND itself below 30**, the site states so beside the score.

### Reason
MMAI aggregates linearly, which is **fully compensatory**: a collapse in one pillar can be offset entirely by strength in the others, without limit. That is a property of the chosen aggregation, not a defect — but undisclosed, it lets the headline conceal a total failure.

Measured over 1990–2018, this is not hypothetical:

| | Weakest pillar | MMAI published |
|---|---|---|
| **Euro Area 2013** | **Labour Market = 0.0** | **59.9 — "Balanced"** |
| Japan 2009 | Growth = 0.0 | 45.8 |
| Australia 1990 | Monetary = 0.0 | 44.7 |
| Canada 1990 | Monetary = 0.0 | 43.8 |

Euro-area unemployment reached 12.02% in 2013, the pillar registered **exactly zero**, and the index reported *Balanced*.

### Reference
OECD/JRC Handbook — compensability is a decision requiring explicit justification. UNDP *Human Development Report 2010* — the HDI moved from arithmetic to geometric aggregation specifically to stop one weak dimension being masked. Munda & Nardo on non-compensatory aggregation.

### Data used
173 scored market-years, 1990–2018.

### Test results
Thresholds are calibrated, not chosen. A weak pillar is not itself the problem; a weak pillar the composite **conceals** is. The rule therefore measures the concealment directly — the gap between headline and worst component:

| Gap | Pillar floor | Fires | Catches all four total failures? |
|---|---|---|---|
| 30 | 40 | 33.5% | yes |
| **40** | **30** | **21.4%** | **yes** |
| 45 | 30 | 15.0% | **no** — misses Canada 1990 (gap 43.8) |

**40 is the loosest gap that still catches every case of a pillar at zero.** Calibration in `research/audit-floor-rule.ts`.

### Impact
**No published score changes.** Verified: **no current market triggers the notice** — every pillar across the six is well above 30 today. The rule is dormant until conditions genuinely warrant it.

### Approval status
Implemented and verified. Committed to `main`.

### Rollback method
`git revert <commit>`, or set `MASK_GAP_THRESHOLD = 999` to disable while keeping the function.

### Not done, deliberately
Changing to geometric aggregation would alter **21% of historical bands** and every published score. That needs its own evidence, comparison and decision; it is not bundled into a disclosure fix.

---

## 2026-09-01 — Source registry separates "working" from "current" (audit M-5)

**Category:** Disclosure. **No score, equation, weight or source changed.**

### Old rule
Every entry carried `status: "live"` and nothing else. A reader reasonably takes "live" to mean *current*.

### New rule
Each scored-market entry additionally declares a **publishing cadence**, shown beside the status: *LIVE · updates monthly*, *LIVE · updates annually*, *LIVE · updates per rate decision*.

### Reason
"Live" means the fetcher succeeded. It does not mean the figure is new. A World Bank annual series retrieved successfully today is **working, not current**, and both were reported with the same word. Measured against the database, "live" spanned figures 61 days old to **973 days** old.

### Data used
Cadence was **verified from each fetcher's own request**, not assumed:

| Source | Evidence |
|---|---|
| BEA PCE / GDP | `Frequency=M` / `Frequency=A` in the request |
| Eurostat GDP | dataset `tec00115` — annual |
| Eurostat unemployment | dataset `une_rt_m` — monthly |
| ABS CPI | series id ends `.M` |
| World Bank | annual by construction |

Result: 29 of 29 entries populated, with a script that **fails** rather than defaulting if any entry lacks a mapping.

### Test results
`tsc` clean, eslint zero, build clean.

**One bug caught during implementation.** `cadence` is optional on the shared display type, because the Gulf registry uses the same shape and does not carry it. The first version would therefore have rendered **"updates undefined"** on every Gulf row. Guarded before commit; verified no `undefined` string reaches the build output.

### Impact
Display only. Java­script cadence values are read by nothing in the scoring path.

### Approval status
Implemented and verified. Committed to `main`.

### Rollback method
`git revert <commit>`. Nothing depends on the field.

### Follow-up
The Gulf registry should carry cadence too — its staleness is far more material (UAE, Kuwait and Oman inflation at 607 days; three current-account figures at 973). Not done here to keep this change to one registry.

---

## 2026-09-01 — US and Euro Area GDP moved to quarterly, year-over-year

**Category:** Data freshness. **No equation, weight, band or threshold changed.**

### Old rule
Growth Momentum read an **annual** GDP figure for every market — BEA `Frequency=A` for the US, Eurostat `tec00115` for the euro area — stamped January of the following year.

### New rule
US and euro-area GDP are now **quarterly, year-over-year**. The other four remain annual World Bank, and are still year-over-year.

### Reason
Growth Momentum carries **25% of the score — its joint-largest weight — and was being fed a figure up to twenty months old.** The per-indicator observation dates added earlier the same day made this visible for the first time: every market's GDP was stamped January 2025.

Both replacements come from sources already in use and already licensed.

### The trap this had to avoid
BEA's widely-quoted quarterly growth rate is **annualised quarter-on-quarter** — a different quantity from year-over-year, and far more volatile (2025Q3: 4.4% annualised against 2.34% year-over-year). Eurostat offers both `CLV_PCH_PRE` (previous period) and `CLV_PCH_SM` (same period, previous year).

Taking "whatever quarterly number each source headlines" would have made the six markets **non-comparable while looking entirely reasonable** — the exact failure this project keeps finding.

**The rule adopted:** every market's Growth Momentum must be **year-over-year real GDP growth**. Frequency may differ between markets, and the stored observation date now discloses which is which, but the *concept* may not.

US year-over-year is therefore computed from quarterly real GDP **levels** (BEA table T10106, chained dollars) rather than taking BEA's headline rate. Euro area uses `CLV_PCH_SM`, not `CLV_PCH_PRE`.

### Test results

| | Value | Observation date |
|---|---|---|
| US, old | 2.1% | 2025-01-01 |
| **US, new** | **2.1%** | **2026-06-01** |
| EA, old | 1.2% | 2025-01-01 |
| **EA, new** | **1.0%** | **2026-06-01** |

Both fetchers tested standalone against the live APIs before wiring, per this project's rule. `tsc` clean, eslint zero, build clean, all three verification scripts pass.

### Impact

| Market | Before | After |
|---|---|---|
| United States | 77.21 | **77.21** (unchanged) |
| Euro Area | 79.19 | **78.69** |

The US value is coincidentally identical, so its score does not move at all — but the figure behind it is **seventeen months fresher**. No band changes; no ranking changes.

### Approval status
Implemented and verified. Committed to `main`.

### Rollback method
`git revert <commit>`. `fetchUsGdpGrowth` and `fetchEuroAreaGdpGrowth` are unchanged and still present.

### Remaining
Canada, the UK, Japan and Australia still take annual World Bank GDP. Each has a national quarterly source, and each needs its own fetcher. They stay **conceptually comparable** in the meantime because all six are year-over-year.

---

## 2026-09-01 — UK and Canada GDP moved to quarterly, year-over-year

**Category:** Data freshness. **No equation, weight, band or threshold changed.**

Extends the same-day US/Euro Area change to two more markets, on the identical rule: **year-over-year is mandatory; frequency may differ.**

| Market | Old (World Bank annual) | New | Source |
|---|---|---|---|
| United Kingdom | 1.39%, Jan 2025 | **0.9%, Mar 2026** | ONS series `IHYR` |
| Canada | 1.74%, Jan 2025 | **1.13%, Jun 2026** | StatCan vector `62305752` |

### Series selection — the part that matters
- **ONS `IHYR`** is titled by the ONS as *"q-on-q4 growth rate"* — growth against the quarter four quarters earlier, i.e. year-over-year. `IHYQ` (quarter-on-previous-quarter) was **deliberately rejected**: different quantity, would silently break comparability.
- **StatCan `62305752`** is quarterly real GDP in chained dollars — **levels**. Year-over-year is computed here. Statistics Canada's headline quarterly figure is annualised quarter-on-quarter and was **not** used, for the same reason.

Both fetchers guard against the source repointing: the ONS one throws if the series title stops saying `q-on-q4`, rather than silently scoring the UK on the wrong concept.

### Impact

| Market | Before | After |
|---|---|---|
| United Kingdom | 76.66 | **75.44** |
| Canada | 76.50 | **74.97** |

No band changes. Both fall because the older annual figures were flattering — 2024 growth was stronger than the most recent four quarters.

### Status of all six

| Market | GDP source | Frequency |
|---|---|---|
| United States | BEA T10106 | quarterly |
| Euro Area | Eurostat `namq_10_gdp` | quarterly |
| United Kingdom | ONS `IHYR` | quarterly |
| Canada | StatCan `62305752` | quarterly |
| Japan | World Bank | annual |
| Australia | World Bank | annual |

**Four of six now quarterly.** All six remain year-over-year, so they stay comparable.

### Remaining
- **Australia** — ABS publishes national accounts (`ANA_AGG`), but the series key was not identified in this session. Tractable, not done.
- **Japan** — no accessible quarterly source identified. The OECD route is already known unreliable from Vercel, and Japan's own e-Stat requires a registered key.
