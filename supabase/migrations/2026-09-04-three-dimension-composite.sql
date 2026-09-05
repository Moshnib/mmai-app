-- ============================================================
--  THREE-DIMENSION COMPOSITE — new columns for the replacement engine.
--
--  ADDITIVE ONLY. Nothing is dropped, nothing is rewritten. The five
--  pillar columns keep every value they hold, because mmai_scores exists
--  precisely so that revising a formula never silently rewrites history.
--  Old rows stay formula_version 'v1.0' and remain readable and correct
--  for what they were.
--
--  WHY composite IS LEFT NULL ON v2 ROWS. The old composite and the new
--  percentile both run 0-100, so writing the percentile into `composite`
--  would make any page that has not been migrated quietly show a new
--  number in place of the old one — a silent switch, at whatever moment
--  the first v2 row landed. Leaving it null makes an unmigrated page fail
--  visibly instead. The switch should be a deployment, not an accident.
--
--  Run this in the Supabase SQL editor BEFORE deploying the new engine.
--  Writing to a column that does not exist fails the whole insert, which
--  would take the daily refresh down.
-- ============================================================

alter table mmai_scores
  -- The three standardised dimension scores, C' D' K'. Published beside
  -- the composite, not instead of it: equal thirds is a convention the
  -- ranking is sensitive to, so a reader has to be able to see the parts
  -- and disagree with the weighting.
  add column if not exists dim_conditions numeric,
  add column if not exists dim_direction numeric,
  add column if not exists dim_capacity numeric,
  -- The composite before it becomes a percentile: (C' + D' + K') / 3.
  -- Stored so a reader can check the percentile conversion themselves.
  add column if not exists composite_z numeric,
  -- The published score: percentile rank against the 148-row pooled
  -- reference distribution, 0-100, meaningful to one decimal place.
  add column if not exists percentile numeric;

comment on column mmai_scores.dim_conditions is
  'Standardised Conditions score (inflation gap + unemployment). Engine v2.0.';
comment on column mmai_scores.dim_direction is
  'Standardised Direction score (GDP growth alone). Engine v2.0.';
comment on column mmai_scores.dim_capacity is
  'Standardised Capacity score (government debt + policy rate space). Engine v2.0.';
comment on column mmai_scores.composite_z is
  'MMAI_Z = (C1 + D1 + K1) / 3, before percentile conversion. Engine v2.0.';
comment on column mmai_scores.percentile is
  'Published score: percentile rank against the pooled 148-row 2000-2025 reference distribution. Engine v2.0.';

-- A v2 row is all-or-nothing. The engine withholds the composite when any
-- of the five indicators is absent rather than reweighting around the gap,
-- so a row cannot carry a percentile without the three dimensions that
-- produced it. This catches a partial write rather than letting it publish.
alter table mmai_scores
  drop constraint if exists mmai_scores_v2_complete_check;

alter table mmai_scores
  add constraint mmai_scores_v2_complete_check
  check (
    percentile is null
    or (
      dim_conditions is not null
      and dim_direction is not null
      and dim_capacity is not null
      and composite_z is not null
      and percentile between 0 and 100
    )
  );

-- Every existing row predates this engine. Stamping them explicitly means
-- 'v1.0' is a recorded fact rather than a default nobody ever set.
update mmai_scores
   set formula_version = 'v1.0'
 where formula_version is null
    or formula_version = '';
