# MMAI — MASTER HANDOVER DOCUMENT

**Last updated:** 2026-08-26
**Reflects commit:** `a20e596` ("Add Gulf Watch's currency-stability pillar (FX reserves + current account)")
**Purpose:** Paste or upload this entire document into a new chat with Claude Code to continue the MMAI project with zero loss of context.

> **New since 2026-08-25:** Gulf Watch's entire data layer is now built and verified live — all 6 countries have a complete 3-pillar dataset (cost of living, currency stability, and real estate where available) refreshing daily, confirmed by checking actual database rows after a manual trigger, not just a success response. **Nothing is visible on the site yet**, since the page itself doesn't exist. Full details in **§11**. Also: a real security gap predating Gulf Watch entirely (`CRON_SECRET` silently not being enforced on both refresh endpoints) was found and fixed on 2026-08-26 — see §11.6.

> **This file now lives INSIDE the repo** (`MMAI_MASTER_HANDOVER.md` in the project root), so every version of it is permanently backed up on GitHub and can never be lost with a laptop, a chat, or a OneDrive sync. An older copy dated **2026-08-22** may still exist in `OneDrive/Documents/mmai project handover august 22/` — **that copy is stale and should be ignored or deleted.** It describes FRED as a live data source (it was removed for legal reasons), lists Norway as an active market (it isn't right now), and describes the BEA/EIA work as uncommitted (it was committed on 2026-08-22).

> **Companion docs, all in the repo root:**
> - `MMAI_TODO.md` — the plain-language running to-do list. **This is the doc to read first for "what's next."**
> - `MMAI_Claude_Code_Kickoff.md` — the project's original kickoff/status doc.
> - `README.md` — standard repo readme.
> Keep all of these in sync as work lands.

---

## 0. STATE VERIFICATION (run 2026-08-24 — **superseded, see §15**)

> **This block is a dated snapshot from 24 August and is no longer current.**
> The cron claim in particular is now WRONG: Vercel Hobby crons proved
> unreliable on 28–29 August and the primary trigger moved to GitHub
> Actions. See §15 for verified current state.

Everything below was checked directly at the time, not assumed:

| Check | Result |
|---|---|
| `git status` | Clean. Only `.claude/` untracked (deliberately excluded — machine-specific). |
| Branch sync | `main` is level with `origin/main`. **Nothing unpushed.** |
| `npx tsc --noEmit` | Passes, zero errors. |
| `npm run build` | Passes. All 16 routes generate successfully. |
| Live site (8 pages) | All return HTTP 200: `/`, `/trends`, `/compare`, `/sources`, `/learn`, `/contact`, `/robots.txt`, `/sitemap.xml` |
| Daily cron firing unattended | **CONFIRMED.** 2026-08-23 at 06:37 UTC and 2026-08-24 at 06:36 UTC — 6 markets each, ~9 seconds, nobody triggering it. |
| Live data quality | All 6 markets writing real values daily. **Zero `PARTIAL` suffixes** — every source succeeded on both runs. |

**There is no unfinished, uncommitted, or unpushed work. The project is in a clean, fully-deployed, verified-working state.**

---

## 1. PROJECT OVERVIEW

**What MMAI is:** Market Pulse / **MMAI (Moshnib Macro Analysis Index)** — a Next.js macro-economic dashboard built for Mohammad Elmoshnib / FINTECH.TV. It tracks **6 active markets** across **5 weighted "pillars"** and combines them into a single 0–100 composite score with a plain-language interpretation band ("Supportive," "Balanced," etc.).

**Main objective:** A transparent, source-cited, continuously-updating single number communicating whether the macro environment in a given market is broadly supportive or challenging — explicitly **NOT** an investment or trading signal. This disclaimer appears in the footer and on the Learn page and **must stay**.

**Intended users:** FINTECH.TV audience and the general public. **The site owner (the user in this chat) is a non-developer with no coding knowledge — always explain technical concepts in plain language.**

**Architecture:**
- Next.js App Router, mostly client components.
- A server-side cron (`app/api/refresh/route.ts`) runs daily at 06:00 UTC via Vercel Cron, fetches from ~16 government/institutional APIs, computes scores, writes to Supabase.
- Public pages query Supabase directly from the browser using the public anon key (Row-Level Security restricts it to read-only) — so a fresh refresh appears on the next page load with no rebuild or redeploy.
- `lib/history.ts` holds hand-sourced historical data (2019–2025) plus a current-year point; `lib/useLiveHistory.ts` overlays the latest live Supabase row onto that last point for the Trends and Compare pages.
- `lib/markets.ts` holds fallback data so the site is never blank if Supabase is unreachable.

**Links:**
- **Live site:** mmai-app.vercel.app
- **GitHub:** github.com/Moshnib/mmai-app (git user: "Mohammad Elmoshnib")
- **Supabase project ref:** uuftxtmkbbcqcgjsseid.supabase.co

---

## 2. TECHNOLOGY STACK

| Layer | Detail |
|---|---|
| Framework | Next.js **16.3.1**, App Router, Turbopack |
| Language | TypeScript **5** |
| UI runtime | React **19.2.8** / react-dom 19.2.8 |
| Charts | Recharts **3.10.1** |
| Database client | @supabase/supabase-js **2.112.3** |
| Email | Resend **6.21.0** (installed, **not activated** — see §7) |
| Hosting | Vercel — **Hobby tier** (free; non-commercial-use restriction. Upgrade to Pro $20/mo the moment this generates revenue.) |
| Database | Supabase — free tier (commercial use explicitly allowed) |
| Local dev | Node.js v24.19.0 + npm 11.17.0 |

**Vercel cron config** (`vercel.json`, committed):
```json
{ "crons": [ { "path": "/api/refresh", "schedule": "0 6 * * *" } ] }
```

### Environment variables

| Var | Purpose | Vercel (production) | Local `.env.local` |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ Set | ⚠️ Placeholder |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public/browser key | ✅ Set | ⚠️ Placeholder |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, bypasses RLS | ✅ Set | ⚠️ Placeholder |
| `BEA_API_KEY` | US GDP growth | ✅ Set | ❌ Not set |
| `EIA_API_KEY` | Brent Crude (shared) | ✅ Set | ❌ Not set |
| `CRON_SECRET` | Protects `/api/refresh` | ✅ Set (`mmai-verify-2026`) | — |
| `RESEND_API_KEY` | Email alerts | ❌ **Not set** | ❌ Not set |
| `BLS_API_KEY` | Optional, raises BLS rate limit 25→500/day | Not set (not required) | — |

> **Important consequence of the placeholder local credentials:** local `/api/refresh` testing proves the *fetching* side works against real external APIs, but **cannot** prove Supabase writes. A "Supabase write failed" error during local testing is **expected and not a bug**. Verify writes against production/Supabase directly instead.

**Credentials file:** real API key values live in `OneDrive/Documents/mmai project handover august 22/mmai-app-credentials.txt` — deliberately outside the repo so it can never be committed.

---

## 3. PROJECT STRUCTURE (current)

```
app/
  page.tsx                    -- Overview homepage (client component). ScoreDisplay, PillarGrid,
                                 KeyRatesRow, WorldMap (click navigates to /trends?market=X),
                                 Gulf Watch card section, WeeklyFeed, SubscribeForm.
  layout.tsx                  -- per-page titles/descriptions, SiteFooter
  icon.tsx                    -- generated favicon (replaced the Next.js starter logo)
  opengraph-image.tsx         -- social sharing card
  not-found.tsx               -- branded 404
  robots.ts / sitemap.ts      -- crawlability
  trends/page.tsx             -- wrapper + Suspense (server-renders content for crawlers)
  trends/TrendsPageInner.tsx  -- single-market "Data Over Time" view
  compare/page.tsx            -- wrapper + Suspense
  compare/ComparePageInner.tsx-- cross-market view. MARKET_COLORS = the ONE deliberate
                                 exception to score-based coloring.
  learn/page.tsx              -- methodology explainer (now publishes pillar weights + 0–100 cap)
  sources/page.tsx            -- source/license audit, renders components/SourcesTable.tsx
  contact/page.tsx            -- contact/feedback form
  api/refresh/route.ts        -- THE core cron job
  api/subscribe|unsubscribe|feedback/route.ts

lib/
  scoring.ts                  -- ALL formulas (see §5). Header says: do not change without discussion.
  markets.ts                  -- FALLBACK_MARKETS (6 active; Norway commented out)
  history.ts                  -- hardcoded 2019–2025 history per market
  useLiveHistory.ts           -- client hook overlaying live Supabase data onto history
  sources.ts                  -- DATA SOURCE REGISTRY, 30 entries. Single source of truth
                                 for the /sources page.
  supabase.ts                 -- getPublicSupabaseClient() (cached singleton),
                                 getServiceSupabaseClient() (not cached, intentional)
  notify.ts                   -- sendBandCrossingEmail() via Resend
  mapdata/                    -- world map geometry
  fetchers/                   -- one file per data source (16 files):
    abs, bea, bls, boc, boe, boj, ecb, eia, eurostat,
    norgesbank, nyfed, ons, rba, ssb, statcan, worldbank

components/
  ScoreDisplay, PillarGrid, KeyRatesRow, WorldMap, Sparkline, GulfCard,
  GulfTrends, WeeklyFeed, TimeSliderScatter, TrendChart, Flag,
  SubscribeForm, ContactForm, ExportDataButtons, SiteFooter, SourcesTable,
  NavBar
  (Gauge, Heatmap, CompareGrid, GulfMapIcon deleted -- see §homepage
  restructure below for what replaced each one.)

supabase/schema.sql           -- raw_indicators, mmai_scores, subscribers + latest_scores view.
                                 RLS: public read-only on the first two; subscribers has NO
                                 public read policy (server-only).

Root: next.config.ts, package.json, vercel.json, .env.local.example,
      CLAUDE.md (@AGENTS.md include), AGENTS.md (auto-regenerated by `next dev` — do NOT hand-edit),
      README.md, MMAI_TODO.md, MMAI_Claude_Code_Kickoff.md, MMAI_MASTER_HANDOVER.md (this file)

.claude/launch.json + .claude/dev-wrapper.cmd
      -- local dev server launch config. NOT committed (machine-specific absolute paths).
         dev-wrapper.cmd sets PATH explicitly before calling `npm run dev`, because the
         harness process's PATH wasn't refreshed after Node.js was installed mid-session.
```

---

## 4. DATA SOURCES (current — 30 entries in `lib/sources.ts`, all `status: "live"`)

### ⚠️ FRED WAS REMOVED ENTIRELY (2026-08-22, commit `67442e2`)
**This is the single biggest change since the previous handover.** FRED's Terms of Service **prohibit storing or caching FRED Content in a database**, which directly conflicts with this app's whole architecture (every indicator is persisted to Supabase for historical charts). FRED was removed rather than accept the legal risk. `lib/fetchers/fred.ts` is **deleted**. Replacements:
- **US Fed Funds Rate** → New York Fed's own EFFR API (`lib/fetchers/nyfed.ts`). Their Terms of Use explicitly permit storage and commercial use. **A required reference-rate notice is displayed on the Sources page** — do not remove it.
- **Japan CPI + unemployment** → World Bank (`lib/fetchers/worldbank.ts`, including a new `fetchInflation()`). Trade-off: annual instead of monthly granularity.

**Do not reintroduce FRED as a data source.**

### 🇺🇸 United States
| Indicator | Institution | Fetcher | Notes |
|---|---|---|---|
| Inflation (CPI) | U.S. Bureau of Labor Statistics | `bls.ts` → `fetchUsInflation()` | Monthly. YoY computed from raw index, series `CUUR0000SA0` |
| Unemployment | BLS | `bls.ts` → `fetchUsUnemployment()` | Monthly, direct rate, series `LNS14000000` |
| Policy Rate (EFFR) | **Federal Reserve Bank of New York** | `nyfed.ts` → `fetchUsPolicyRate()` | Replaced FRED. Reference-rate notice required and displayed. |
| GDP Growth | U.S. Bureau of Economic Analysis | `bea.ts` → `fetchUsGdpGrowth()` | Table `T10101`, line 1 — already a % change series, no YoY math. **BEA returns HTTP 200 even on errors** — must check `BEAAPI.Error` in the body. |

### 🇪🇺 Euro Area
| Indicator | Institution | Fetcher | Notes |
|---|---|---|---|
| Inflation (HICP) | Eurostat | `eurostat.ts` | Dataset `prc_hicp_manr`, `geo=EA` (changing-composition) |
| GDP Growth | Eurostat | `eurostat.ts` | Dataset `tec00115`, `geo=EA21` (fixed-composition) |
| Unemployment | Eurostat | `eurostat.ts` | Dataset `une_rt_m`, `geo=EA21`. Requests last 3 periods and walks backward to the newest with an actual value, because the EA aggregate can lag its own dimension listing by a month. |
| Policy Rate (Deposit Facility) | European Central Bank | `ecb.ts` | SDMX-JSON, `FM`, key `D.U2.EUR.4F.KR.DFR.LEV`. **No top-level `data` wrapper** (unlike Norges Bank). |

### 🇨🇦 Canada
| Indicator | Institution | Fetcher | Notes |
|---|---|---|---|
| Inflation (CPI) | Statistics Canada | `statcan.ts` | WDS API, POST, vector `41690973`. Raw index → YoY computed manually. |
| GDP Growth | World Bank | `worldbank.ts` `fetchGdpGrowth("CAN")` | Annual |
| Unemployment | World Bank | `fetchUnemployment("CAN")` | Annual ILO modelled estimate |
| Policy Rate (Overnight Target) | Bank of Canada | `boc.ts` | Valet API, series `V39079`, no key |

### 🇬🇧 United Kingdom
| Indicator | Institution | Fetcher | Notes |
|---|---|---|---|
| Inflation (CPI) | UK ONS | `ons.ts` | Series `D7G7`, dataset `mm23`. **The old `api.ons.gov.uk` domain is FULLY DECOMMISSIONED** (retired 25 Nov 2024). Uses `www.ons.gov.uk/.../timeseries/{id}/{dataset}/data`. |
| GDP Growth | World Bank | `fetchGdpGrowth("GBR")` | Annual |
| Unemployment | World Bank | `fetchUnemployment("GBR")` | Annual ILO modelled |
| Policy Rate (Bank Rate) | Bank of England | `boe.ts` | IADB CSV, series `IUDBEDR` |

### 🇯🇵 Japan
| Indicator | Institution | Fetcher | Notes |
|---|---|---|---|
| Inflation (CPI) | **World Bank** | `worldbank.ts` → `fetchInflation()` | Replaced FRED. Annual. |
| GDP Growth | World Bank | `fetchGdpGrowth("JPN")` | Annual |
| Unemployment | **World Bank** | `fetchUnemployment("JPN")` | Replaced FRED. Annual. |
| Policy Rate | Bank of Japan | `boj.ts` | `DB=FM01`, series `STRDCLUCON`. ⚠️ **Commercial use requires written permission from BOJ's Public Relations Department** — fine while the site is non-commercial, must be resolved before monetizing. |

### 🇦🇺 Australia
| Indicator | Institution | Fetcher | Notes |
|---|---|---|---|
| Inflation (CPI) | Australian Bureau of Statistics | `abs.ts` | Dataflow `ABS,CPI,2.0.0`, YoY computed |
| GDP Growth | World Bank | `fetchGdpGrowth("AUS")` | Annual |
| Unemployment | World Bank | `fetchUnemployment("AUS")` | Annual |
| Cash Rate Target | Reserve Bank of Australia | `rba.ts` | F1.1 CSV. License is RBA's **Copyright and Disclaimer Notice Section 4**, NOT their general CC BY 4.0 (the Cash Rate is specifically excluded from it). Commercial use still permitted. |

### 🇳🇴 Norway — **CURRENTLY REMOVED FROM DISPLAY**
Removed 2026-08-22 (commit `b7b3abb`) pending written license confirmation from Norges Bank, whose own terms never confirm whether commercial reuse of the Key Policy Rate is permitted (a third-party government catalog tags it as open, but the bank itself doesn't say so).

**This is a two-line, fully reversible change.** All of Norway's fetchers (`ssb.ts`, `norgesbank.ts`), historical data, flag SVG, and map coordinates are **untouched**. To re-add:
1. Uncomment Norway's entry in `lib/markets.ts`'s `FALLBACK_MARKETS`
2. Add `"NO"` back to `MARKETS` in `app/api/refresh/route.ts` (line ~201)

Norway's technical notes, preserved for when it returns:
- SSB inflation: PxWebApi, **POST** (unlike every other fetcher), table `14700`. **The older table `03013` is CONFIRMED RETIRED as of Feb 2026.** Response is `json-stat2`.
- Norges Bank: SDMX-JSON, dataflow `IR`, key `B.KPRA.SD.R`. ⚠️ **Its response shape is NOT the same as ECB's** — Norges Bank wraps `dataSets`/`structure` under a top-level `"data"` key; ECB does not. Values are STRINGS, need `parseFloat`.

### 🌐 Shared across all markets
| Indicator | Institution | Fetcher | Notes |
|---|---|---|---|
| Brent Crude YoY (External & Commodities pillar) | U.S. Energy Information Administration | `eia.ts` → `fetchBrentYoY()` | v2 API, product facet `EPCBRENT`, series facet `RBRTE` (pinned deliberately). Monthly, YoY computed manually. **Fetched ONCE per refresh cycle in `GET()`, not once per market** — passed as a parameter into `fetchRawIndicators(market, brentYoY)`. |

---

## 5. METHODOLOGY (exact, from `lib/scoring.ts` — verified 2026-08-24)

```
PILLAR_WEIGHTS = { PS: 0.25, GM: 0.25, LM: 0.1875, MC: 0.1875, EC: 0.125 }

S_PS = clip(100 − 15 × |inflation − τ(market)|, 0, 100)  -- Price Stability, τ is PER-MARKET
S_GM = clip(50 + 10 × gdpGrowth, 0, 100)             -- Growth Momentum
S_LM = clip(100 − 10 × (unemployment − 2), 0, 100)   -- Labour Market
S_MC = clip(100 − 12 × |policyRate − 2.5|, 0, 100)   -- Monetary Conditions, neutral=2.5%
S_EC = clip(100 − 1.2 × |brentYoY|, 0, 100)          -- External & Commodities

MMAI = (Σ weight × pillar_score) / (Σ active weights)  -- reweights around any missing pillar
```

- **τ (inflation target) is per-market since 2026-08-31**, from `INFLATION_TARGET` in `lib/scoring.ts`. US/EA/UK/CA/JP = **2.0%**; **Australia = 2.5%**. Australia is the only one of the six whose central bank targets a *range* (2–3%); the RBA's own explainer states policy is set so inflation returns to the **midpoint**. Every value was read from the issuing institution on 2026-08-31 — do not change one without doing the same.
- **`computePillarScores(raw, market)` takes market as a REQUIRED argument.** Deliberately not optional-with-default: an optional one lets a call site silently score Australia against 2.0 while the refresh route uses 2.5, so stored and displayed scores disagree.
- **The US scores on headline PCE, not CPI** (`fetchUsPceInflation` in `lib/fetchers/bea.ts`), because the Fed defines its 2% objective on the PCE index. BLS CPI remains an automatic fallback. Measured 2026-08-31: PCE 3.70% vs CPI 3.36% — PCE was *above* CPI, the reverse of the long-run relationship, so never approximate one from the other.
- **Publication threshold:** coverage (populated pillars ÷ 5) must be ≥ **70%** (at least 4 of 5 pillars). Below that the composite is `null` and the site shows "N/A" rather than a misleading partial score.
- **Interpretation bands** (label only, **recalibrated 2026-08-31**): 85+ "Strongly Supportive" · 74+ "Supportive" · 55+ "Balanced" · 40+ "Challenging" · <40 "Highly Challenging". Was 80/65/45/30, which were invented: those put 63% of 173 historical market-years in one band and never once reached the bottom label, labelling US 2009 "Balanced". Calibrated against ten named episodes — see the change log.
- **Color is continuous, NOT banded** — see §6.
- The pillar weights and the 0–100 cap are now **published on the Learn page** (they were missing, which broke the "verify our math yourself" promise).

**Methodology history (do not re-litigate without discussion):**
- Originally a **6-pillar** spec including "Market Momentum" (equity-based). **Removed 2026-08-19** — no licensed equity data source exists. Its 20% weight was redistributed proportionally (`new = old / 0.80`), mathematically identical to the runtime missing-pillar reweighting, so all historical scores are numerically unchanged.
- Implements "Equations 1–7" from the external paper *"MMAI — Methodology, Statistical Properties, and Empirical Validation"* (v1.0). Equations 1–5 and 7 unchanged; Equation 6 went from six terms to five.

**Do NOT invent any pillar, formula, or weight not listed above.** `lib/scoring.ts`'s own header says: do not change without discussion.

---

## 6. DECISIONS ALREADY MADE (with reasoning)

**Color system (hard rule):**
- **No green, anywhere in the app.** Explicit, repeated user request.
- Gradient "Ember to Ice": Red `#E14B4B` → Orange `#F0975B` → Violet `#8B5CF6` → Cyan `#22D3EE`, interpolated continuously in `colorForScore()`.
- **Gold was deliberately removed** — interpolating gold→cyan in RGB passes through green as a mathematical side effect (scores 60–65 rendered visibly green). If a stop is ever added again, sample every integer 0–100 and verify no green-dominant output.
- Colors are **score-based everywhere** (`bandFor(score).color`). **The one deliberate exception is the Compare page's `MARKET_COLORS`**, because its purpose is tracking which line is which country over time.
- **Never hardcode a fixed identity color for a pillar or market** outside that exception — this caused a real bug (Growth Momentum always gold, Labour Market always red, regardless of performance).
- The last stray green (the "LIVE" badge on Trends) was removed 2026-08-24.

**Dark theme conventions:**
- Never use `background: "#fff"` or `background: "var(--ink)"` for a container — `--ink` means *light text color*, not *dark background*. This bug has recurred multiple times (Trends detail panel, Sources header, Learn cards).
- Native `<select>` needs explicit **solid** (not rgba) background + color on BOTH the `<select>` and its `<option>` children.

**Removed markets/pillars:**
- **UAE removed 2026-08-19** — no verified public policy-rate source; permanently failed the 70% coverage threshold. **Do not re-add without solving the policy-rate-source problem first.** (Re-confirmed 2026-08-28: still unsolved for the UAE specifically. BIS and IMF both lack a UAE policy rate, and CBUAE's own site is Cloudflare-blocked. Saudi's and Kuwait's rates WERE solved via BIS on that date — see §13 — so this rule now applies to the UAE and Bahrain only.)
- **Market Momentum pillar removed 2026-08-19** — see §5.
- **Norway removed from display 2026-08-22** — license, not technical. See §4.
- **FRED removed as a source 2026-08-22** — legal. See §4.

**Architecture decisions:**
1. **Reuse the generic World Bank fetcher** for a new market's GDP/unemployment rather than building country-specific fetchers. Trade-off (annual cadence, ILO modelled estimates) explicitly accepted and documented per-entry in `lib/sources.ts`.
2. **Per-indicator fault tolerance via `settle()`** in `refresh/route.ts` — wraps every fetch; one failed source returns `null` for that indicator instead of blanking the whole market. `computeComposite()`'s 70% coverage reweighting handles it.
3. **Supabase insert-error checking** — `supabase.from(...).insert(...)` does NOT throw on failure, it returns `{error}`. Both inserts run via `Promise.all`, both errors are collected, and a combined error is thrown if either failed. Before this fix, a failed write was silently reported as `status: "ok"`.
4. **`SOURCE_NOTES` partial-run labeling** — the stored `source_note` gets a `"— PARTIAL this run..."` suffix whenever any indicator (including Brent) came back `null`, instead of always claiming `"(live)"`.
5. **Brent fetched once per refresh cycle**, not per market — it's a single global input per Equation 5.
6. **The old `BRENT_YOY_PLACEHOLDER = -5` was REMOVED entirely**, not kept as a fallback. A stale hardcoded value silently pretending to be live data is exactly the bug class fixed in #3.

**Working conventions:**
- User is on **Windows**. Claude Code has direct file/repo access and commits+pushes directly, but **every commit and every push requires the user's explicit "GO" first, confirmed separately.** This has never been bypassed.
- **Standing review rule:** before writing ANY code, consult **Fable** for a plan review; after code is complete and before commit/merge, get Fable's review and approval. **Fable has been intermittently out of usage credits** — every time, ask the user "want me to use Opus instead, or wait?" **This is an established pattern, not a standing waiver** — keep asking each time, unless the user explicitly says to always default to Opus.
- `.claude/launch.json` and `.claude/dev-wrapper.cmd` are **never committed** (machine-specific paths). Deliberate, confirmed convention.
- GitHub CLI (`gh`) installed and authenticated as "Moshnib". Supabase MCP connector active (read-only) and **confirmed working**. **Vercel MCP connector still needs the user's own OAuth authorization** — until then Claude cannot query Vercel deployment status or logs directly.

**Rejected / superseded approaches (do not repeat):**
- FRED as any data source — ToS prohibits database storage.
- SSB table `03013` — retired Feb 2026. Use `14700`.
- `api.ons.gov.uk` — decommissioned 25 Nov 2024.
- Eurostat `geo=EA20` — wrong after 2026 (a 21st country joined; code is now `EA21`). Also needed a separate fix for aggregate publication lag.
- Assuming Norges Bank's SDMX-JSON matches ECB's shape — proven false.
- EIA filtering only on product facet — hardened to also pin `facets[series][]=RBRTE`.
- `className="wrap navbar"` in ComparePageInner — `"navbar"` doesn't exist in `globals.css`; the correct class is `"navrow"`.

**Countries researched but NOT added:**
- **Brazil** — workable, "likely yes." Banco Central do Brasil (Selic, no key) + IBGE (IPCA via SIDRA). Both under Brazil's federal Open Data Decree, but neither states "commercial use OK" in one explicit sentence. **Needs one more license-confirmation pass before building.**
- **New Zealand** — RBNZ returns 403 to default/no-User-Agent requests, 200 with a normal browser User-Agent. Fixable, not investigated further.
- **South Korea** — Bank of Korea ECOS requires a registered API key (~1,000 calls/day); commercial-reuse terms never confirmed from public docs.

---

## 7. IMPLEMENTATION STATUS

### ✅ DONE, COMMITTED, PUSHED, DEPLOYED, AND VERIFIED
- All **6 active markets** (US, Euro Area, Canada, UK, Japan, Australia) fully live on all 4 per-market indicators plus shared Brent. **No placeholder data anywhere in the scoring pipeline.**
- BEA (US GDP growth) + EIA (Brent Crude) — committed `b74dde1`, 2026-08-22. Both API keys are in Vercel.
- Full legal/licensing review of all 17 institutions; FRED dropped; RBA/BoC/BoJ/Norges Bank license text corrected.
- **Daily cron confirmed firing unattended** — verified twice (Aug 23 and Aug 24).
- Overview, Trends, Compare, Sources, Learn, Contact pages all render live data.
- Site audit fixes: pillar weights + 0–100 cap published on Learn; Overview pillar weights no longer sum to 101%; last green removed; favicon replaced (was still the Next.js starter logo); social sharing cards added; Sources institutions clickable (all 16 verified); branded 404; per-page titles/descriptions; robots.txt; sitemap.xml; h1 on Compare; `/trends` no longer sends a blank page to crawlers.
- **Canada's GDP figure fixed** — demo data said 3.4% against a real World Bank value of 1.74%, which alone put Canada top of the rankings. All fallback figures now synced to the live database.
- CSV export (`ExportDataButtons`), live "last updated" footer, rate-relationship narrative, historical extremes, Policy Rate / Inflation / Unemployment comparison chart, current stat row on Overview.
- Email subscribe/unsubscribe routes and band-crossing detection **built** (not activated).

### ⬜ NOT STARTED / OPEN
1. **Send the Norges Bank email** — draft saved as `mmai-app-norges-bank-email-draft.txt`. No rush while the site stays non-commercial.
2. **Bank of Japan permission** — required before any monetization. Not an issue today.
3. **Activate Resend email alerts** — needs a free Resend account, `RESEND_API_KEY` in Vercel, and a verified sending domain. `lib/notify.ts` currently hardcodes an unverified `alerts@mmai-app.vercel.app`, so nothing can actually send. Never tested end-to-end.
4. **Add `BEA_API_KEY` / `EIA_API_KEY` to local `.env.local`** if you want local testing to match production.
5. **Chart-labeling bug (minor, not urgent):** every indicator is stamped with today's date when saved, even when the real data is a year old (true for any annual source — World Bank etc.). This makes an annual number look like it changed "this year" on trend charts when it didn't. **Does not affect scores**, only the x-axis label. A real fix means using each source's own reported date when saving.
6. **Two audit findings deliberately left undone** (judgement calls, not oversights): markets use slightly different conventions for the same indicator (US policy rate is an annual average, UK/Australia are year-end; US inflation is monthly, Japan's is an annual estimate); and the Overview page makes two database queries where one would do. Neither is wrong or visitor-visible.
7. **Brazil as market #8** — needs the license double-check.
8. **Domain name decision** — keep `mmai-app.vercel.app` or buy something. `marketpuls.com` was discussed: reasonable, but the missing "e" reads as a typo and "Market Pulse" is generic. Worth weighing against something built around "Moshnib"/"MMAI". **No decision made.**
9. **Complete Vercel MCP connector OAuth** (user action, via claude.ai connector settings).
10. **Upgrade Vercel to Pro** the moment the site generates revenue (Hobby tier forbids commercial use).

---

## 8. KNOWN PROBLEMS / ACCEPTED LIMITATIONS

1. **Local `.env.local` has PLACEHOLDER Supabase credentials.** Local refresh testing proves fetching works, not writing. "Supabase write failed" locally is expected. Use the Supabase MCP connector to verify real writes instead.
2. **Accepted limitation (not a bug):** Canada/UK/Japan/Australia GDP and unemployment (and Japan's CPI) are annual-cadence ILO/World Bank modelled estimates, not each country's own official monthly figure. Documented per-entry in `lib/sources.ts`.
3. **Accepted limitation:** Norges Bank's license is genuinely unresolved — recorded honestly as "Unresolved" rather than assumed. This is why Norway is currently hidden.
4. **Bank of Japan commercial-use gate** — tracked, not yet an issue.
5. **Browser-testing tool artifact (not a code defect):** the automated browser tool can show a page stuck on a Suspense "Loading…" fallback even when the DOM is complete and correct. Confirmed by inspecting `document.body.innerHTML` directly during an extensive bisection. **Never conclude a page is broken from the tool's visible-text or screenshot output alone** — inspect the raw DOM via JS first.
6. **Fixed since the last handover:** the `href="\trends"` backslash nav typo is **gone** (verified 2026-08-24, no matches in `app/` or `components/`).

---

## 9. THINGS A NEW CHAT MUST NOT DO

1. **Do NOT commit or push without the user's explicit "GO"** — confirmed separately for each. Never bypassed.
2. **Do NOT skip the Fable-or-approved-substitute review gate.** If Fable is out of credits, ASK each time whether to substitute Opus. Do not assume, do not skip.
3. **Do NOT reintroduce FRED** as a data source — their ToS prohibits storing data in a database.
4. **Do NOT re-add UAE as a scored market** without solving the policy-rate-source problem — but re-adding UAE as a **non-scored Gulf Watch panel entry** (see §11) is the sanctioned, already-planned path forward, not a violation of this rule.
5. **Do NOT re-add Market Momentum** as a 6th pillar without a licensed equity source.
6. **Do NOT re-enable Norway** until Norges Bank confirms the license in writing.
7. **Do NOT use green anywhere in the UI.** If adding a gradient stop, verify across the full 0–100 range first.
8. **Do NOT hardcode per-pillar or per-market identity colors** outside the Compare page's `MARKET_COLORS`.
9. **Do NOT use `var(--ink)` or `#fff` as a container background** — `--ink` is a light *text* color.
10. **Do NOT assume two "similar" APIs share a response shape** (proven false for Norges Bank vs. ECB, both SDMX-JSON). Fetch and inspect the real response first.
11. **Do NOT trust `res.ok` alone for BEA** — it returns HTTP 200 on errors; check `BEAAPI.Error` in the body.
12. **Do NOT reintroduce a stale hardcoded fallback** that silently pretends to be live data. Return `null` via `settle()`, let coverage reweighting handle it, mark the run PARTIAL.
13. **Do NOT skip the standalone-fetcher-live-test** before wiring any new fetcher into `refresh/route.ts` — this has caught a real bug every time it's been followed.
14. **Do NOT conclude a page is broken from the browser tool's screenshot alone** — see §8.5.
15. **Do NOT enter passwords or complete third-party signups on the user's behalf.** The user has personally registered every API key and account. This must continue.
16. **Do NOT hand-edit the auto-regenerated block in `AGENTS.md`** — `next dev` regenerates it; committing it as-is is correct.
17. **Do NOT re-litigate the scoring formulas, weights, or pillar definitions** in §5 without explicit discussion.
18. **Do NOT remove the "not an investment signal" disclaimer** or the NY Fed reference-rate notice.

---

## 10. INSTRUCTIONS FOR THE NEXT AI SESSION

You are continuing an active, healthy, fully-deployed project. Read this entire document before acting.

1. **There is no unfinished work.** As of 2026-08-24 the tree is clean, `main` is level with `origin/main`, typecheck and build pass, the live site is up, and the daily cron is confirmed running unattended. Do not go looking for a pending commit — the previous handover's "urgent uncommitted BEA/EIA work" was committed on 2026-08-22.

2. **Read `MMAI_TODO.md` first** for what to actually do next — it's the plain-language running list and is kept more current than this document.

3. **The user is a non-developer with no coding knowledge.** Explain everything in plain language. Don't assume familiarity with code, APIs, or terminal commands.

4. **The review gate is real:** consult Fable before writing code, and again before committing. If Fable is unavailable, ask the user whether to substitute Opus.

5. **Never commit or push without an explicit "GO"**, confirmed separately for each.

6. **Before wiring any new external API:** research the real endpoint, verify it live with actual HTTP calls (never assume from docs or a "similar" fetcher), write a standalone test hitting the real API, then integrate following the existing pattern (one async function per fetcher, throws on failure, wrapped in `settle()` one layer up).

7. **Check licensing before building any new data source.** This project has already had to remove one source (FRED) and hide one market (Norway) over license terms. Confirm commercial-reuse permission from the institution's *own* pages, not a third-party catalog.

8. **Keep the docs in sync.** `lib/sources.ts` is the single source of truth for what's live. When work lands, update `MMAI_TODO.md` and this file.

9. **Do not restart or redesign completed work.** All 6 markets, all pillars, all formulas, and the entire refresh/Supabase/UI pipeline work and are reviewed. Build incrementally.

10. **When unsure what's already decided**, search §6 and §9 before asking the user to re-decide something settled.

---

## 11. GULF WATCH (started 2026-08-25, fully live as of 2026-08-26)

**Status as of this handover: fully live, debugged, and expanded.** The page exists at `/gulf-watch`, shows real live data for all 6 countries, has years of historical trend charts and a cross-country comparison table, and is linked from a homepage widget and the site nav. §11.1-11.6 below are the original build log (kept for the data-source reasoning, still accurate); §11.7 onward covers everything that happened after the page went live. A future session can resume entirely from this section, no external file needed.

### 11.1 What it is and why

MMAI's 6 scored markets all have complete data for all 5 pillars. Extensive research found that several Gulf countries have *some* clean, legal, live data (inflation, GDP growth, unemployment, and for some, real estate/FX data) but were missing an automatable policy rate. Rather than repeat the mistake that got UAE removed (forcing incomplete data into a scored market), the plan is two-pronged:

> **⚠️ This paragraph's original reasoning is now OUT OF DATE — read §11.9 before acting on it.** It said Gulf countries "can never hit the 70% coverage threshold" because no policy rate was available. That stopped being true on 2026-08-26, when BIS came online for Saudi Arabia (repo) and Kuwait (discount) — those two now have all five pillars and *could* be scored. They are still deliberately unscored, but for a completely different reason, recorded in §11.9. Do not enable Gulf scoring on the strength of "the data is available now."

- **Gulf Watch panel** — UAE, Bahrain, Qatar, Kuwait, Oman, Saudi Arabia, each shown honestly with real live indicators (cost-of-living CPI, investment-confidence real estate where available, currency-stability FX reserves/current account) and **explicitly no composite score**.
- Oman was originally going to be built as a genuine 7th *scored* market (it has all 4 indicators, unlike the other five) — **the site owner chose to set this aside for now**, so Oman ships as a panel country like the rest, not a scored one. This can be revisited later; nothing about the panel plan blocks it.

The site owner lives in the UAE and specifically wants it represented prominently even without a score — this drove the "show honestly, no fake score" approach rather than leaving UAE out entirely.

### 11.2 The two blocking unknowns — BOTH NOW RESOLVED

1. **Oman's policy rate licensing** — resolved but moot since Oman was set aside as a scored market. For the record: the repo-rate data is genuinely sourced from the Central Bank of Oman, republished by Oman's National Centre for Statistics and Information on Oman's national open-data portal under Oman's government-wide Open Government License (already confirmed elsewhere on that same portal to permit commercial reuse and database storage). This is *not* the same risk shape as FRED — FRED was a private/quasi-restrictive redistributor with its own conflicting terms; here it's one arm of the Omani government republishing another arm's data under one unified, already-permissive national licence. If Oman is revisited as a scored market later, this licensing question is already answered.
2. **Saudi Arabia's central bank/open-data-portal connectivity** — **confirmed unreachable**, tested directly from the live production site (not local dev, which gave an ambiguous result). A temporary diagnostic route (`app/api/diag-saudi/route.ts`, built and removed same-day, commits `bbd4f0d` → `9f5e448`) hit SAMA, Saudi's open-data portal, and GASTAT (as a control) from Vercel's actual servers. Result: SAMA and the open-data portal both failed to connect; GASTAT (Saudi's statistics office) responded normally. This settles it — Saudi's policy rate isn't available *from SAMA or Saudi's own open-data portal*. Saudi ships as a panel country using GASTAT (CPI) and KAPSARC (a free re-publisher of Saudi's official REGA real-estate index). **Superseded 2026-08-26:** the rate is available after all, from BIS, which republishes SAMA's own official market repo rate (4.25%) — see §11.8. The finding above stays accurate about SAMA's own endpoints; the conclusion drawn from it did not survive checking a third-party republisher.

### 11.3 Full data-source picture (all verified live, not assumed — updated after actually building each fetcher)

| Country | Inflation (CPI) | Real estate | GDP/Unemployment |
|---|---|---|---|
| UAE | ✅ **Built** — `lib/fetchers/worldbank.ts` `fetchInflation("ARE")`. **FCSC was abandoned, not used** — its data API turned out to be behind genuine Cloudflare Bot Management (fingerprint-level, not just a header check); getting past it would mean deliberately spoofing a browser's network fingerprint, which isn't something to do even for legally-licensed data. `lib/fetchers/fcsc.ts` was built, confirmed broken, and deleted — don't rebuild it without a genuinely different approach. | ❌ Confirmed blocked — free path is reCAPTCHA-protected (not attempted), paid path is a Dubai trade licence + AED 30,000/year via DLD's API Gateway. | World Bank |
| Bahrain | ✅ **Built** — `lib/fetchers/bahrainCpi.ts`. data.gov.bh (OpenDataSoft, no key), dataset `06-percentage-change-from-previous-year`, already gives a pre-computed YoY % field. Watch for: the API's default sort only orders by year, not month — must explicitly sort both. | Investigated, not built: Survey and Land Registration Bureau (SLRB) has real data but only via scraping a legacy ASP.NET page (VIEWSTATE postback), and it isn't covered by the confirmed data.gov.bh licence since it lives outside that catalog entirely. **Agreed to skip for now.** | World Bank |
| Qatar | ✅ **Built** — `lib/fetchers/qatarCpi.ts`. data.gov.qa (Opendatasoft v2.1), dataset `consumer-price-index-cpi-by-expenditure-group-monthly`, `group_code="0"` for the headline figure. Returns a raw index, not a %, so YoY is computed manually (same pattern as `eia.ts`/`statcan.ts`). Same month-sorting quirk as Bahrain, worse — month is an English abbreviation, not zero-padded, so it doesn't even sort correctly as text. Unemployment ~0.1% is real (confirmed by Qatar's own statistics authority), just structurally low due to the migrant-labor-visa economy — needs a one-sentence caveat if ever shown, not a different source. | ✅ **Built** — `lib/fetchers/qatarRealEstate.ts`. Ministry of Justice dataset `weekly-real-estates-sales-bulletin` (name differs from earlier guesses) — raw per-transaction data despite the name, "weekly" is the publish cadence not the row granularity. Two-step fetch: find the latest available date, then use the API's own server-side `count()` to aggregate that month's transaction count. | World Bank |
| Kuwait | World Bank only — no dedicated national source found. | None found — ships with `real_estate_value: null`. | World Bank |
| Oman | World Bank (`fetchInflation("OMN")`) — used for consistency with Kuwait, not the more precise NCSI monthly source (NCSI/CBO integration was researched and cleared legally but never built into a fetcher, since Oman was set aside as a scored market before it was needed). | Not researched. | World Bank |
| Saudi Arabia | ✅ **Built** — `lib/fetchers/datasaudi.ts`. **GASTAT's own site turned out to be PDF/Excel-only with unpredictable URLs, and their real API portal requires Nafath (Saudi national ID) or Iqama-based registration — not achievable for the site owner, who isn't a Saudi resident.** The actual source used instead: **Data Saudi** (`api.datasaudi.sa`, Ministry of Economy & Planning), a genuine structured API (Datawheel's Tesseract engine) that republishes GASTAT's own figures, cube `gastat_inflation`. No signup. Licence status: no explicit restriction found anywhere (unlike KAPSARC below), `robots.txt` explicitly allows automated access — but the one page that would give a definitive written answer is itself Cloudflare-blocked, so this is treated the same way Bank of Japan's rate already is in this project: fine for non-commercial use now, a confirmation email has been sent (same approach as Norges Bank), must be resolved before monetizing. | Not yet resolved — see below. | World Bank |

**Saudi real estate (KAPSARC) — still an open decision, not yet built:** the *correct* current dataset was identified (`real-estate-price-index-by-sector-2023-100` on `data.kapsarc.org` — the older `datasource.kapsarc.org` series prior research pointed at is discontinued, stopped updating in early 2025). But KAPSARC's actual Terms of Use explicitly **prohibit automated/robotic access without written permission**, directly contradicting the dataset's own "Public Domain" tag — the same shape of contradiction as an unrelated crypto-data provider investigated earlier this project. **Do not build against this without either (a) written permission from KAPSARC, or (b) the site owner explicitly deciding to skip it**, same as Bahrain's real estate. Ask before proceeding either way.

### 11.4 The plan review — findings and their fix status

Per the standing Fable-review rule, the first draft of this plan was reviewed by Opus (Fable was out of credits — user confirmed substitute) **before any code was written**. The review sent it back with real, blocking issues.

1. ✅ **FIXED (live, commit `7a2b2c0`).** The daily refresh job's timeout risk — `export const maxDuration = 60;` added to `app/api/refresh/route.ts` (and to `app/api/refresh-gulf/route.ts` from the start), plus `AbortSignal.timeout(8000)` in every new fetcher.
2. ✅ **FIXED (live, commit `7a2b2c0`).** The dormant "stale market shows old fallback data under a LIVE banner" bug in `app/page.tsx`/`components/SiteFooter.tsx` — a market with no row, or nothing newer than 72 hours, now shows honestly as N/A via the site's existing coverage-threshold display, and the footer surfaces a "N markets not currently refreshing" note when this happens. Verified against real production data (all 6 markets were under 10 hours old at the time) to confirm nothing healthy gets misclassified.
3. ✅ **Honored, with one exception.** Every fetcher built is named for and sourced from the actual originating institution — except Saudi's, which had to pivot to Data Saudi (Ministry of Economy & Planning) after GASTAT's own site turned out to require Nafath/Iqama registration not achievable for the site owner. This is a deliberate, documented exception (see §11.3), not a lapse of the rule.
4. ✅ **Done.** `gulf_indicators`' `CHECK` constraint (real estate value requires a label) is live in the schema. The Norway name-mismatch bug mentioned by the review was **not yet separately fixed** — worth a follow-up check.

**Scope cuts from the review, still in effect:** no Gulf-region map component (cards carry the feature, not a map). Saudi Arabia will not be promoted to a scored market #8 as part of this release even though its connectivity is resolved — deferred to a separate future change.

### 11.5 Build order and actual progress

1. ~~Phase 0: resolve the two unknowns~~ — **done**.
2. ~~Phase 1: Oman as scored market #7~~ — **set aside** on the site owner's call; Oman is a panel country instead.
3. **Phase 2 — DONE.** `gulf_indicators` table: live (applied manually via the Supabase SQL Editor, since this project's MCP connection is read-only — confirmed by a failed direct `CREATE TABLE` attempt; one column was renamed post-creation, `fx_reserves_usd_bn` → `fx_reserves_months_imports`, after catching that the original name didn't match the actual World Bank indicator, done before any real data existed in it). All indicators built and verified live for all 6 countries across all 3 pillars (see §11.3 for exact files and any deviation from the original planned names — several diverged from the plan's guesses, e.g. `qatarCpi.ts`/`qatarRealEstate.ts`/`bahrainCpi.ts`/`datasaudi.ts`, not the `*-psa.ts`/`gastat.ts` names originally planned; the two currency-stability functions were added directly to the existing `worldbank.ts` rather than new files). `lib/gulfSources.ts` (the sources registry) — **built in Phase 3** (commit `4afb029`); this line said "not yet built" until 2026-08-28, when a source-registry audit caught that it had shipped and the Phase 2 note was never updated. `app/api/refresh-gulf/route.ts` — **built, deployed, and confirmed end-to-end**: manually triggered the live route with the correct `CRON_SECRET` and checked the actual `gulf_indicators` rows afterward (not just the route's "ok" response) — every country's CPI, FX reserves, and current account balance all landed correctly, Qatar's real estate too. `vercel.json` — second cron entry added, `20 6 * * *`, 20 minutes after the main refresh; this uses Vercel Hobby's second and last available cron slot.
4. **Phase 3 (UI) — DONE.** `components/GulfCard.tsx`, `app/gulf-watch/page.tsx` + `GulfWatchPageInner.tsx`, nav links on all files, `/sources` Gulf section, `ExportDataButtons.tsx` widened — all live. See §11.7 for what happened after this shipped.

### 11.6 Security finding (2026-08-26) — unrelated to Gulf Watch, found while testing it

While manually triggering `/api/refresh-gulf` to verify its database writes, discovered that **`CRON_SECRET` was not actually being enforced on either refresh endpoint** — every request succeeded regardless of what secret was sent, including none at all and a deliberately wrong one. This predates Gulf Watch entirely and affected the pre-existing `/api/refresh` route too (confirmed by testing it the same way). Root cause unconfirmed — Vercel's "Secret" type environment variables can never be viewed again once saved, so there was no way to inspect what was actually stored; most likely corrupted when it was last changed on 2026-08-22. **Fixed**: the site owner deleted and recreated `CRON_SECRET` in the Vercel dashboard with a known value (`mmai-verify-2026`) and redeployed. Re-verified after: both endpoints now correctly return 401 for missing/wrong secrets and 200 only for the right one.
4. **Phase 3: UI.** `components/GulfCard.tsx` (flat card, modeled on `CompareGrid.tsx` not `PillarGrid.tsx`, since there's no score to put in a ring), `app/gulf-watch/page.tsx` + `GulfWatchPageInner.tsx` (thin-wrapper + Suspense pattern, same as `app/compare/`), nav links added to all 7 files that currently duplicate nav markup (there's no shared nav component — confirmed and accepted as out of scope for this feature), a second `SourcesTable` block on `/sources` for Gulf entries, and `ExportDataButtons.tsx` updated so its "nothing held back" claim stays true once Gulf Watch ships.
5. **Phase 4: polish** — full unattended cron cycle confirmed for both refresh routes before calling it done, same standard already applied to the main 6-market cron.

### 11.7 Going live, and a genuine multi-layer production bug

Once §11's Phase 3 UI shipped, the page loaded but showed stale/placeholder data. Three separate real bugs, found and fixed in sequence, not one:

1. **Sort-order bug.** `gulf_indicators` queries sorted by `observation_date` first, `fetched_at` second. A failed fetch's `observation_date` fell back to "today," which sorted *ahead* of real successful data with an earlier real reporting date. Fixed: sort strictly by `fetched_at` descending in `GulfWatchPageInner.tsx` and the Gulf path of `SourcesTable.tsx`.
2. **Vercel CDN cache staleness.** After the sort fix deployed, `Age` kept climbing with `X-Vercel-Cache: HIT` — the edge was serving a pre-fix response despite a newer deployment being live. Fixed by a manual "Redeploy" from the Vercel dashboard.
3. **Root cause: an unnecessary `<Suspense>` boundary.** Even with fresh cache, the page still showed placeholder data. `app/gulf-watch/page.tsx` had copied Compare's `<Suspense>` wrapper, which Compare needs for `useSearchParams()` — Gulf Watch doesn't use that hook, and the wrapper was silently preventing `GulfWatchPageInner`'s `useEffect` from ever firing in production. Confirmed via a temporary debug banner showing the effect never ran, compared against `SiteFooter`'s effect (outside any Suspense boundary) firing correctly on the same page. Fixed by removing the Suspense wrapper entirely. Verified live end-to-end afterward: all 6 countries showing correct real data.

### 11.8 Expansion: Learn More, homepage widget, historical backfill + charts

After the page was live and confirmed working, the site owner asked for: historical data/trends, comparison, "what these numbers mean" explanatory text, a prominent homepage entry point, an active map, and Gulf-themed colors on the Gulf Watch page — plus renaming/expanding the "Learn" page into one unified page covering both the scored markets and Gulf Watch (final name, chosen by the site owner: **"Learn More"**).

Shipped, in this order:
1. **"Learn More" rename + Gulf content** — nav label changed site-wide (8 files), and `app/learn/page.tsx` extended with a new "Gulf Watch (non-scored)" section: cost-of-living, investment-confidence, currency-stability, and why there's no composite score — same plain-language voice as the existing pillar topics.
2. **Homepage widget, round 1** — a full-width banner in the main content flow, gold-themed icon. **Site owner feedback: it broke the page's reading flow.**
3. **Homepage widget, round 2** — moved out of the main flow entirely into a floating side card (`.gulf-float` in `app/globals.css`, `components/GulfMapIcon.tsx`): fixed, right-docked, vertically centered on desktop; a bottom bar on mobile. Icon redesigned as a stylized Gulf "map" (sand/turquoise, not traced from real borders — `lib/mapdata/world-paths.json` has no Bahrain polygon and near-illegible Qatar/Kuwait shapes at small size) with all 6 flags placed on it. **Site owner feedback after this shipped: still not happy with the design, will revisit later — do not treat this as final.** (Saved as its own memory entry outside this doc; check with the site owner before assuming any specific redesign direction.)
4. **Historical backfill + trend/comparison charts** — the big one. `lib/gulfHistory.ts`, a generated static file (same philosophy as the hand-curated `lib/history.ts`), holding years of real CPI/FX-reserves/current-account/Qatar-real-estate history for all 6 countries. Regenerable via `scripts/backfill-gulf-history.ts`; never touches Supabase. New `GulfTrends.tsx` component: per-country trend charts (own real axis per country, gaps rendered as gaps) plus a snapshot comparison table with every figure labeled with its own real period.

   This went through **three review rounds** (two pre-code, one post-code — Fable was out of credits, Opus used as the standing substitute, per §9's rule) and caught real, would-have-shipped problems worth remembering if this data is ever touched again:
   - **Writing history into the live `gulf_indicators` table would have corrupted the current-snapshot query** (backfill rows would get `fetched_at = now()` and jump to the top of the "latest" sort) — resolved by using a static generated file instead, never writing to Supabase at all.
   - **Saudi's CPI source returns 12 fake `0.0%` months for all of 2013** — a base-year artifact of its own year-over-year calculation, not real data (real 2013 Saudi inflation was ~3.5%). Dropped before writing (`dropLeadingZeroRun` in `lib/fetchers/historyUtils.ts`).
   - **A first-draft "is this month complete" rule for Qatar's real estate data would have deleted the single busiest month in the entire 6-year series** (August 2020, 852 transactions) because it started late for Eid — the correct signal turned out to be *only* whether the month reaches the calendar month's end, not how early it starts or how many distinct days it has (both of those false-positive on real Eid closures). Final rule and the reasoning for rejecting the alternatives are documented directly in `lib/fetchers/qatarRealEstate.ts`'s `isCompleteMonth`.
   - **Kuwait's FX reserves/current account has a real 2-year gap, 1990-1991** — lines up exactly with the Iraqi invasion and liberation of Kuwait. Genuine missing data, not a fetcher bug; renders as an actual gap in the chart (`connectNulls={false}`), not a smoothed-over line.
   - A chart bug where an isolated real data point (a real month with no neighboring data) would render as literally nothing with dots disabled — fixed by keeping dots visible on all Gulf charts.

### 11.9 What's left for Gulf Watch

**0. Composite scoring for Gulf — DECIDED 2026-08-28, do not re-open casually.**

The site owner's decision: **leave every Gulf country unscored for now**, and revisit only as a *separately labelled group* once there is a labour-market indicator worth trusting. Never rank Gulf countries against the developed markets in the same table.

Why this needs stating explicitly: as of §11.8/§14 the data-availability objection is **gone**. Saudi Arabia and Kuwait have all five pillars (BIS policy rates), so the engine *would* happily produce a composite for them. The reason not to is no longer technical.

A feasibility check run before the decision found **all six Gulf countries would score roughly 81-91** — above every scored market (US 78.5, Euro Area 79.2, Japan 79.1, UK 76.9, Canada 75.5, Australia 74.7). That is not a bug in the arithmetic; it is the Labour Market pillar working exactly as designed on an input that doesn't mean the same thing in the Gulf. The pillar rewards low official unemployment, and Gulf unemployment is low substantially because of how migrant labour is counted, not because those labour markets are stronger than Germany's. Publishing "Saudi Arabia 88, United States 78.5" would be indefensible to any informed reader, and MMAI is going to FINTECH.TV.

Three options were put to the owner: (1) leave unscored, (2) adapt the methodology for Gulf, (3) score but present as a clearly separate group. The owner chose the recommendation of **(1) now, (3) later**. Option (2) is genuine research, not a sprint — it needs a defensible alternative labour measure (participation rate? national-vs-expatriate breakdown?) and a public explanation of why two methodologies coexist.

**Trigger to revisit:** a labour indicator for Gulf countries that is live, legally usable, and economically comparable. Until then, the honest position is the current one. If a future session is tempted to enable Gulf scoring, re-read this entry first — the tempting argument ("the data is all there now!") is precisely the one that was already considered and rejected.

1. ~~**Homepage widget redesign**~~ — **done, see §12.** The floating card is gone; Gulf Watch now has a real section on the homepage.
2. **Interactive Gulf map** — deliberately deferred twice now (original Phase 3 scope cut, and again during the §11.8 expansion) because the site's real map data can't represent all 6 countries legibly. Last item in the site owner's agreed build order.
3. **Saudi real estate (KAPSARC)** — still an open decision, not built. See §11.3's note: KAPSARC's Terms of Use prohibit automated access without written permission, contradicting the dataset's own "Public Domain" tag. Needs either written permission or an explicit site-owner decision to skip.
4. **Bahrain real estate** — site owner explicitly said to skip/deprioritize this one (SLRB's data isn't covered by a confirmed open licence anyway).
5. A live overlay unioning `lib/gulfHistory.ts`'s static backfill with the daily cron's ongoing `gulf_indicators` writes (mirroring `useLiveHistory.ts`'s existing pattern for the 6 scored markets) was intentionally scoped OUT of §11.8 — the backfill's charts currently read only the static file, not live data. Worth doing once the daily cron has accumulated enough of its own history to matter. Note if this is ever built: `app/api/refresh-gulf/route.ts` currently stamps every indicator in a row with the *CPI's* observation date, not each indicator's own — a live overlay keyed on that shared date would misfile FX-reserves/current-account/real-estate figures under the wrong period. Fix that stamping first.

## 12. Homepage restructure, Weekly Feed, and the map redesign (2026-08-27)

The site owner flagged real redundancy on the homepage: the pillar breakdown, a heat map, and a "cross-market view" grid were three overlapping ways to do the same "pick a market, see its score" job, the floating Gulf Watch widget (§11.8) was still unliked, and there was no way to see what changed week over week. Planned via `EnterPlanMode`, reviewed pre-code by Opus (Fable substitute, per §9's rule), then built.

**Homepage restructure (`app/page.tsx`).** Deleted `components/CompareGrid.tsx` and `components/Heatmap.tsx` outright (confirmed zero other references first) — both were second/third copies of the market-select flow already covered by the hero tabs. `WorldMap`'s `onSelect` now calls `router.push(\`/trends?market=\${code}\`)` instead of updating in-page state, turning the map into a launch point into the deep-dive page rather than a third selector. New sections, in order after the existing hero + pillar breakdown: a map section ("See how the other N markets are doing"), a real Gulf Watch card section (replacing the floating widget — `GulfMapIcon.tsx` deleted too), and a new Weekly Feed section, before `SubscribeForm`.

**Weekly Feed (`lib/weeklyChanges.ts`, `components/WeeklyFeed.tsx`).** Shows each scored market's composite + 5 raw indicators, this fetch vs. roughly a week earlier, plain ↑/↓/— with no color on the indicator deltas (color-coding "unemployment rose" as good or bad would be exactly the interpretation this feature exists to avoid) — only the composite delta may use `colorForScore()`. Built on `raw_indicators` directly (append-only, no dedup). A first-draft "just compare rows ~6 days apart" design was checked against live data before being built and would have published fabricated deltas from fetcher source-swaps, not real economic changes — so the shipped version gates every comparison behind: a hard `COMPARABILITY_FLOOR` timestamp (rows before the last source swap aren't comparable to rows after it), a 72h staleness check, a 6–10 day bucket-gap window (so a stalled/retired market's old rows never get labeled "last week"), and a full-population requirement (all 5 indicators non-null — a partial row has different pillar coverage than a full one, so comparing them is a fake delta even with zero real change behind it).

The post-code Opus review pass caught two real bugs in this first version, both fixed same-session:
- **`isStale` was computed from the *filtered* newest bucket, not the market's actual newest row.** That meant a market writing full rows on schedule — refreshing correctly — could get mislabeled "not currently refreshing" for days after `COMPARABILITY_FLOOR` moves (every row temporarily fails the floor filter) or whenever its most recent rows happened to be partial. Fixed by querying the true newest row per market (scope-only, no floor/population filter) in a separate lightweight query, and keeping "not enough history yet" as the distinct, correct message for the floor/population case.
- **The Brent-crude delta compared "now" and "then" from two different markets' independently-newest rows**, and a missing delta rendered as a bare "—" — which in this feature's own vocabulary means "genuinely flat," not "unknown." Fixed: the delta now requires both values from the same market's paired buckets, and an unpaired state renders "no comparison yet" instead of a silent false "—".
- Also fixed in the same pass: the `QUERY_ROW_LIMIT` (200) cap now applies server-side, scoped/floor/population-filtered, so the budget is spent only on rows that can become a bucket instead of being burned on retired markets or partial rows during a burst-write day.

**`lib/useGulfIndicators.ts`** (new) extracts the Gulf Watch Supabase fetch (previously inline in `GulfWatchPageInner.tsx`) so both `/gulf-watch` and the homepage's new Gulf section read the exact same live data the exact same way — same `fetched_at`-only ordering (never `observation_date` first; that was the §11.7 sort-order bug, and reintroducing it "for consistency" would bring it back), same `.limit(60)`, same latest-row-per-country dedup.

**`lib/constants.ts`** (new) hoists `STALE_THRESHOLD_MS` (72h) out of what were three separate copies (`app/page.tsx`, `components/GulfCard.tsx`, `components/SiteFooter.tsx`) into one place — the third copy (SiteFooter's) was missed in the first pass and caught by the same review; all three now import from here.

**`.compare-grid` (`app/globals.css`)** changed from a 5-column responsive grid to 3 columns (→2→1 on smaller widths) — it's now used exclusively by the two 6-card Gulf Watch grids (`/gulf-watch` and the homepage section), and 5 columns orphaned the 6th card.

**WorldMap visual redesign (`components/WorldMap.tsx`).** Went through several owner-reviewed rounds — mocked up as real interactive HTML pages (published as Artifacts, not static images, since the owner specifically wanted to see it move, not just look at it) rather than built blind:
- Round 1 offered three distinct treatments (glow/pulse, terminal-readout panel, dim-until-hover). Owner feedback: **"too busy / cluttered"** and **"doesn't feel like a real map."**
- Round 2 stripped it to one plain choropleth-style map — color only, a single small cursor tooltip, no floating pills/glow/panels. Owner feedback: **"closer."**
- Round 3 addressed three specific asks: bigger (cropped the viewBox to cut the empty Antarctica band at the bottom, `worldPaths.height` 480 → `CROP_HEIGHT` 420, so the six real markets fill more of the frame off the same underlying geometry), scores visible without hovering (moved from the earlier floating-pill treatment straight to a plain always-visible number with a dark stroke-halo for legibility against same-colored country fill), and a choice between three color schemes shown side by side on the real map with real live scores. Owner picked **Option 1 — the site's existing `colorForScore()` gradient**, so no color system change was needed anywhere.

The shipped version: cropped map, always-visible score labels, single hover tooltip (name + band only, not the number — it's already on the map), click still navigates to `/trends?market=CODE`.

The post-code review caught one real regression here: **the a11y relabel from §12's own click-behavior change (value → navigation action) had accidentally dropped the score out of the accessible name entirely** — `aria-label` overrides descendant text, so a keyboard/screen-reader user got "View United States on the Data Over Time page" with no number and no band, on the one page whose entire purpose is that number. Made worse by Euro Area's 11 constituent-country paths each carrying an identical focusable label (11 duplicate tab stops for one market). Fixed: country `<path>` elements are now `tabIndex={-1}`/`aria-hidden` (mouse/touch-only — the map's real visual, not a focus target), and the one score `<text>` label per market (plus the legend entry below it, which now also shows the score) carries the full accessible name — e.g. "View United States, score 78.5, Supportive, on the Data Over Time page" — restoring WCAG 2.5.3 (Label in Name) compliance and cutting Euro Area from 11 tab stops to 1.

## 13. Two post-launch fixes: honest empty-state messaging, and the scatter plots (2026-08-27)

**Weekly Feed "looks idiot" when empty.** The morning after §12 shipped, every market correctly showed "not enough history yet" (real: verified live that every market's earliest fully-comparable row is 2026-08-22 ~06:15 UTC, when all six sources went live together — a real week-over-week comparison needs a 6+ day gap, so nothing qualifies until ~2026-08-28) — but the page gave no reason to believe that was expected rather than broken. Fixed in `lib/weeklyChanges.ts` (exported `COMPARABILITY_FLOOR` and `BUCKET_MIN_GAP_DAYS`) and `components/WeeklyFeed.tsx`: a banner and each "not enough history" row now state the real tracking-start date and the real expected-first-comparison date, computed from those same constants rather than a vague "check back later." No change to the actual comparison logic — verified via direct production SQL queries (not the app, which has no local Supabase access) that the gates are behaving correctly; the page just didn't say so.

**The relationship scatter plots (Gulf Watch's cost-of-living-vs-currency-stability, Compare's inflation-vs-policy-rate) replaced entirely.** Owner feedback in two rounds:
1. "Very messy" on the Gulf Watch chart specifically — investigated with real production data pulled via `pairAnnualSeries`/`annualizeCpi`: two compounding causes, not one. All 6 countries' trail lines were tangled on one shared plot, AND Saudi Arabia's FX reserves (15-28 months) run up to ~3.7x Bahrain/Oman/UAE/Qatar's (1-8 months) — Kuwait sits in between (8-13 months) but still crowds the same low end of the axis — so the shared axis scale squashed 4-5 of 6 countries into a sliver near the bottom. Mocked up two fixes as a real interactive Artifact (small-multiples vs. click-to-isolate-on-one-chart) using the real data.
2. Before picking either, the owner clarified the deeper problem: **"I still don't know what are the line charts on the scatter plots"** — the trail lines (each country's own path through the years, dot to dot) weren't a legible convention at all, tangled or not. This also connects back to the feature's original request from much earlier in the project: a scatter plot that's "dynamic, changes with the movement from time to another" — the trail-line version never actually built that.

Replaced `components/RelationshipScatter.tsx` (deleted) with **`components/TimeSliderScatter.tsx`**: a year slider (plus play/pause) above the chart: dragging it moves every series' dot to its real position for that year, one year at a time, with no connecting lines at all. The axis domain stays fixed across every year in the data (not just the current one) so the plot doesn't jump around as you scrub — which also means Saudi Arabia/Kuwait's larger reserve numbers still visibly dominate the y-axis; that's an honest property of the real data, not hidden by the redesign. A market/country with no reading for the slider's current year is simply not drawn that year (named in a footnote) rather than interpolated or guessed at. Confirmed as the right direction against a live interactive mockup (real Gulf data, not a static picture) before being built into both `components/GulfTrends.tsx` and `app/compare/ComparePageInner.tsx` — the Compare page's version respects that page's existing From/To year-range picker (the slider scrubs within whatever range is already selected, rather than adding a second, conflicting range control).

## 14. BIS as a new source: Saudi + Kuwait policy rates (2026-08-28)

After §13 made Gulf Watch's staleness *visible*, the site owner asked to start making the data actually **fresher**, naming policy rates as the priority. A full source investigation followed; findings, all verified live:

**Sources ruled out, with reasons (do not re-litigate without new information):**
- **UAE** — no policy rate in BIS or IMF; `opendata.fcsc.gov.ae`, `uaestat.fcsc.gov.ae` and `centralbank.ae` all return Cloudflare "Attention Required" bot blocks. Notably `uaestat` is a .Stat/SDMX platform that would have been an easy build. **Not bypassed**, consistent with the SCAD/Dubai precedent.
- **Bahrain** — absent from BIS and IMF.
- **Oman** — `data.ncsi.gov.om` is a DKAN portal under Oman's Open Government License (permissive), but its API section is an empty stub and the standard DKAN endpoints are not enabled (404/302). NCSI's real figures are monthly PDFs only.
- **Kuwait CSB / SAMA** — `csb.gov.kw` reachable but publishes no structured feed; `sama.gov.sa` refuses connections (Cloudflare).
- **Qatar** — its portal dataset genuinely contains **only 2020–2025, zero 2026 rows for any group** (verified directly). Our fetcher is correct; the portal itself lags Qatar's own statistics authority by ~8 months. Fixing that needs a different Qatar source, not a code change.

**IMF (`api.imf.org`, SDMX 2.1, no key)** — works, and is monthly. Would improve Oman inflation (1.0% → 3.17%) and UAE (1.25% → 2.05%), and carries Qatar/Oman policy rates in `MFS_IR`. **Not adopted yet**: IMF's terms require emailing `copyright@imf.org` for commercial reuse, which would add a fifth entry to the pre-monetization checklist. Two traps found and worth remembering: Kuwait's latest CPI observation is a literal `0` placeholder (May 2026 = 2.49% is real, June = 0 is not), so any IMF fetcher must guard against blindly taking the latest value; and UAE/Saudi/Bahrain are **absent** from `MFS_IR` entirely.

**BIS (`stats.bis.org`, dataflow `WS_CBPOL`) — adopted.** Chosen over IMF specifically because its licence is cleaner. Verbatim from `bis.org/terms_statistics.htm`: *"The use of the statistics is unrestricted, provided that"* BIS is cited as source, use is not misleading or implying affiliation, and — for commercial use — *"their inclusion in the publication or product will not result in any additional charge to subscribers or other users."* **There is no database-storage prohibition**, which is the specific clause that forced FRED's removal (§4). BIS's "nothing shall be construed as investment advice" condition is already satisfied by MMAI's site-wide disclaimer. So unlike Bank of Japan, Data Saudi and Norges Bank, **BIS needs no permission email before monetizing**.

Built: `lib/fetchers/bis.ts` → `fetchBisPolicyRate("SA" | "KW")`. Saudi = SAMA's official market repo rate (4.25%), Kuwait = Central Bank of Kuwait's discount rate (3.5%), both sourced from the daily series.

**Two implementation details that are load-bearing, not style:**

1. **Do not parse BIS CSV with `line.split(",")`** the way `abs.ts` and `rba.ts` do. Verified against the live full CBPOL response: **25 of its 49 daily rows** carry quoted free-text fields containing commas (`COMPILATION`, `SUPP_INFO_BREAKS`), yielding 16/17/18/20/22/26 columns under a naive split instead of the correct 15. Saudi's and Kuwait's rows are comma-free *today*, so a naive parser looks correct until BIS rewords a footnote and it silently reads the wrong column. `bis.ts` uses a quote-aware splitter and selects by header name. `scripts/verify-bis-fetch.ts` exercises this against Brazil's row, which really does contain commas in quoted fields.
2. **Daily series, not monthly.** A policy rate is a current level, not a period average — daily gives the rate actually in effect and its real effective date, where monthly reports end-of-last-month even when the rate is unchanged and current. This added `"daily"` to the granularity union in `formatPeriod()` (`lib/gulfHistoryHelpers.ts`) and `GULF_POLICY_RATE_GRANULARITY` in `lib/gulfMarkets.ts`.

**Copy that had to change in the same commit** (it asserted the opposite of what the page now shows): `GulfCard`'s footer said *"No composite score — policy rate data isn't available for this country"* — now conditional, since that sentence would otherwise sit directly beneath a displayed policy rate on the Saudi and Kuwait cards. `app/sources/page.tsx` said no policy-rate source existed *for any of these six*. Gulf Watch still scores nobody; for those two that is now a deliberate design choice rather than a missing input.

**Deliberately out of scope:** composite scoring for Gulf countries (with a policy rate, Saudi and Kuwait would in principle have all 5 pillars available — a much larger decision), Qatar/Oman rates from IMF, and the IMF inflation upgrade.

---
*End of handover document.*

---

## 15. Methodology charter, V1 freeze, and the evidence audit (2026-08-29 → 2026-08-31)

The largest change in the project's direction so far. Read this section before touching `lib/scoring.ts`.

### 15.1 The name changed
**Moshnib MACRO Analysis Index**, not "Market Analysis Index". Charter §17 marks this Concluded. The rename took two commits because the first pass used a case-sensitive search and missed `MOSHNIB MARKET ANALYSIS INDEX` in capitals on the homepage — and the verification grep was blind the same way the fix was. **Search case-insensitively when verifying a rename.**

The charter also specifies the descriptor **"Measuring the Pulse of the Economy"**. It is still not on the site. Open item.

### 15.2 V1 is a frozen benchmark
`MMAI_V1_FROZEN_BENCHMARK.md`, git tag `v1-benchmark`. Charter §14 requires a dated copy of equations, schema and known outputs before methodology research begins. It reproduces production to **0.0000267**.

**Do not edit that file to reflect later changes.** A snapshot that gets updated is not a benchmark. Changes go in `MMAI_CHANGE_LOG.md` instead.

### 15.3 Research is on a separate branch
`research/v2-scoring` holds `research/v2-candidate.ts` and `research/compare.ts`. Nothing the site renders imports them. Charter §14 forbids editing production equations in place during testing.

Findings so far: under equal 20% weights the top three markets **reorder**, and 10 of 48 historical points change band. The sixth-pillar (bond yields) test **cannot currently be run** — the policy rate did not vary across the window the two series overlap, so correlation is undefined for four of six markets. It needs multiple rate *cycles*; bond collection began 2025-08-29.

### 15.4 The evidence audit and the five changes it produced
Full record in `MMAI_CHANGE_LOG.md`, each entry to charter §14's required structure and each independently revertable.

| Date | Change | Effect |
|---|---|---|
| 31 Aug | US scored on **PCE**, not CPI | US 78.48 → **77.21** |
| 31 Aug | Compare page stops naming a leader within **1.0 points** | display only |
| 31 Aug | Learn page publishes **measured** pillar influence | disclosure only |
| 31 Aug | Refresh cannot overwrite a published score with a failed fetch | guard only |
| 31 Aug | **Per-market inflation targets**; AU = 2.5% | AU 73.97 → **75.85** |

Measured facts worth not rediscovering:
- **Effective ≠ nominal weight.** Monetary Conditions is weighted 18.75% and operates at **9.2%**; External & Commodities is weighted 12.5% and operates at **15.0%**. Stored in `PILLAR_EFFECTIVE_INFLUENCE`, read by nothing in the scoring path.
- **External & Commodities has zero cross-market variance** (sd exactly 0.0000) — one global Brent price for all six. Remove it and the ranking is unchanged. It is also the *only* daily-updating input, so all six scores move in lockstep day to day.
- **The pillars are NOT redundant.** Strongest cross-pillar correlation |r| = 0.32; Growth vs Labour only 0.17. This is genuine evidence for the five-pillar structure — record it in the IP file.

### 15.5 The refresh pipeline (this replaces §0's cron claim)
Vercel Hobby crons are **best-effort** — they may be delayed hours or skipped entirely. Observed directly on 28–29 August, which is what caused the repeated "last updated Aug 28" complaints. Three layers now:

1. **GitHub Actions** (`.github/workflows/refresh.yml`) — primary, 06:10 / 12:00 / 18:00 UTC, fails loudly on non-200.
2. **Freshness guard** — markets already stamped today are skipped, so the later runs are cheap no-ops.
3. **Vercel crons** — left in place as a third layer.

`workflow_dispatch` has a **force** checkbox (added 31 Aug) for re-running after a *source* change, which the freshness guard would otherwise block until the next day. Force is deliberately unavailable on the schedule.

**Trap, learned the hard way.** The first forced run overwrote Canada's good 76.4952 with *Not Publishable*: both Statistics Canada calls (inflation and unemployment share one source) failed together, coverage fell to 0.6. A retry 60 seconds later restored it. The **publication-regression guard** in `app/api/refresh/route.ts` now prevents this — a run yielding nothing publishable is skipped when a good score under 3 days old exists.

### 15.6 What is open
- **Historical calibration dataset** (charter §18). The blocker for everything: the §13 backtest needs the 2007–09 crisis and MMAI's history starts 2019. Every research question so far has ended here.
- **Neutral rates per market.** The 2.5% applied to both Japan and the US is the least defensible number in V1.
- Nine unsourced coefficients, and the band thresholds (charter §15 requires they be researched).
- **Buy a domain** — unblocks IMF permission (UAE/Kuwait/Oman inflation are still on year-old figures), Gulf debt, and Resend email.

### 15.7 Rules this period added
- **Verify, do not recall.** Two reasonable assumptions were wrong in the same session: that CPI runs above PCE (it did not), and that 2.5% for Australia was MMAI's design choice (it is the RBA's). Both were caught only by reading the source.
- **Multi-line string replacement is unreliable on this repo's files.** Prefer line-indexed edits when scripting changes.
- `tsx` does **not** load `.env.local` the way `next` does. Source it explicitly or fetchers fail with "KEY is not configured".
