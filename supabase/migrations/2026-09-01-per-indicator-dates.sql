-- ============================================================
-- Per-indicator observation dates for the scored markets.
-- Audit finding M-6.  Run this in the Supabase SQL Editor.
--
-- WHY
-- gulf_indicators already stores a separate observation date for every
-- indicator, so a Gulf card can tell a reader that a figure is from
-- March 2025. raw_indicators -- which drives the actual MMAI score --
-- stores ONE date for all five indicators, and it records the FETCH
-- date, not the period the figure refers to.
--
-- The consequence is that the scored half of the site is less
-- transparent than the unscored half. A reader cannot learn that the US
-- GDP figure inside a row stamped today is a full-year annual number.
--
-- Every fetcher already RECEIVES the observation period from its source
-- and currently discards it. This adds somewhere to put it.
--
-- SAFETY
--   * Additive only. No column is dropped, renamed or retyped.
--   * All five are nullable, so every existing row stays valid and
--     nothing needs backfilling.
--   * IF NOT EXISTS means re-running this is harmless.
--   * No index, constraint or default is added, so there is no table
--     rewrite and no lock of consequence on a table this size.
--
-- ORDER OF OPERATIONS -- IMPORTANT
-- Run this BEFORE the matching code deploys. The refresh route will name
-- these columns on insert; naming a column that does not exist fails the
-- WHOLE insert, which would stop the daily refresh for every market.
-- Nothing is deployed until you confirm this has run.
-- ============================================================

alter table raw_indicators
  add column if not exists inflation_observation_date    date,
  add column if not exists gdp_observation_date          date,
  add column if not exists unemployment_observation_date date,
  add column if not exists policy_rate_observation_date  date,
  add column if not exists brent_observation_date        date;

-- Verification. Expect five rows back.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'raw_indicators'
  and column_name like '%_observation_date'
order by column_name;
