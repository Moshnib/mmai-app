-- ============================================================
-- FISCAL RESILIENCE REPLACES EXTERNAL & COMMODITIES
-- Audit finding M-4 / recommendation 8. Run in the Supabase SQL Editor.
--
-- WHY: the old fifth pillar scored Brent crude -- a single global price.
-- The refresh route wrote the identical figure into all six markets, so
-- the pillar's cross-market standard deviation was exactly 0.0000. It
-- held 12.5% of the published weight and could not, arithmetically,
-- change the ranking of one country against another.
--
-- The replacement is BIS "credit to general government from all sectors
-- at market value" as a share of GDP -- one figure per country.
--
-- SAFE ON EXISTING ROWS. Every column added is nullable, and nothing is
-- dropped or rewritten.
-- ============================================================

-- ---- raw inputs ----
alter table raw_indicators
  add column if not exists debt_pct_gdp numeric,
  -- BIS publishes a QUARTER ("2025-Q4"), not a day. Stored as text, not
  -- coerced to a date: turning a quarter into 2025-12-31 would invent a
  -- precision the release does not have, which is exactly the mistake
  -- the per-indicator observation dates were added to stop.
  add column if not exists debt_observation_period text;

-- ---- computed scores ----
-- pillar_ec is deliberately KEPT and left in place. Rows written before
-- 2026-09-01 hold genuine External & Commodities scores, and those are
-- part of the record this project publishes for download. Renaming the
-- column would silently relabel two years of history as a pillar that
-- did not exist when those rows were written.
alter table mmai_scores
  add column if not exists pillar_fr numeric;

comment on column mmai_scores.pillar_ec is
  'RETIRED 2026-09-01. External & Commodities (Brent crude YoY). Rows before that date hold real values; nothing writes here now.';

comment on column mmai_scores.pillar_fr is
  'Fiscal Resilience. clamp(100 - 0.3 * max(0, debt % of GDP - 60), 0, 100). Replaced pillar_ec on 2026-09-01.';

comment on column raw_indicators.brent_yoy is
  'Still fetched and still displayed in the weekly feed, but NOT SCORED since 2026-09-01.';
