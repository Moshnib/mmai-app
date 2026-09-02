# MMAI Change Log

Required by §14 of the *Full Methodology, Research and Intellectual Property Working Charter* (30 August 2026), which specifies that every proposed change record **old rule, new rule, reason, reference, data used, test results, impact, approval status and rollback method**, and by §18, which lists a "change log from V1 to any approved successor" as a preserved research deliverable.

Entries are newest first. The frozen V1 record is in [`MMAI_V1_FROZEN_BENCHMARK.md`](MMAI_V1_FROZEN_BENCHMARK.md); it is a dated snapshot and is **not** edited by changes recorded here.

---

## 2026-09-02 — Observation-age checking: a source can no longer die quietly

**Category:** Control. No equation, weight, band, threshold or published score changed.

Closes **H-1** from the operational audit of 2 September 2026 — the finding that mattered more than the Euro Area failure it explained.

### Old rule

One staleness check existed in the entire project:

```
isStale = now − row.fetched_at > 72 hours
```

`fetched_at` records **when MMAI last asked**. Nothing anywhere compared a figure's own **observation date** against how old it ought to be.

### New rule

`lib/freshness.ts` compares every figure's observation date against how often its source actually publishes, using the `cadence` already recorded per source. Applied by the refresh route on every run, to every indicator, for every market.

| Cadence | Limit | Why |
|---|---:|---|
| daily | 10d | A long weekend plus a few days of outage |
| monthly | 100d | About three missed releases |
| quarterly | 240d | The ONS lags two quarters legitimately |
| annual | 800d | World Bank data runs 1–2 years behind by design |
| per decision | **not checked** | A rate that has not moved is not stale |

A source may override the default via `maxAgeDays`, and **an override without a `note` explaining it fails the test.**

### Reason

Eurostat retired the euro area HICP dataset on 4 February 2026. It never returned an error — it stopped gaining months, kept answering instantly, and kept handing back December 2025. Every check stayed green for nine months while MMAI published inflation as 2.0% against a real 3.3%, and the Euro Area was published **a full band too high**.

The information needed to catch it was already on the page: per-indicator observation dates shipped on 1 September for audit finding M-6. They **showed** a reader the figure was from December 2025. Nothing **tested** it.

### Why "per decision" is exempt

A policy rate is a **level that persists**. When a central bank holds rates for two years, the two-year-old decision is still the current rate — the figure is not stale, the world simply did not move. Japan held near zero for over a decade; an age check would have screamed every day while the data was perfectly correct.

Those sources fail loudly by another route: every policy-rate fetcher throws on a bad response rather than returning a previous value, so a dead one appears as a null pillar, not a stale number.

### Test results

`scripts/verify-freshness.ts`, now in CI. No network, no keys, no database — it tests the rules and asserts that **no scored source can fall outside them unnoticed**.

**It caught two false positives before this shipped, which is the point of writing the test first:**

1. **BIS government debt.** The BIS publishes credit statistics about three quarters in arrears, so 2025-Q4 was still the newest on 2 September — 245 days old against the 240-day quarterly default. Loosening *all* quarterly checks to accommodate the slowest source would have let a dead ONS series run for over a year, so the allowance was attached to the seven BIS rows instead (`maxAgeDays: 420`).
2. **UK unemployment.** Dated May 2026 and 124 days old against a 100-day monthly default. Verified directly against the ONS: series `MGSX` genuinely ends at 2026 MAY. The check was wrong, not the ONS. Allowance set to 170 on that row alone.

**Replayed against live data:** all six markets clean, `staleMarkets = 0`, workflow green. **Replayed against the pre-fix Euro Area:** `Inflation (YoY) is 275d old (limit 100d)` — caught.

Had this existed, the Eurostat failure would have fired on **12 March 2026** rather than being found by hand on 2 September — **175 days earlier.**

`tsc`, `eslint --max-warnings 0`, `build` and all five verification scripts clean.

### Failing is the feature

The refresh workflow now **fails the run** when any market reports a stale figure. The data is already written by then and nothing is rolled back — failing exists to make a human look. A warning in a log nobody reads is precisely what let this happen; a red run sends an email.

The limits are deliberately generous — roughly two to three missed publications each. **An alarm that cries wolf gets muted**, and a muted alarm is worse than none, because it is mistaken for coverage.

### Also corrected

**Six rows on the public Sources page still carried the World Bank's note and link** after their fetchers moved to national quarterly sources on 1 September: Euro Area, Canada, UK, Japan (×2) and Australia. Each said *"Annual figure, updates once a year"* and four linked to `data.worldbank.org`. On the one page whose entire purpose is letting a reader check the work, they sent them to the wrong institution. Replaced with the actual series identifiers and the institutions' own pages.

### Approval status

Implemented and verified. No published score changed.

### Rollback method

```bash
git revert <commit>
```

Reverting removes the check. Nothing depends on it to compute a score.

---

## 2026-09-02 — Euro Area inflation moved from Eurostat to the ECB after the Eurostat series was found dead

**Category:** Data source replacement, forced by an upstream discontinuation. No equation, weight, band or threshold was modified.

Found by the operational audit of 2 September 2026, not by any automated check — which is itself the more important finding, recorded below.

### Old rule

Euro Area Price Stability read Eurostat `prc_hicp_manr` (`geo=EA`, `coicop=CP00`, `unit=RCH_A`) and scored it against the ECB's 2% target.

### New rule

Euro Area Price Stability reads the **ECB Data Portal**, dataflow `HICP`, series `M.U2.N.000000.4D0.ANR` — euro area, all items, annual rate of change — against the same 2% target. The fetcher now **throws if the newest observation is more than 100 days old.**

### Reason

**The Eurostat series had been dead for nine months and MMAI could not tell.**

Eurostat retired `prc_hicp_manr` on **4 February 2026**, when the euro area HICP underwent a methodology change. The ECB's matching `ICP` dataflow was discontinued the same day; the ECB's own commentary attached to the final observations says so.

Neither began returning errors. They simply stopped gaining new months. The fetcher asked for the newest observation, was handed **December 2025**, and returned success — every morning, for nine months.

### Data used

Verified live on 2026-09-02:

| Query | Newest observation |
|---|---|
| Eurostat `prc_hicp_manr`, `geo=EA` | 2025-12 |
| Eurostat, `geo=EA19` / `EA20` | 2025-12 |
| Eurostat, `sinceTimePeriod=2026-01` | **empty set** |
| ECB `ICP` (old dataflow) | 2025-12 |
| **ECB `HICP` (replacement)** | **2026-08 → 3.3%** |

**The key changed shape, not just name:** the data-provider dimension went from `4` to `4D0`. The old key still resolves against the old dataflow and still returns 2025 data, so a half-migration looks like it works.

### Impact

| Euro Area | Published (wrong) | Correct |
|---|---:|---:|
| Inflation | 2.0% (Dec 2025) | **3.3%** (Aug 2026) |
| Price Stability | 100.0 | 80.5 |

Price Stability carries 25% of the score, so the composite effect is **−4.87**:

| Shipped as… | Composite | Band |
|---|---:|---|
| Live today | 78.70 | Supportive |
| Inflation fix alone | 73.83 | **Balanced** |
| **With Fiscal Resilience, same deploy** | **75.57** | **Supportive** |

**MMAI published the Euro Area as "Supportive" while the correct verdict was "Balanced".** This is the first known instance of a wrong published band traced to a source failure rather than a methodology choice.

**Deploy both changes together.** Alone, the inflation correction moves the Euro Area down a band; combined with Fiscal Resilience — which removes the retired oil pillar that was docking every market for oil being up 17.9% — no market changes band. Shipping them separately would move the Euro Area twice in a week for reasons unconnected to the euro area.

### Test results

- Standalone fetcher test against the live ECB API **before wiring**, per this project's rule that no fetcher is wired unproven: returned 3.3% for 2026-08, 32 days old.
- **The new maximum-age guard was tested against the dead series**, not merely written: pointed at the retired `ICP` dataflow it fires (275 days), pointed at the replacement it passes (32 days).
- End-to-end recomputation from live sources: Euro Area PS 80.5 · GM 60.0 · LM 56.0 · MC 98.1 · FR 92.4 → **75.57, Supportive**, coverage 100%.
- `npx tsc --noEmit`, `npx eslint . --max-warnings 0`, and all four verification scripts clean.

### The guard, and why it throws rather than warns

`settle()` turns a throw into a null, so the row is written **PARTIAL** with a note and the score is withheld under the coverage gate rather than published from a dead source. **A confident wrong number is worse than a visible gap** — that is exactly the failure this change is correcting.

100 days is deliberately generous: the longest normal gap between HICP releases is about seven weeks, so a genuinely late publication passes, while a source that has stopped entirely is caught inside a quarter instead of after a year.

### This guard covers one fetcher. The gap is system-wide.

The only staleness check anywhere in MMAI measures `fetched_at` — **when we last asked**, not the age of what came back. A frozen source answers instantly every morning and reads as perfectly live. The per-indicator observation dates added for audit M-6 *display* the age to a reader; nothing *tests* it.

Fourteen other live series could fail the same way tomorrow. **An observation-age check across every indicator, in CI, remains open** and is the highest-value item outstanding.

### Also corrected in the same change

- **Four of seven source notes credited the wrong institution.** `SOURCE_NOTES` named the World Bank for Canada, the UK, Australia and Japan; those read Statistics Canada, the ONS, the ABS and e-Stat respectively. The World Bank is now used only as Japan's unemployment fallback and for dormant Norway. These strings are stored on every row and shown to readers as provenance, so this was a false statement about where each number came from — and it made the data look *older* than it is, since the World Bank publishes annually.
- **Brent's cadence was labelled `daily`; the EIA series it reads is monthly** and the stored reading is routinely two months old. The `cadence` field was added on 1 September for audit finding M-5 specifically to stop "live" being read as "current", and its most visible entry was wrong in exactly that direction. MMAI has no daily-updating input at all.
- `fetchEuroAreaInflation` was **deleted** from `lib/fetchers/eurostat.ts`, not deprecated, and replaced with a comment explaining the retirement. A function left exported "just in case" is one somebody imports by autocomplete.

### Approval status

Implemented and verified. Not yet deployed — must ship together with the Fiscal Resilience change, which requires its migration to run first.

### Rollback method

```bash
git revert <commit>
```

Reverting restores the Eurostat call, which will resume publishing a December 2025 figure. **Do not revert this to fix an unrelated problem.**

---

## 2026-09-01 — Fiscal Resilience replaces External & Commodities as the fifth pillar

**Category:** Pillar replacement. New indicator, new equation, new data source. Weights, bands, coverage rule and the other four pillars are unchanged.

Closes audit finding **M-4** and **recommendation 8**, the second of the two findings left open after 1 September's first round of remediation.

### Old rule

```
S_EC = clip(100 − 1.2 × |Brent crude, YoY % change|, 0, 100)      weight 0.125
```

Brent crude year-over-year from the U.S. Energy Information Administration.

### New rule

```
S_FR = clip(100 − 0.3 × max(0, debt% of GDP − 60), 0, 100)        weight 0.125
```

Credit to general government from all sectors at market value, as a share of GDP, from the Bank for International Settlements (dataflow `WS_TC`, quarterly). The pillar key was renamed `EC` → `FR` deliberately, to force the compiler through all seventeen call sites rather than let a redefined `EC` pass silently.

### Reason

**The old pillar was arithmetically incapable of doing the job a pillar exists to do.**

Brent is a *single global price*. `app/api/refresh/route.ts` fetched one figure and wrote it, unchanged, into all six market rows — verified in the live database on 1 September 2026, where every market carried `brent_yoy = 17.91`. Its cross-market standard deviation was therefore **exactly 0.0000**, not approximately. It held 12.5% of the published weight, contributed an identical 9.81 points to every composite, and could never make one country rank above another.

Two further problems, both visible once the data was examined:

1. **It scored absolute change, so a crash and a boom counted the same.** Oil fell 34% in 2020 and rose 69% in 2021; the pillar read the 2021 recovery as instability worth 17.2/100 and dragged all three re-pinned markets down together by roughly 8 points in a year when their actual positions were diverging.
2. **Its published "effective influence" figure flattered it.** The Learn page reported External & Commodities at 15.0% — third of five, more than its weight. That figure blends variation over time with variation across markets, and all 15.0% of it was the former. The metric that would have exposed the defect did not exist, so the site published a number that made a decorative pillar look like a working one.

Government debt was chosen because it is genuinely market-specific, already licensed, and already fetched: `lib/fetchers/bis.ts` shipped on 29 August for the Compare page, so no new source, licence review or key was required.

### Reference

- OECD / JRC (2008), *Handbook on Constructing Composite Indicators*, §on weighting and aggregation — a component that does not vary across units under comparison contributes nothing to the comparison.
- **Treaty on the Functioning of the European Union, Protocol No 12, Article 1** — the 60% of GDP reference value. Chosen because it is a *published* threshold that already governs six of the scored economies through the euro area, not because 60% is where debt becomes dangerous. No such universal level exists in the literature, and asserting one would repeat the error corrected in H-2.
- BIS Statistical Terms — unrestricted use with citation; commercial use permitted provided it results in no additional charge to subscribers.
- MMAI Independent Audit, finding M-4 and recommendation 8.

### Data used

BIS `WS_TC`, key `Q.{area}.G.A.M.770.A`, fetched live 1 September 2026. Latest observation 2025-Q4 for all six:

| Market | Debt % GDP | Old EC score | New FR score |
|---|---:|---:|---:|
| Japan | 178.8 | 78.5 | 64.4 |
| United States | 111.0 | 78.5 | 84.7 |
| Canada | 96.1 | 78.5 | 89.2 |
| United Kingdom | 88.8 | 78.5 | 91.4 |
| Euro Area | 85.3 | 78.5 | 92.4 |
| Australia | 50.7 | 78.5 | 100.0 |

Seven years of Q4 history (2019–2025) were fetched for all seven markets including dormant Norway and written into `lib/history.ts` — **56 sourced points, none estimated.** That file's own header records that a previous gap was "deliberately left unfilled rather than fabricated"; the same standard applies here.

### Slope selection, and why it is gentle

The 60% reference is published. **The slope is not — it is a choice, and it decides Japan's rank.** Sensitivity across the full range, live snapshot:

| Slope | Zero at | Ranking |
|---|---|---|
| 0.30 | 393% | **AU > JP > EA > US > UK > CA** ← adopted |
| 0.45 | 282% | AU > EA > JP > US > UK > CA |
| 0.60 | 227% | AU > EA > JP > US > UK > CA |
| 0.80 | 185% | AU > EA > UK > US > JP > CA |
| 1.00 | 160% | AU > EA > UK > US > JP > CA |

Australia ranks first and Canada last under **every** slope tested; only Japan's position moves. 0.30 was adopted on the site owner's decision, for a reason that is economic rather than cosmetic: Japan's debt is overwhelmingly held domestically, in its own currency, at near-zero rates, which is a materially different condition from the same ratio elsewhere. A steep slope would let one indicator decide the headline ranking and would apply a single threshold across six economies — precisely the error H-2 corrected.

### Test results

- **Standalone fetcher test against the live BIS API before wiring**, per this project's rule that no fetcher is wired unproven. All seven markets returned 2025-Q4.
- `npx tsc --noEmit` clean; `npx eslint . --max-warnings 0` clean; `npm run build` clean.
- `verify-scoring`, `verify-history`, `verify-published-formulas`, `measure-pillar-influence` all pass.
- **`scripts/measure-pillar-influence.ts` is new and now runs in CI.** It recomputes both published influence figures from the panel and fails if `lib/scoring.ts` disagrees. It caught four wrong values on its first run — placeholders written before the panel was measured.
- **The formula verifier's sweep was too narrow to test this pillar and was widened.** It sampled −40 to 40, which never reaches a government debt ratio: every sampled value sat below the 60% threshold, so Fiscal Resilience would have been reported as verified without the sweep once touching its slope. Raised to 260. 36,042 comparisons pass.

### Impact

Live snapshot, six markets:

| Market | Before | After | Change |
|---|---:|---:|---:|
| Australia | 81.02 | **83.71** | +2.69 |
| Japan | 83.76 | 81.99 | −1.77 |
| Euro Area | 78.70 | 80.44 | +1.74 |
| United States | 78.36 | 79.13 | +0.77 |
| United Kingdom | 76.56 | 78.17 | +1.61 |
| Canada | 72.13 | 73.46 | +1.33 |

- **The ranking changes: Australia replaces Japan at the top.** Japan falls to second, by 1.77 points. This is the intended effect — Japan's fiscal position is the single most distinctive macro fact about Japan and the index previously could not see it at all.
- **Five of six markets rise**, because the old pillar was scoring an oil price up 17.9% year-over-year and penalising all six for it. Only Japan falls. This is not the index becoming more generous: it is one indicator's noise being removed from six scores at once.
- **No band changed** for any market. Canada remains *Balanced*, the other five *Supportive*.
- Cross-market spread of the fifth pillar: **0.0000 → 11.10**.
- Measured effective influence of the fifth pillar **falls**, 15.0% → 9.0%, below its 12.5% weight. That is not a regression: the old figure was time variance from a global price, the new one is variance that separates countries.
- Eighteen pinned historical composites moved and were re-pinned. Every year rose; 2021 rose most, by roughly 8 points for all three markets at once, which is the clearest available demonstration of what the old pillar was doing.

### Also corrected in the same change

- **A false statement was live on the Learn page.** It still told readers "Monetary Conditions measures the policy rate against an assumed neutral level of 2.5% everywhere" and that "no published estimate exists for the UK, Japan or Australia". Both stopped being true when H-2 closed earlier the same day. Replaced with the real remaining limitation: Australia's neutral rate is nine years old.
- **A block of Learn-page copy could never render.** `targetNote` was nested inside the `targets` conditional, so a section with a note but no per-market target table displayed nothing — the new Government Debt and Brent explanations were written, compiled, linted, built and shown to nobody. Same shape of bug as the limitations block on 31 August, found the same way: by opening the page.
- **Two Supabase queries omitted the new column**, so `weeklyChanges.ts` and `useLiveHistory.ts` computed four-pillar composites that disagreed with the homepage rings. Passed `tsc`, `eslint` and `build`; caught by reading the rendered page and noticing US showed 80.4 in one place and 78.3 in another.
- `lib/sources.ts`: `pillar` became optional. Brent is still fetched and still shown in the weekly feed but scores nothing, and neither deleting a source the app uses nor filing it under a pillar it does not feed would have been honest.

### Approval status

Slope selected by the site owner from four costed options. Implemented and verified.

**Requires a schema migration before deploy** — `supabase/migrations/2026-09-01-fiscal-resilience-pillar.sql`. The refresh route inserts `debt_pct_gdp` and `pillar_fr`; if those columns do not exist the whole insert fails for every market. `mmai_scores.pillar_ec` is deliberately kept, not renamed: rows written before this date hold genuine External & Commodities scores and are part of the downloadable record.

### Rollback method

```bash
git revert <commit>
```

The migration does not need reverting — every column it adds is nullable and nothing was dropped or rewritten. Reverting the code stops writing to the new columns and restores the Brent equation; historical `pillar_ec` values were never touched.

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

---

## 2026-09-01 — Observation dates shown to readers (audit M-6, second half)

**Category:** Disclosure. **No score, equation, weight or band changed.**

### Old rule
The per-indicator observation dates were stored earlier the same day but shown nowhere. Collected and invisible.

### New rule
Each pillar card on the homepage carries the period its figure refers to — *"data from Jun 2026"*, *"data from Jan 2025"*.

### Reason
The point of M-6 was never the storage; it was that a reader could not tell how old any figure was. Until today only **Gulf Watch — the unscored half of the site — showed this.** The scored half, which is what the index is actually for, did not.

Growth Momentum is the case that matters: it carries **25% of the score**, the joint-largest weight, and for Japan and Australia the figure is still from January 2025.

### Test results
`tsc` clean, eslint zero, build clean.

### Impact
Display only. `observationDates` is optional on `MarketData` and is populated only from live data — the hardcoded fallbacks have no meaningful observation date and deliberately leave it undefined, so demo mode shows nothing rather than a fabricated date.

External & Commodities shows no date: it is a single global Brent figure, identical for every market, and its period is not market-specific.

### Approval status
Implemented and verified. Committed to `main`.

### Rollback method
`git revert <commit>`. The stored columns are unaffected.

---

## 2026-09-01 — Japan's unemployment is current again (one word)

**Category:** Data freshness / bug fix. **No equation, weight, band or threshold changed.**

### Old rule
`fetchJapanUnemployment` requested OECD with `format=csvfilewithlabels` and an 8-second timeout. It **timed out on every run**, so Japan silently fell through to a World Bank **annual** fallback — unemployment of 2.451% dated **January 2025**.

### New rule
Same dataflow, same key, `format=csvfile`. Japan now scores on **2.5%, June 2026**.

### Reason — the diagnosis was wrong for a week
This was recorded as *"OECD works locally and from GitHub, fails from Vercel"* and treated as a network block. **It was not.** It was latency:

| Request | Response time |
|---|---|
| `csvfilewithlabels` | **11–40 seconds** (measured over repeated calls) |
| `csvfile` | **0.08–2.0 seconds** |

`withlabels` makes OECD expand every code in a 16-column dataflow into a human-readable label. The 8-second timeout then aborted it every time. Vercel Hobby caps functions at 10 seconds, so **raising the timeout could never have worked** — the fix had to make the request fast, not wait longer.

**The parser selects columns by header name, so it never needed the labels at all.**

### Test results
Live fetch after the change: **684 ms**, returning 2.5% for 2026-06. `tsc` clean, eslint zero, build clean, all verification scripts pass.

### Impact
| | Before | After |
|---|---|---|
| Japan unemployment | 2.451%, **Jan 2025** | 2.5%, **Jun 2026** |
| Japan Labour Market pillar | 95.49 | 95.00 |
| Japan composite | 79.13 | ≈ 79.04 |

Tiny value change; the point is the **seventeen-month** gain in currency, and that the World Bank fallback stops firing.

### Wider lesson
This was found only because per-indicator observation dates were shipped hours earlier, making "Jan 2025" visible on Japan's card. **The disclosure fix found the data bug.**

Two of Japan's three stale figures remain: inflation and GDP.

---

## 2026-09-01 — Australia GDP moved to quarterly, year-over-year

**Category:** Data freshness. **No equation, weight, band or threshold changed.**

Completes the quarterly-GDP work for five of six markets.

| | Old (World Bank annual) | New (ABS) |
|---|---|---|
| Value | 1.35% | **2.52%** |
| Date | Jan 2025 | **Mar 2026** |

### Series
ABS `ANA_AGG` key `M1.GPM.20.AUS.Q` — chain volume measures, gross domestic product, seasonally adjusted, Australia, quarterly. **Levels**, so year-over-year is computed here.

The ABS also publishes MEASURE `M4`, "Current prices – Percentage Changes". **Not used:** current prices is *nominal*, and would not be comparable with the real growth every other market uses.

`format=csvfile`, not `csvfilewithlabels` — the label expansion is what made the OECD Japan fetcher time out. Columns are selected by header name, so labels are never needed.

### Impact
**Australia: 75.85 → 78.77.** No band change, but Australia moves from 4th to 3rd.

The old annual figure was badly understating Australia: **1.35% against an actual 2.52%.** Where the UK and Canada fell on fresher data, Australia rises — which is the point. The direction was never predictable; it was simply unknown.

### Status of all six

| Market | GDP source | Frequency |
|---|---|---|
| United States | BEA `T10106` | quarterly |
| Euro Area | Eurostat `namq_10_gdp` | quarterly |
| United Kingdom | ONS `IHYR` | quarterly |
| Canada | StatCan `62305752` | quarterly |
| **Australia** | **ABS `ANA_AGG`** | **quarterly** |
| Japan | World Bank | **annual — still Jan 2025** |

**Five of six.** All six remain year-over-year.

### Japan remains the exception, and it is a genuine source gap
Investigated directly this session:
- **OECD CPI for Japan ends June 2021.** `NoRecordsFound` for 2026 on any methodology.
- **e-Stat** (Japan's official portal) returns *"authentication failed — check application ID"*: it needs a free registered key, which only the site owner can obtain.

Japan's unemployment was fixed separately today. Its inflation and GDP remain annual, and the observation dates on its card say so.

---

## 2026-09-01 — CORRECTION: the Japan/OECD fix did not work

**Correcting the entry above titled "Japan's unemployment is current again (one word)".**

The `csvfile` change is real and worth keeping — it is **40× faster** and returns the same data — but **it did not fix Japan.** After deploying it and forcing a refresh, Japan still fell back:

```
source_note: "... — JP unemployment via World Bank annual (OECD unavailable)"
unemployment: 2.451,  observation date: 2025-01-01
```

The deploy definitely landed: the Australia GDP fetcher shipped in the same window and worked on that run.

### What I got wrong
I measured OECD at 11–40s with `csvfilewithlabels`, found `csvfile` at 0.1s, and concluded the 8-second timeout was the cause. **The latency was real and is now fixed. It was not the reason Japan fails from Vercel.**

The original diagnosis — *"OECD works locally and from GitHub, fails from Vercel"* — appears to have been right after all. From this machine the request completes in 1.9–3.7 seconds, comfortably inside the timeout, and it still fails in production. That points to OECD refusing or throttling Vercel's egress rather than to slowness.

### What stands
- The `csvfile` change is **kept**: strictly faster, identical data, and it removes latency as a confounding variable for any future attempt.
- **Japan's unemployment remains on the World Bank annual fallback, dated January 2025.** The observation date on Japan's card says so.
- The fallback itself is working exactly as designed — Japan publishes rather than failing.

### What would actually fix it
Fetching OECD from the **GitHub Actions runner**, which can reach it, and writing to Supabase directly — rather than routing the request through a Vercel function. That is an architectural change, not a parameter change, and is not being made on the strength of one afternoon's diagnosis.

---

## 2026-09-01 — Japan's inflation is current: e-Stat replaces a 20-month-old figure

**Category:** Data freshness. **No equation, weight, band or threshold changed.**

### Old rule
Japan's Price Stability read a World Bank **annual** CPI figure of **3.17%**, dated **January 2025**.

### New rule
Japan reads monthly CPI from **e-Stat**, Japan's official statistics portal: **2.0%, July 2026**.

### Reason
Japan sat at the top of the table on three figures from twenty months earlier. Every other route was verified closed first:
- **OECD's Japanese CPI series ends June 2021** — `NoRecordsFound` for 2026 on any methodology value.
- **Statistics Bureau's English pages** link back to e-Stat rather than publishing a machine-readable file.

e-Stat requires a free registered application ID, which is why this was blocked until the site owner obtained one.

### The query, and why each part
```
statsDataId=0003427113   2020-base Consumer Price Index, table 1
cdTab=3                  前年同月比 — change from same month, previous year
cdCat01=0001             総合 — All items (headline, not core)
cdArea=00000             全国 — All Japan (not the Tokyo ku-area series)
```

`cdTab=3` is the critical one. e-Stat also offers `tab=1` (index **level**) and `tab=2` (mixed month/year comparisons). **Only `tab=3` is year-over-year** — the same concept rule that governs the GDP fetchers.

`cdArea=00000` matters too: the Tokyo ku-area series publishes earlier each month and covers a different population.

### Test results
Live fetch: **2,593 ms**, returning 2.0% for 2026-07. `tsc` clean, eslint zero, build clean, all three verification scripts pass.

### Impact

| | Before | After |
|---|---|---|
| Japan inflation | 3.17%, Jan 2025 | **2.0%, Jul 2026** |
| Japan Price Stability | 82.41 | **100.00** |
| **Japan composite** | **79.13** | **83.52** |

**Japan's inflation is now exactly at the Bank of Japan's 2% target**, so Price Stability scores a perfect 100. The old figure overstated Japanese inflation by more than a full percentage point.

No band change — Japan remains *Supportive* — but it moves clearly to the top of the table rather than being level with the Euro Area.

### What remains for Japan
- **GDP** — still World Bank annual, Jan 2025.
- **Unemployment** — still the World Bank fallback, because OECD is unreachable from Vercel (see the correction entry above).

Two of Japan's four indicators are now current. The observation dates on its card show which.

---

## 2026-09-01 — Remaining audit items closed (M-2, M-3, M-5 Gulf, L-2, L-3)

**Category:** Disclosure and hygiene. **No score, equation, weight or band changed.**

Clears the last of the audit findings that did not require a decision.

### M-2 and M-3 — two limitations now stated on the Learn page
- **"Full employment is treated as the same number everywhere."** The Labour Market pillar scores unemployment against a single 2% benchmark for all six markets, though equilibrium unemployment differs. The page also explains why using per-country estimates would trade one problem for another: those estimates are uncertain and frequently revised.
- **"Inflation above and below target are treated the same."** MMAI subtracts equally either side, where the US framework is explicitly asymmetric and the effective lower bound makes undershooting harder to fix. It also notes the penalty is linear where the literature generally treats large misses as disproportionately worse.

### M-5 (Gulf half) — cadence added to all 21 live Gulf entries
Assigned **by rule, not entry-by-entry guesswork**:

| Institution | Cadence |
|---|---|
| World Bank | annual |
| BIS | daily |
| National sources (`data.gov.bh`, `data.gov.qa`, Data Saudi, Ministry of Justice) | monthly |

The rule matches observed staleness exactly: Saudi and Bahrain inflation at 61 days are monthly national sources; UAE, Kuwait and Oman at **607 days** are World Bank annual.

**Cadence is what the publisher should produce; the observation date is what we actually have.** Both together are honest; neither alone is.

### L-2 — bond panel shows each market's history depth
Every card now states *"N trading days of history"*. Japan began 2026-08-03 and Australia 2025-08-29 — **19 days against 251** — and one shared chart hid that completely.

### L-3 — Norway marked dormant rather than deleted
Norway is wired end to end (fetchers, a refresh branch, four source entries) but is not in `FALLBACK_MARKETS`, so it renders nowhere and **no false claim reaches a reader**.

Deleting it would touch eight files for a low-severity finding. Instead its status moved from `"live"` to `"manual"` with a `DORMANT` note, so **the data stops asserting something untrue**: if someone later widens the market list, Norway cannot silently appear as live.

### Test results
`tsc` clean, eslint zero, build clean, all three verification scripts pass. The Learn page additions were verified present in the **build output**, not just assumed from a green build.

---

## 2026-09-01 — Japan GDP quarterly: all six markets now on current GDP

**Category:** Data freshness. **No equation, weight, band or threshold changed.**

### Old rule
Japan's Growth Momentum read a World Bank **annual** figure of **1.19%**, dated **January 2025** — the last badly stale input in the index.

### New rule
e-Stat table **`0003109750`** — 四半期別GDP速報, 国内総生産（支出側）, 実質季節調整系列, 2020 base. Real, seasonally adjusted, quarterly **levels**; year-over-year computed here. **0.55%, June 2026.**

### Finding the table
The obvious candidates were traps. Searching returned 16,000+ tables under the Cabinet Office code, and the first matches were **過去の値** (archive) and **名目** (nominal) — one of which, `0003365113`, looks plausible but is nominal and its series ended years ago.

The working table was found by filtering for 実質季節調整系列 and **excluding archives**, which left exactly two candidates, both updated 2026-08-17.

### Why seasonally adjusted
e-Stat also publishes 原系列 (original, unadjusted). Seasonally adjusted was chosen because **every other market already uses one**:

| Market | Series |
|---|---|
| US | BEA `T10106` — seasonally adjusted |
| Euro Area | Eurostat `s_adj=SCA` |
| UK | ONS `IHYR` — CVM SA |
| Canada | StatCan `62305752` |
| Australia | ABS `TSEST=20` |

Consistency across the six matters more than the small difference between the two Japanese variants — the same rule that governs which growth *concept* each market uses.

### Impact

| | Before | After |
|---|---|---|
| Japan GDP | 1.19%, Jan 2025 | **0.55%, Jun 2026** |
| Japan Growth Momentum | 61.93 | **55.50** |
| **Japan composite** | **83.52** | **81.92** |

Japan's growth has slowed materially; the annual figure was overstating it by more than half a point. No band change; Japan remains top.

### Milestone
**All six markets now use quarterly, year-over-year GDP.** Growth Momentum — 25% of the score and its joint-largest weight — was running on figures up to twenty months old across the entire index this morning.

### What remains stale
**Japan's unemployment only**, still on the World Bank annual fallback because OECD is unreachable from Vercel. Fixing it needs the pipeline change (fetch from GitHub Actions, write to Supabase directly), not another fetcher.

---

## 2026-09-01 — Japan's unemployment fixed via a workflow relay

**Category:** Pipeline change. **No equation, weight, band or threshold changed.**

### Old rule
`/api/refresh` called OECD directly from Vercel. It failed every time, so Japan fell back to a World Bank **annual** figure dated **January 2025** — the last stale input in the index.

### New rule
The **GitHub Actions runner** fetches Japan's unemployment from OECD and relays it to the refresh route as a parameter. The route validates it and uses it in preference to the World Bank fallback.

### Reason
OECD is reachable from the Actions runner and from a laptop (~2s), and **not** from Vercel. This was misdiagnosed earlier today as a timeout; correcting the request to `format=csvfile` made it 40× faster and it still failed in production, which is what established that Vercel's egress is the problem rather than latency.

### Design choices worth stating
**It relays to the route rather than writing to Supabase directly.** Writing from Actions would require the **service-role key** as a GitHub secret, widening this workflow's blast radius considerably for the sake of one indicator. The relay needs no new credential.

**The OECD step is `continue-on-error`.** A failure there must not stop the refresh; the route simply falls back exactly as it does today.

**The value is validated, not trusted.** It arrives as a URL parameter, so the route range-checks it:
- must be a finite number in `(0, 30]` — Japan's unemployment has not left roughly 2–6% in decades
- date must match `YYYY-MM-DD`, not be in the future, and not be older than two years

Anything else is **rejected and logged**, and the fallback runs. The endpoint is already behind `CRON_SECRET`, so the trust boundary is unchanged — but a value that lands in a published score deserves a range check regardless.

**Preference order:** this app's own OECD call → the relay → World Bank annual. The first is kept in case OECD ever becomes reachable from Vercel.

**The path is recorded.** When the relay is used, the stored row's `source_note` says so — the same discipline already applied to the World Bank fallback.

### Test results
`tsc` clean, eslint zero, build clean, verification scripts pass. The workflow's `awk` parse selects columns **by header name**, matching `lib/fetchers/oecd.ts` — the dataflow carries 16 columns and OECD reorders them.

### Expected impact
Japan unemployment **2.451% (Jan 2025) → ~2.5% (Jun 2026)**. A negligible value change; the point is currency, and that **no input in the index will be older than June 2026**.
