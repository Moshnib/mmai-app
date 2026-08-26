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
  source_note text,                    -- e.g. "BLS CUUR0000SA0; NY Fed EFFR"
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

-- ============================================================
-- NOTIFICATIONS: email subscribers, added later.
-- No login/password — a subscriber is just an email + which
-- markets they want alerts for. Unsubscribe uses a random token
-- in the link, not a login, so it works with zero friction.
-- ============================================================
create table if not exists subscribers (
  id bigint generated always as identity primary key,
  email text not null unique,
  markets text[] not null,              -- e.g. {'US','UK'}
  unsubscribe_token text not null unique,
  created_at timestamptz not null default now()
);

-- No public read policy on purpose: the subscriber list should never be
-- queryable from the browser. All reads/writes happen server-side only,
-- using the service role key (which bypasses RLS entirely).
alter table subscribers enable row level security;

-- ============================================================
-- CONTACT / FEEDBACK: submissions from the /contact page.
-- ============================================================
create table if not exists feedback_submissions (
  id bigint generated always as identity primary key,
  sender_type text not null check (sender_type in ('investor', 'company', 'individual', 'student', 'other', 'prefer_not_to_say')),
  topic text not null check (topic in ('feedback', 'partnership', 'advertising', 'other')),
  name text,
  email text,
  message text not null,
  created_at timestamptz not null default now()
);

-- No public read policy on purpose, same reasoning as subscribers:
-- submissions should never be queryable from the browser.
alter table feedback_submissions enable row level security;

-- ============================================================
-- GULF WATCH: a non-scored panel for UAE, Bahrain, Qatar, Kuwait, Saudi
-- Arabia, and Oman. Deliberately a SEPARATE table from raw_indicators,
-- not a reuse of it with policy_rate left null -- that would conflate
-- "this run's policy rate happened to fail" with "this country
-- structurally has no composite," which is exactly the ambiguity this
-- feature exists to avoid. No link to mmai_scores; these countries
-- never get a composite score. See MMAI_MASTER_HANDOVER.md section 11.
-- ============================================================
create table if not exists gulf_indicators (
  id bigint generated always as identity primary key,
  country_code text not null check (country_code in ('AE','BH','QA','SA','KW','OM')),
  cpi_yoy numeric,
  real_estate_value numeric,
  real_estate_metric_label text,       -- required whenever real_estate_value is set
                                        -- (see the check constraint below) -- a number
                                        -- with no label is worse than no number at all,
                                        -- since each country's real-estate figure is a
                                        -- genuinely different kind of thing (Qatar's is a
                                        -- monthly transaction count, others may differ).
  fx_reserves_usd_bn numeric,
  current_account_pct_gdp numeric,
  observation_date date not null,
  source_note text,
  fetched_at timestamptz not null default now(),
  status text not null default 'current' check (status in ('current', 'stale', 'missing')),
  check (real_estate_value is null or real_estate_metric_label is not null)
);

create index if not exists idx_gulf_indicators_country_date on gulf_indicators (country_code, observation_date desc);

alter table gulf_indicators enable row level security;

create policy "Public read access" on gulf_indicators for select using (true);
