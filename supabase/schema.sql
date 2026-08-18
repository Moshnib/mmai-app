-- ============================================================
-- MMAI DATABASE SCHEMA
-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ============================================================

-- Raw indicator values, one row per market per refresh.
-- This is the "Standard Observation Table" from the original project report,
-- simplified to the fields the current five-pillar model actually uses.
create table if not exists raw_indicators (
  id bigint generated always as identity primary key,
  market text not null,                -- 'US', 'EA', 'CA', 'UK', 'AE'
  inflation numeric,                   -- % YoY
  gdp_growth numeric,                  -- % (see notes: convention varies by market)
  unemployment numeric,                -- %
  policy_rate numeric,                 -- % (null when no public source exists)
  brent_yoy numeric,                   -- % YoY, shared across all markets
  observation_date date not null,      -- period the values represent
  source_note text,                    -- e.g. "BLS CUUR0000SA0; FRED FEDFUNDS"
  fetched_at timestamptz not null default now(),
  status text not null default 'current' check (status in ('current', 'stale', 'missing'))
);

-- Computed scores, derived from raw_indicators by the scoring engine.
-- Kept as a separate table (not a view) so historical scores are preserved
-- even if the scoring formulas are later revised — never overwrite history silently.
create table if not exists mmai_scores (
  id bigint generated always as identity primary key,
  market text not null,
  observation_date date not null,
  pillar_ps numeric,
  pillar_gm numeric,
  pillar_lm numeric,
  pillar_mc numeric,
  pillar_mm numeric,                   -- always null until a licensed equity source exists
  pillar_ec numeric,
  composite numeric,                   -- null when coverage < 70% (see Equation 7)
  coverage numeric not null,           -- 0.0 - 1.0
  band text not null,
  computed_at timestamptz not null default now(),
  formula_version text not null default 'v1.0'  -- matches the methodology paper's version tag
);

-- One row per market showing only the latest score — what the homepage reads.
create or replace view latest_scores as
select distinct on (market) *
from mmai_scores
order by market, observation_date desc, computed_at desc;

-- Indexes for the query patterns the site actually uses.
create index if not exists idx_raw_indicators_market_date on raw_indicators (market, observation_date desc);
create index if not exists idx_mmai_scores_market_date on mmai_scores (market, observation_date desc);

-- Row Level Security: allow public read-only access (this is a public dashboard),
-- but block writes from the browser — only the server-side refresh job (using the
-- service role key, which bypasses RLS) should ever write to these tables.
alter table raw_indicators enable row level security;
alter table mmai_scores enable row level security;

create policy "Public read access" on raw_indicators for select using (true);
create policy "Public read access" on mmai_scores for select using (true);
