# MMAI — Project Kickoff for Claude Code

**Read this whole file before touching any code.** This is a handoff from an extended Claude.ai session that built this project from scratch. Everything below is verified fact from that session, not assumption — where something is uncertain, it's marked as such.

---

## 1. What this is

**Market Pulse / MMAI (Moshnib Macro Analysis Index)** — a Next.js macro-economic dashboard for Mohammad Elmoshnib / FINTECH.TV. It tracks 7 countries across 5 weighted "pillars" (Price Stability, Growth Momentum, Labour Market, Monetary Conditions, External & Commodities) and combines them into a single 0–100 composite score with a plain-language interpretation band (e.g. "Supportive," "Balanced").

**Explicitly not** an investment/trading signal — it's an analytical communication tool. This disclaimer appears throughout the site and should stay.

- **Live site:** mmai-app.vercel.app
- **GitHub:** github.com/Moshnib/mmai-app
- **Supabase project ref:** uuftxtmkbbcqcgjsseid.supabase.co

---

## 2. Tech stack

- Next.js 16.3.1, App Router, TypeScript, Turbopack
- Vercel (Hobby tier — free, but has a **non-commercial use restriction**; upgrade to Pro ($20/mo) the moment this generates revenue)
- Supabase (free tier — **commercial use is explicitly allowed** here, unlike Vercel Hobby)
- Recharts for all charts
- Resend for email (installed, not yet fully activated — see §8)

---

## 3. The 7 markets — current status

| Market | Live? | CPI/Inflation | GDP Growth | Unemployment | Policy Rate |
|---|---|---|---|---|---|
| 🇺🇸 US | **Yes** | BLS (live) | BEA (live) | BLS (live) | New York Fed (live) |
| 🇯🇵 Japan | **Yes** | World Bank (live) | World Bank (live) | World Bank (live) | Bank of Japan (live) |
| 🇦🇺 Australia | **Yes** | ABS Data API (live) | World Bank (live) | World Bank (live) | RBA (live) |
| 🇪🇺 Euro Area | **Yes** (2026-08-21) | Eurostat (live) | Eurostat (live) | Eurostat (live) | ECB (live) |
| 🇨🇦 Canada | **Yes** (2026-08-21) | Statistics Canada (live) | World Bank (live) | World Bank (live) | Bank of Canada (live) |
| 🇬🇧 UK | **Yes** (2026-08-21) | ONS (live) | World Bank (live) | World Bank (live) | Bank of England (live) |
| 🇳🇴 Norway | **Yes** (2026-08-21) | Statistics Norway (live) | World Bank (live) | World Bank (live) | Norges Bank (live) |

All 7 markets are now live — see `lib/fetchers/eurostat.ts`, `ecb.ts`, `statcan.ts`, `boc.ts`, `ons.ts`, `boe.ts`, `ssb.ts`, `norgesbank.ts`. Things worth knowing:
- The old `api.ons.gov.uk` domain referenced when this project was first scoped is fully decommissioned (retired 25/11/2024) — UK CPI now goes through `www.ons.gov.uk/.../timeseries/{id}/{dataset}/data` instead.
- Canada/UK/Norway GDP growth and unemployment reuse the same World Bank source already used for Japan/Australia (an ILO-modelled annual estimate, not each country's own monthly agency figure) — same tradeoff already accepted for JP/AU, just now applied consistently.
- Norway was added after a research pass comparing several countries (Brazil, New Zealand, South Korea were the other candidates) for data accessibility and licensing. Its policy-rate source (Norges Bank) is governed by Norway's national open-data framework, but unlike Statistics Norway's API (explicit CC BY 4.0), Norges Bank's own pages don't spell out the license in so many words — noted honestly on the Sources page rather than assumed. Also: SSB's old monthly CPI table (03013) was retired in Feb 2026 in favor of table 14700 — worth knowing if that table ever needs revisiting.

Only Brent Crude (External & Commodities, shared across every market) is still a placeholder — see §9.

**UAE was removed** (2026-08-19) — no verified public policy-rate source was ever found for it, and it permanently failed the 70% coverage threshold. Its historical data is preserved in git history if ever needed again. Don't re-add it without solving the policy-rate-source problem first.

---

## 4. Repository map — where things live

```
lib/
  scoring.ts          -- ALL formulas live here: pillar calcs, composite,
                         band labels, and colorForScore() (the gradient
                         function). RAW_FIELD maps each pillar to its raw
                         indicator (shared by Trends + Compare pages).
  markets.ts           -- FALLBACK_MARKETS array (name, code, fallback raw
                         values), scoreMarket() helper
  history.ts            -- Hardcoded 2019-2024 history per market + current
                         2026 snapshot. NOT connected to live refresh --
                         editing this is the ONLY way to change historical
                         charts. See §9.
  sources.ts            -- Source registry for the Sources page: institution,
                         license, live/fallback status per indicator
  fetchers/
    bls.ts              -- US CPI + unemployment (BLS API, no key needed
                         for basic use, optional key raises rate limit)
    nyfed.ts             -- US Fed Funds rate (New York Fed's own EFFR API;
                         replaced FRED 2026-08-22 — FRED's terms banned
                         storing data in a database, which this app does)
    boj.ts               -- Japan policy rate (Bank of Japan's own API)
    abs.ts                -- Australia CPI (ABS Data API)
    rba.ts                 -- Australia policy rate (RBA's own CSV tables)
    worldbank.ts            -- Generic GDP growth + unemployment fetcher,
                         works for any country via ISO3 code (fetchGdpGrowth,
                         fetchUnemployment)
    [MISSING: eurostat.ts, statcan.ts, boc.ts, ons.ts, boe.ts, bea.ts,
     eia.ts -- all documented with real URLs in the old Power BI
     Connection Guide doc, just never built as Next.js fetchers]

app/
  page.tsx               -- Overview page (gauge, pillar donuts, world map,
                         heatmap, subscribe form)
  trends/                 -- "Data Over Time" -- single market, all 5
                         pillars + composite, click a pillar to see its
                         raw indicator detail
  compare/                -- "Compare Markets" -- NEW, all 7 markets
                         plotted together, year-range picker, pillar
                         selector, shows both pillar-score and raw-rate
                         comparison
  learn/                  -- Plain-language explanations + formulas
  sources/                 -- Full source/license audit table, LIVE/
                         MANUAL badges
  api/
    refresh/route.ts        -- The core cron job. Fetches all 7 markets
                         (live where wired, fallback otherwise), writes to
                         Supabase, detects band-crossings, triggers emails
    subscribe/route.ts       -- Email signup (no login system -- just
                         email + which markets)
    unsubscribe/route.ts      -- Token-based, no login needed

components/
  [Snapshot from this project's kickoff -- component names below are what
  existed at that point. Gauge.tsx, Heatmap.tsx, CompareGrid.tsx, and
  GulfMapIcon.tsx have since been deleted and replaced (ScoreDisplay.tsx,
  a homepage Gulf Watch section, and a redesigned WorldMap.tsx respectively)
  -- see MMAI_MASTER_HANDOVER.md for current state.]
  Gauge.tsx, PillarGrid.tsx, Heatmap.tsx, WorldMap.tsx, Sparkline.tsx,
  CompareGrid.tsx, TrendChart.tsx (the shared multi-series chart component,
  used by both Trends and Compare pages), SubscribeForm.tsx

supabase/schema.sql       -- raw_indicators, mmai_scores, subscribers tables
                         + latest_scores view. subscribers table was added
                         LATE -- if setting up a fresh Supabase project,
                         make sure this whole file gets run, not an old copy.
```

---

## 5. The scoring formulas (do not change without discussion)

```
PILLAR_WEIGHTS = { PS: 0.25, GM: 0.25, LM: 0.1875, MC: 0.1875, EC: 0.125 }

S_PS = clip(100 − 15 × |inflation − 2|, 0, 100)      -- distance from 2% target
S_GM = clip(50 + 10 × gdpGrowth, 0, 100)
S_LM = clip(100 − 10 × (unemployment − 2), 0, 100)
S_MC = clip(100 − 12 × |policyRate − 2.5|, 0, 100)   -- distance from 2.5% "neutral"
S_EC = clip(100 − 1.2 × |brentYoY|, 0, 100)

MMAI = (Σ weight × pillar_score) / (Σ active weights)   -- reweights if a
                                                            pillar is missing
```

Publication threshold: don't show a numeric score if coverage < 70%. Interpretation bands are categorical (Strongly Supportive / Supportive / Balanced / Challenging / Highly Challenging) but **color is continuous**, not banded — see §6.

---

## 6. The color system — READ THIS BEFORE TOUCHING ANY COLOR

This went through real, hard-won iteration. The rules:

1. **No green, anywhere in the app.** This was an explicit, repeated user request. The gradient is "Ember to Ice": Red → Orange → Violet → Cyan, defined in `lib/scoring.ts` as `colorForScore()`.
2. **Gold was deliberately removed from the gradient.** An earlier version went Red → Orange → Gold → Cyan → Violet, and interpolating directly from Gold to Cyan in RGB space passes through green as an unavoidable side effect of the math (verified: scores 60-65 rendered visibly green). If you ever add a color stop, test it with the verification script pattern used in that fix — sample every integer 0-100 and check no output is green-dominant.
3. **Colors are score-based almost everywhere** (`bandFor(score).color`), so two things with the same score always look the same regardless of what they represent. **The one deliberate exception is the Compare page**, which uses fixed per-market identity colors on purpose — there, the point is tracking "which line is which country" across time, not communicating score quality.
4. **Never hardcode a fixed color for a pillar or market's "identity"** outside that one exception. This exact mistake caused a real bug earlier (Growth Momentum was always gold, Labour Market always red, regardless of actual performance) and had to be ripped out.

---

## 7. Dark theme conventions

- Page background: `var(--paper)` = `#08080D`
- Card background: `rgba(255,255,255,0.035)` + `backdropFilter: blur(14px)` + `border: 1px solid var(--hair)` -- this is the standard "glass card" pattern, copy it exactly for new UI
- **Do not use `background: "#fff"` or `background: "var(--ink)"` for any container.** `--ink` was redefined during the dark-theme rewrite to mean *light text color*, not *dark background* — using it as a background is an inherited bug pattern that has bitten this project multiple times (Trends detail panel, Sources page header/disclaimer, Learn page cards all had this exact bug at different points). If you see it, it's wrong.
- Native `<select>` dropdowns need **explicit solid** (not rgba/translucent) background + color on both the `<select>` AND its `<option>` children — translucent backgrounds on `<option>` are unreliably rendered by browsers and caused a real reported bug.

---

## 8. Notification system — built but not fully live

- `subscribers` table + `/api/subscribe` + `/api/unsubscribe` are built and working (form submits, row appears in Supabase).
- Band-crossing detection is wired into `/api/refresh` — compares each market's new band to its previous one, fires only on an actual change (not every refresh).
- **`RESEND_API_KEY` is not yet set** in production. Without it, `sendBandCrossingEmail()` will throw. Get a free key at resend.com, add to Vercel env vars.
- **The sending address needs a verified domain.** The code currently uses `alerts@mmai-app.vercel.app`, which will NOT work with Resend until a real domain is verified there. Fix that line in `lib/notify.ts` once a domain exists.
- This has never been tested end-to-end with a real send — only the database/detection logic has been verified.

---

## 9. Highest-value next steps, roughly in priority order

1. ~~Wire EA/CA/UK to live sources.~~ **Done 2026-08-21.** All 6 markets are now live — see §3 and `lib/fetchers/eurostat.ts`, `ecb.ts`, `statcan.ts`, `boc.ts`, `ons.ts`, `boe.ts`. The old `api.ons.gov.uk` domain referenced when this was originally scoped is decommissioned; UK CPI now uses `www.ons.gov.uk/.../timeseries/`. The Eurostat unemployment fetch needed two separate fixes: a geo-code change (`EA20` → `EA21`, Eurostat adds a new fixed-composition code for each euro accession — worth knowing before the next country joins), and a real publication-lag bug found during live testing (the EA21 aggregate can be a month behind its own dimension listing, so the fetcher now looks back 3 periods and uses the newest one with an actual value, not just the newest listed period).
2. **Get the Resend key live** and do one real end-to-end test send.
3. **Verify the daily cron actually fires unattended** — it's configured (`vercel.json`, 06:00 UTC) but has only ever been triggered manually via curl. Check Supabase tomorrow for a row that appeared without you triggering it. Now more important than before, since a real live-source outage for EA/CA/UK could otherwise go unnoticed.
4. **US GDP growth** is still a hardcoded fallback (1.5) even though US is otherwise fully live — needs BEA API wired in (`bea.gov`, free key).
5. ~~Add a 7th market (Norway).~~ **Done 2026-08-21.** See §3 and `lib/fetchers/ssb.ts`, `norgesbank.ts`. Researched alongside Brazil, New Zealand, and South Korea as candidates — Brazil is the next-strongest ("likely yes, worth one more explicit license confirmation before building" was the note at the time); New Zealand's central bank blocks requests without a browser-like User-Agent header (fixable, not a dead end); South Korea needs a registered API key and its commercial-reuse terms were never explicitly confirmed.
6. Possible future markets beyond that shortlist: e-Stat Dashboard's exact indicator codes for CPI/unemployment were never successfully found (tried hard, hit a wall). Update 2026-08-22: Japan's CPI and unemployment no longer go through FRED at all — both were switched to the World Bank (same source already used for Canada/UK/Norway's GDP/unemployment) as part of a licensing fix, since FRED's terms prohibit storing data in a database. e-Stat would still be worth revisiting for monthly-granularity Japan data specifically, but it's no longer a compliance blocker.

---

## 10. Working conventions this user expects (important for how you operate)

- **Every code change gets actually built and tested before being called done.** `npm run build`, check `EXIT: 0`, then verify real behavior — either by starting a local server and curling it, or by grepping the actual compiled JS bundle for the expected content/values. Never claim something works without having checked.
- **When historical/factual data is added** (e.g. a new market's 2019-2024 numbers), it gets sourced from real published statistics, sanity-checked by computing the resulting scores and confirming the trajectory tells a coherent real story, not just plausible-sounding numbers.
- **The user is on Windows, using Git Bash**, and deploys via: extract zip to a new folder → copy all → paste into the real project folder with "Replace the files in the destination" → `git add .` → `git commit` → `git push` → wait for Vercel → hard refresh. If you're generating deployable code changes for them (rather than editing directly via Claude Code's own file access), package as a zip and give exact numbered steps.
- **Real mistake worth knowing about:** the user once restored the project from GitHub's "Download ZIP" button after losing a local folder. That download does NOT include the `.git` folder, so `git add`/`commit` fail with "fatal: not a git repository" — the fix is `git clone` instead of a zip download. If this comes up again, that's the answer.
- **`.env.local` is never in git** (correctly gitignored). If it's ever lost, rebuild from `.env.local.example` using the real Supabase keys from Settings → API. Watch for Windows hiding file extensions when renaming — a renamed "`.env.local`" can silently still be "`.env.local.example`" underneath if extensions are hidden.
- This user responds well to being shown *why* something broke (root cause), not just being told it's fixed — and appreciates being asked to verify things live (paste a URL, check a screenshot) when a tool's own verification hits a real limitation, rather than being told to "just trust it."

---

## 11. Suggested first message to send in Claude Code

> I'm continuing the MMAI project (Next.js macro-dashboard, 7 markets, Supabase + Vercel). Read `/MMAI_Claude_Code_Kickoff.md` in the repo root for full context on architecture, conventions, and current status before making any changes. [Then describe whatever you actually want done next.]

*(Consider committing this file into the repo root so it travels with the project and survives future context resets.)*
