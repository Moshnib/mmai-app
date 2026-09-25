-- ============================================================
--  THE FED ANNOUNCES A RANGE; THE SITE SHOWED A POINT.
--
--  The US policy rate on this site is the Effective Federal Funds Rate --
--  what banks actually paid, published daily by the New York Fed, and the
--  figure the score uses. On 25 September 2026 it read 3.88% while every
--  newspaper said "4%", because the Fed sets a TARGET RANGE (3.75-4.00%
--  since 16 September) and the press quotes its top. Same fact, two
--  numbers, and a reader has no way to tell that from the card.
--
--  The NY Fed's own row already carries targetRateFrom and targetRateTo,
--  so this is the same source and the same licence. Stored beside the
--  rate, per reading, so the card can show both and the history keeps
--  which range each day's rate sat in.
--
--  Null where a market has no announced range (every market but the US)
--  or when the NY Fed row does not carry one.
--
--  Run once in the Supabase SQL editor. Safe to run twice.
-- ============================================================

alter table raw_indicators
  add column if not exists policy_rate_target_low numeric,
  add column if not exists policy_rate_target_high numeric;

comment on column raw_indicators.policy_rate_target_low is
  'Lower bound of the central bank''s announced target range, where it sets one (US only today). The scored figure stays policy_rate.';
comment on column raw_indicators.policy_rate_target_high is
  'Upper bound of the announced target range -- the number the press quotes as "the Fed rate".';
