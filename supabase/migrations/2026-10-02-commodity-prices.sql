-- ============================================================
--  A PRICE THAT MOVES EVERY DAY, ON A SITE OF MONTHLY FIGURES
--
--  On 2 October 2026 the owner wrote: "oil price went insane, gold
--  dropped, everyone watching, nothing in this website is helpful." He was
--  right, and the reason was structural: every figure on the site is
--  published monthly or quarterly by a statistics office, INCLUDING the
--  oil. lib/fetchers/eia.ts asked the US Energy Information
--  Administration for the MONTHLY average and published a year-over-year
--  percentage, so on a day Brent moved six dollars the site said nothing.
--
--  The same EIA series (RBRTE, Europe Brent Spot Price FOB) is published
--  DAILY, from the same endpoint, under the same public-domain terms and
--  the same API key. This table holds it.
--
--  KEYED ON THE SERIES, NOT THE COMMODITY. "Brent, daily spot" and
--  "Brent, monthly average" are two different series of one commodity and
--  they disagree on purpose -- a monthly average is not a price on a day.
--  Storing both under 'oil' would turn a wording problem into a data one.
--
--  unit and source are NOT NULL: a price with no unit is a future wrong
--  number, and the EIA's terms ask for attribution wherever it is shown.
--
--  fetched_at is what makes a DEAD series distinguishable from this one's
--  normal lag. EIA publishes the daily spot two to four days in arrears,
--  so "newest observation is three days old" is healthy and says nothing
--  about whether the fetch still works. app/api/watchdog reads this
--  column, not observation_date.
--
--  Run once in the Supabase SQL editor. Safe to run twice.
-- ============================================================

create table if not exists commodity_prices (
  id bigint generated always as identity primary key,
  series text not null,                -- 'brent_spot_daily'
  observation_date date not null,      -- the trading day this price is for
  price numeric not null,
  unit text not null,                  -- '$/bbl'
  source text not null,                -- 'U.S. Energy Information Administration'
  fetched_at timestamptz not null default now(),
  unique (series, observation_date)
);

-- WITHOUT THESE TWO LINES THE CARD NEVER RENDERS AND NOTHING SAYS WHY.
-- The site reads with the anon key; a table with row-level security on and
-- no read policy returns an empty list rather than an error, so the page
-- would simply be blank for ever. lib/bondYieldsRead.ts records that exact
-- failure happening once already.
alter table commodity_prices enable row level security;

drop policy if exists "Public read access" on commodity_prices;
create policy "Public read access" on commodity_prices for select using (true);

comment on column commodity_prices.series is
  'Which published series this price belongs to, e.g. brent_spot_daily. Not the commodity: one commodity can have several series that legitimately disagree.';
comment on column commodity_prices.fetched_at is
  'When MMAI last wrote this row. The watchdog reads this, because observation_date lags the source by two to four days by design.';
