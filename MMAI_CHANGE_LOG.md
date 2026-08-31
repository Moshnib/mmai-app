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
