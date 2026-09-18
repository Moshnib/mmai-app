# MMAI — MASTER HANDOVER DOCUMENT

**Last updated:** 2026-09-16
**Reflects commit:** `b07c8a7` ("The homepage map drew stripes across the world, and the Learn page described a retired method")

> **START HERE IF THIS IS A NEW CHAT:** read §28 first — it is the whole
> current state on one page: what is live, what is open, and how to pick up.
> Everything before it is history, newest section last.
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

**Scheduling:** GitHub Actions only (`.github/workflows/refresh.yml`). `vercel.json` and its crons were **removed on 2026-09-11** after one fired late and raced the GitHub run — see §19.10.

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

## 4. DATA SOURCES (29 entries in `lib/sources.ts`)

> **Not all `live`.** Norway's four entries are `manual` and marked `DORMANT`: wired end to end but absent from `FALLBACK_MARKETS`, so nothing reaches a reader. Every live entry also carries a **`cadence`** (daily / monthly / quarterly / annual / per decision), because "live" means the fetcher succeeded, **not** that the figure is current. See §16.

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
| Brent Crude YoY (**context only — NOT SCORED since 2026-09-01**) | U.S. Energy Information Administration | `eia.ts` → `fetchBrentYoY()` | v2 API, product facet `EPCBRENT`, series facet `RBRTE` (pinned deliberately). Monthly, YoY computed manually. **Fetched ONCE per refresh cycle in `GET()`, not once per market** — passed as a parameter into `fetchRawIndicators(market, brentYoY)`. |

---

## 5. METHODOLOGY (five-pillar engine — **SUPERSEDED, see §23**)

> **This section describes the engine being replaced.** It still runs and still
> produces every published number, so it is accurate for what is live today —
> but the three-dimension composite in §23 is what the branch
> `composite-three-dimensions` ships, and it is what a new session should
> build against. Do not extend the five pillars.

```
PILLAR_WEIGHTS = { PS: 0.25, GM: 0.25, LM: 0.1875, MC: 0.1875, EC: 0.125 }

S_PS = clip(100 − 15 × |inflation − τ(market)|, 0, 100)  -- Price Stability, τ is PER-MARKET
S_GM = clip(50 + 10 × gdpGrowth, 0, 100)             -- Growth Momentum
S_LM = clip(100 − 10 × (unemployment − 2), 0, 100)   -- Labour Market
S_MC = clip(100 − 12 × |policyRate − rN(market)|, 0, 100)  -- Monetary Conditions, rN is PER-MARKET
S_FR = clip(100 − 0.3 × max(0, debtPctGdp − 60), 0, 100)  -- Fiscal Resilience

MMAI = (Σ weight × pillar_score) / (Σ active weights)  -- reweights around any missing pillar
```

- **τ (inflation target) is per-market since 2026-08-31**, from `INFLATION_TARGET` in `lib/scoring.ts`. US/EA/UK/CA/JP = **2.0%**; **Australia = 2.5%**. Australia is the only one of the six whose central bank targets a *range* (2–3%); the RBA's own explainer states policy is set so inflation returns to the **midpoint**. Every value was read from the issuing institution on 2026-08-31 — do not change one without doing the same.
- **`computePillarScores(raw, market)` takes market as a REQUIRED argument.** Deliberately not optional-with-default: an optional one lets a call site silently score Australia against 2.0 while the refresh route uses 2.5, so stored and displayed scores disagree.
- **rN (neutral rate) is per-market since 2026-09-01**, from `NEUTRAL_RATE` in `lib/scoring.ts`. US 3.01 · CA 3.76 · EA 2.09 · JP 1.64 · UK 3.00 · AU 3.50. Nominal = published real r\* + that market's inflation target. This was the least defensible number in the method and was not merely unjustified but **wrong** — one 2.5% spanning Japan and the United States. **Australia's is the weakest: it derives from a 2017 RBA Bulletin, nine years old.** Refresh that first.
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

**Deliberately out of scope:** composite scoring for Gulf countries (with a policy rate, Saudi and Kuwait would in principle have all 5 pillars available — a much larger decision), Qatar rates from IMF, and the IMF inflation upgrade.

**Oman's policy rate is not "unwired", it is absent.** Checked against IMF `MFS_IR` on 6 September 2026, because two places in the codebase claimed Qatar's and Oman's rates were both available and merely unwired. Only half of that was true:

| | series | latest | value |
|---|---|---|---|
| Qatar | `MFS166` Monetary policy-related, Rate | **2026-M07** | 4.35% |
| Oman | no `MFS166` at all | — | — |
| Oman | best rate series (`MFS135`/`MFS162`/`MMRT`) | 2022-M04 | stale |
| Oman | discount rate (`DISR`) | 2018-M10 | stale |

So no amount of wiring produces an Oman policy rate, and publishing a four-year-old figure beside Saudi's from last week would be worse than the gap. Qatar is genuinely current and blocked only on the IMF permission email below.

Useful cross-check found while doing this: IMF's Kuwait discount rate reads **3.5**, matching the BIS figure already on the site exactly — two independent sources agreeing on a number MMAI publishes.

**IMF's terms pages cannot be read by machine at all** — `imf.org/en/About/copyright-and-terms` returns 403 to curl with a browser user-agent, and the in-app browser gets "Access Denied". The licence therefore cannot be re-verified from here; the `copyright@imf.org` note above stands as the record of it, and a human has to close that loop.

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
- **Effective ≠ nominal weight.** Monetary Conditions is weighted 18.75% and operates at **11.0%**; Fiscal Resilience is weighted 12.5% and operates at **9.0%**. Stored in `PILLAR_EFFECTIVE_INFLUENCE`, read by nothing in the scoring path, and **re-measured by `scripts/measure-pillar-influence.ts` in CI** — which fails if the published figures drift.
- **FIXED 2026-09-01 — see §17.** External & Commodities had zero cross-market variance (sd exactly 0.0000) and was replaced by Fiscal Resilience (sd 11.1). Brent is still fetched and shown in the weekly feed, but it no longer moves any score. **It is also not daily** — the registry claimed `cadence: "daily"` until 2026-09-02, but the EIA series it reads is MONTHLY, and the stored reading is routinely two months old. MMAI has no daily-updating input at all.
- **Growth Momentum barely separates the six markets.** Cross-market sd of just **3.3**, the lowest of any pillar, against a joint-largest 25% weight — less than a third of what Labour Market achieves at 18.75%. Not the same defect as the oil pillar (GDP growth is genuinely per-market and will spread when the cycle diverges), but **uninvestigated**, and it should be before anyone claims the weights are calibrated. Tracked in `PILLAR_CROSS_MARKET_SD`.
- **The pillars are NOT redundant.** Strongest cross-pillar correlation |r| = 0.32; Growth vs Labour only 0.17. This is genuine evidence for the five-pillar structure — record it in the IP file.

### 15.5 The refresh pipeline (this replaces §0's cron claim)
Vercel Hobby crons are **best-effort** — they may be delayed hours or skipped entirely. Observed directly on 28–29 August, which is what caused the repeated "last updated Aug 28" complaints. Three layers now:

1. **GitHub Actions** (`.github/workflows/refresh.yml`) — primary, 06:10 / 12:00 / 18:00 UTC, fails loudly on non-200.
2. **Freshness guard** — markets already stamped today are skipped, so the later runs are cheap no-ops.
3. ~~Vercel crons~~ — **removed 2026-09-11.** One fired 29 minutes late and raced the GitHub run (§19.10). Two schedulers that cannot see each other are a race, not redundancy.

`workflow_dispatch` has a **force** checkbox (added 31 Aug) for re-running after a *source* change, which the freshness guard would otherwise block until the next day. Force is deliberately unavailable on the schedule.

**Trap, learned the hard way.** The first forced run overwrote Canada's good 76.4952 with *Not Publishable*: both Statistics Canada calls (inflation and unemployment share one source) failed together, coverage fell to 0.6. A retry 60 seconds later restored it. The **publication-regression guard** in `app/api/refresh/route.ts` now prevents this — a run yielding nothing publishable is skipped when a good score under 3 days old exists.

### 15.6 What is open
- **Historical calibration dataset** (charter §18). The blocker for everything: the §13 backtest needs the 2007–09 crisis and MMAI's history starts 2019. Every research question so far has ended here.
- **Neutral rates per market.** The 2.5% applied to both Japan and the US is the least defensible number in V1.
- Nine unsourced coefficients, and the band thresholds (charter §15 requires they be researched).
- **Buy a domain** — unblocks IMF permission (UAE/Kuwait/Oman inflation are still on year-old figures), Gulf debt, and Resend email.

### Gulf carry-forward (6 September 2026)

Bahrain's inflation was disappearing from Gulf Watch on roughly four days in ten. Not missing data — `data.gov.bh` publishes monthly and its July 2026 reading of 3.0% was the *freshest inflation figure of the six countries*. The endpoint is intermittent, the refresh had no memory, and a failed fetch wrote null over the previous good value.

`lib/gulfCarryForward.ts` now fills a null indicator from the most recent stored row that has it, within 14 days. Three things about it are load-bearing and should not be "simplified":

1. **The reporting date travels with the value.** Stamping a carried number with today's date would invent a period that never existed — the exact defect the per-indicator date columns were added to fix.
2. **It scans per field, not per row.** The first version took only the newest row and did nothing whenever a source failed on consecutive days, which is the normal failure mode. Fields may therefore come from different days; that is intended, and harmless, because every figure already carries its own date.
3. **The 14-day bound measures the row actually used**, not the newest row in the window. Gulf refreshes daily, so measuring against the newest row would never expire anything.

`lib/retryFetch.ts` retries a source three times first. `scripts/test-gulf-carry-forward.ts` covers all of it and runs in CI; both failure modes above were verified to fail it before being fixed.

### 15.7 Rules this period added
- **Verify, do not recall.** Two reasonable assumptions were wrong in the same session: that CPI runs above PCE (it did not), and that 2.5% for Australia was MMAI's design choice (it is the RBA's). Both were caught only by reading the source.
- **Multi-line string replacement is unreliable on this repo's files.** Prefer line-indexed edits when scripting changes.
- `tsx` does **not** load `.env.local` the way `next` does. Source it explicitly or fetchers fail with "KEY is not configured".

---

## 16. Data freshness, the external audit, and the chart rebuild (2026-09-01)

The largest single day of change in the project. **21 commits.** Read this before touching fetchers, `lib/scoring.ts`, or `components/TrendChart.tsx`.

### 16.1 The whole index was running on stale data, and nobody could see it

Per-indicator observation dates were added to `raw_indicators` (five nullable columns, migration in `supabase/migrations/`) and are now shown on every pillar card.

**That disclosure immediately exposed the real problem:** Growth Momentum carries 25% of the score — its joint-largest weight — and **every market's GDP was dated January 2025.** One fetch-date standing in for five observation dates had hidden it.

**All six markets are now on quarterly, year-over-year GDP:**

| Market | Source |
|---|---|
| US | BEA `T10106`, levels → YoY computed |
| Euro Area | Eurostat `namq_10_gdp`, `CLV_PCH_SM` |
| UK | ONS `IHYR` ("q-on-q4") |
| Canada | StatCan vector `62305752`, levels → YoY |
| Australia | ABS `ANA_AGG` `M1.GPM.20.AUS.Q` |
| Japan | e-Stat `0003109750` (real, seasonally adjusted) |

### 16.2 THE RULE THAT GOVERNS EVERY GDP FETCHER

**Year-over-year is mandatory. Frequency may differ; the concept may not.**

Each source headlines a *different* quarterly concept, and taking whichever number each publishes would make the six markets **non-comparable while looking entirely reasonable**:

- BEA's headline is **annualised quarter-on-quarter** — 2025Q3 printed 4.4% annualised against 2.34% YoY. Rejected; YoY computed from levels.
- ONS `IHYQ` is quarter-on-**previous**-quarter. Rejected in favour of `IHYR`.
- StatCan's headline is annualised. Rejected; computed from levels.
- ABS `M4` is **current prices** — nominal. Rejected in favour of `M1` chain volume.

Every market's series is also **seasonally adjusted**, which is why Japan uses 実質季節調整系列 rather than 原系列.

### 16.3 Japan: all four indicators fixed, three different ways

Japan was top of the table on three figures from January 2025.

- **Inflation** — e-Stat `0003427113`, `cdTab=3` (前年同月比 = YoY), `cdCat01=0001` (総合, all items), `cdArea=00000` (全国, **not** the Tokyo ku-area series). Needs `ESTAT_APP_ID`, a free registered key. **3.17% → 2.0%.**
- **GDP** — e-Stat, above. **1.19% → 0.55%.**
- **Unemployment** — **fixed by a pipeline change, not a fetcher.** See §16.4.

**Dead ends, verified so nobody repeats them:** OECD's Japanese CPI series **ends June 2021**. The Statistics Bureau's English pages link back to e-Stat. The nominal archive table `0003365113` looks plausible and is neither current nor real.

### 16.4 OECD is unreachable from Vercel — and the workflow now works around it

Japan's unemployment fell back to World Bank annual for weeks. It was first diagnosed as a timeout: `format=csvfilewithlabels` takes **11–40s** against **~0.1s** for `format=csvfile`, and the fetcher aborts at 8s.

**That fix was real but was not the cause.** Corrected to `csvfile`, it still failed in production. From a laptop and from the GitHub runner it completes in ~2s. **It is OECD refusing Vercel's egress.**

So `.github/workflows/refresh.yml` fetches it on the **runner** and relays it to `/api/refresh` as a query parameter. The route **validates** it — finite, 0–30, ISO date not future and under two years — and records the path in `source_note`.

It deliberately does **not** write to Supabase from Actions: that needs the **service-role key** as a GitHub secret, which is far too wide a blast radius for one indicator.

### 16.5 Independent audit — 12 findings, 10 closed

Published as an artifact. Graded against the OECD/JRC composite-indicator framework and central-bank practice. **Opinion: qualified.**

Two findings were new analysis rather than restatement:

- **H-1, compensatory aggregation.** Linear aggregation lets a *collapsed* pillar be masked. **Euro Area 2013: Labour Market = 0.0 and MMAI published 59.9, "Balanced".** The site now flags this when the weakest pillar is >40 below the composite *and* under 30 — thresholds calibrated so all four historical zero-pillar cases are caught. Full fix (geometric aggregation) is **open by choice**.
- **M-1, the independence claim is partly an artefact.** Growth vs unemployment **level** correlates −0.047; growth vs the **change** in unemployment correlates **−0.666**. Okun's law is in the data; MMAI cannot see it because it compares a rate of change against a level. Disclosed on the Learn page.

**H-2 (neutral rates) closed the same day** — see §16.6.

### 16.6 Neutral rates, and an error of mine worth not repeating

I recorded H-2 as *blocked* because HLW covers three of six markets, and stated repeatedly that "no estimate exists" for the UK, Japan and Australia. **That was wrong and I never checked it.** All three publish estimates; what differs is machine-readability.

Now per-market (§5). **Canada moved Supportive → Balanced** — its 2.25% rate sits 1.5 points *below* a 3.76% neutral where against 2.5% it looked almost exactly neutral.

### 16.7 The bond chart was drawing nonsense

Spotted by the site owner. **Not volatility — sorting.** `TrendChart` sorted its category axis on the display **label**, which worked only while every caller passed four-digit years. Formatted dates sort by leading digit: `1 Jun 26 | 11 Aug 26 | 12 Nov 25 | 14 Jul 26`. Consecutive points were months apart in arbitrary order.

Three things followed:
1. Points may carry a `sortKey` (the ISO date); callers without one are unaffected.
2. **Smart time axis** — ticks land on the first *trading day* of each month (weekends mean "the 1st" often does not exist), resolution follows the **span** not the point count, capped at eight ticks, newest always kept.
3. **`components/TimeRangeFilter.tsx`** — one shared control. Bonds default to 6 months; Trends to the full record. `withinRange()` measures back from the **newest date present**, not today, so a stalled source shows data rather than an empty chart.

Every time-series chart renders through `TrendChart`, so this fixed all of them at once.

### 16.8 Traps this day earned

- **CI runs on every branch and `research/` is linted like production.** A new research script needs `eslint`, not just `tsx`.
- **A green pipeline proves the code compiles, not that a reader can see it.** Three bugs shipped past `tsc`, lint and build in one day: a block nested where it could never render, `updates undefined`, and `updates annual`. All three were found by **opening the site**.
- **Multi-line string replacement is unreliable against these files.** Use line-indexed edits.
- **The shell eats `${...}` in template literals.** Write patch scripts to a file; never inline them in `node -e`.
- **PowerShell `Add-Content` defaults to UTF-16** and corrupted `.env.local`. Always pass `-Encoding utf8`.
- **`verify-scoring` and `verify-history` pin values that a methodology change WILL move.** Update both, and record why in the file.

### 16.9 Open

| Item | Owner |
|---|---|
| **Rec 7** — geometric aggregation (21% of historical bands change) | decision |
| **A domain** — email is impossible without it; also improves an IMF permission request | owner |
| Refresh Australia's neutral rate (2017) | next session |
| Historical calibration dataset extension | research branch |

---

## 17. Fiscal Resilience replaces the oil pillar (2026-09-01)

Audit finding **M-4 / recommendation 8**, closed. Full charter-§14 record in [`MMAI_CHANGE_LOG.md`](MMAI_CHANGE_LOG.md); this is what you need to not break it.

### 17.1 What changed

```
was:  S_EC = clip(100 − 1.2 × |brentYoY|, 0, 100)
now:  S_FR = clip(100 − 0.3 × max(0, debtPctGdp − 60), 0, 100)
```

Weight is unchanged at 12.5%. **The pillar key is `FR`, not `EC`** — renamed on purpose so the compiler had to visit all seventeen call sites instead of letting a redefined `EC` slip through.

### 17.2 Why the old pillar had to go

Brent is **one global price**. The refresh route fetched a single figure and wrote it unchanged into all six market rows — confirmed live, every market carrying `brent_yoy = 17.91`. Its cross-market standard deviation was **exactly 0.0000**. It held 12.5% of the weight, added an identical 9.81 points to every composite, and **could not change any ranking**.

It also scored *absolute* change, so a crash and a boom counted alike: oil fell 34% in 2020 and rose 69% in 2021, and the pillar read the recovery as instability worth 17.2/100.

### 17.3 THE TRAP THAT LET IT HIDE FOR MONTHS

The Learn page published External & Commodities at **15.0% "effective influence" — third of five, more than its weight.** It looked like the pillar was pulling more than its share.

That figure is *weight × standard deviation across the whole panel*, which blends variation over **time** with variation across **markets**. All 15.0% was the former. A pillar fed by one global price scores brilliantly on that metric while doing nothing whatsoever for comparison.

So `PILLAR_CROSS_MARKET_SD` now exists beside `PILLAR_EFFECTIVE_INFLUENCE`, and **both are published**. Any future pillar measuring near zero on the cross-market line is decoration, whatever its influence figure says. Read them together or you will make this mistake again.

### 17.4 The 60% is sourced. The slope is a choice.

60% is the **Maastricht reference value** (TFEU Protocol No 12, Article 1) — a published threshold that already governs six of the scored economies through the euro area. It is *not* the level at which debt becomes dangerous; no such universal level exists, and asserting one would repeat the H-2 error exactly.

**The slope, 0.3, decides Japan's rank, and the site owner chose it.** Sensitivity:

| Slope | Ranking |
|---|---|
| **0.30** | **AU > JP > EA > US > UK > CA** ← adopted |
| 0.45–0.60 | AU > EA > JP > US > UK > CA |
| 0.80–1.00 | AU > EA > UK > US > JP > CA |

Australia first and Canada last under **every** slope; only Japan moves. Gentle was chosen because Japan's debt is held domestically, in yen, at near-zero rates — a genuinely different condition from the same ratio elsewhere.

### 17.5 Data

BIS `WS_TC`, key `Q.{area}.G.A.M.770.A`, quarterly. **`lib/fetchers/bis.ts` already existed** (shipped 29 August for the Compare page), so this needed no new source, licence review or key.

Name it as BIS names it: *credit to general government from all sectors at market value*. Closely related to gross government debt and built for cross-country comparison, but **not identical** to a national treasury's headline figure.

Seven years of Q4 history for all seven markets were fetched and written into `lib/history.ts` — **56 points, every one sourced.**

### 17.6 Ranking changed; no band did

| | Before | After |
|---|---:|---:|
| Australia | 81.02 | **83.71 (1st)** |
| Japan | 83.76 (1st) | 81.99 (2nd) |
| Euro Area | 78.70 | 80.44 |
| US | 78.36 | 79.13 |
| UK | 76.56 | 78.17 |
| Canada | 72.13 | 73.46 |

Cross-market spread of the fifth pillar: **0.0000 → 11.10**.

Five of six markets **rise**. That is not the index turning generous — the retired pillar was scoring oil up 17.9% YoY and docking all six for it. Removing one indicator's noise lifted six scores at once. Only Japan falls, and only by 1.77.

### 17.7 MIGRATION REQUIRED BEFORE DEPLOY

`supabase/migrations/2026-09-01-fiscal-resilience-pillar.sql`. The refresh route inserts `debt_pct_gdp` and `pillar_fr`; **if those columns are missing the entire insert fails for every market.** Read paths degrade safely to fallback data, but the write path does not.

`mmai_scores.pillar_ec` is **kept, not renamed**. Rows before this date hold genuine External & Commodities scores and are part of the record the export button hands readers.

### 17.8 Traps this change earned

- **A green pipeline proves the code compiles, not that a reader can see it.** Three more bugs shipped past `tsc`, lint and build here, all found by opening the site:
  1. `targetNote` was nested inside the `targets` conditional, so the new Government Debt and Brent explanations rendered **for nobody**. Identical shape to the 31 August limitations bug.
  2. `weeklyChanges.ts` and `useLiveHistory.ts` omitted `debt_pct_gdp` from their `.select()`, so they computed **four-pillar** composites disagreeing with the homepage — US showed 80.4 in one place and 78.3 in another.
  3. The Learn page still published *"an assumed neutral level of 2.5% everywhere"* and *"no published estimate exists for the UK, Japan or Australia"* — both false since H-2 closed hours earlier.
- **A verifier can pass without testing anything.** `verify-published-formulas` swept −40 to 40, which never reaches a debt ratio: every sample sat below the 60% threshold, so Fiscal Resilience would have been declared verified without the sweep once touching its slope. Raised to 260. **When you add a pillar, check the sweep actually covers its input range.**
- **`scripts/measure-pillar-influence.ts` is new and runs in CI.** The published influence figures used to be computed by hand and pasted in. It caught four wrong values on its first run.

### 17.9 Still open

| Item | Owner |
|---|---|
| **Rec 7** — geometric aggregation (21% of historical bands change) | decision |
| **Growth Momentum's 3.3 cross-market sd** against a 25% weight — §17.3 | investigate |
| **A domain** — email is impossible without it; also improves an IMF permission request | owner |
| Refresh Australia's neutral rate (2017) | next session |
| Historical calibration dataset extension | research branch |

---

## 18. The Euro Area source died and nothing noticed (2026-09-02)

Found by an operational audit, not by any automated check. **That is the finding.**

### 18.1 What happened

Eurostat retired `prc_hicp_manr` on **4 February 2026** when the euro area HICP methodology changed. The ECB discontinued its matching `ICP` dataflow the same day.

Neither returned an error. They stopped gaining months. The fetcher asked for the newest observation, got **December 2025**, and reported success every morning for nine months.

MMAI published euro area inflation as **2.0% — exactly on target** — while the real figure climbed to **3.3%**. Price Stability is 25% of the score, so **the Euro Area was published as *Supportive* when the correct verdict was *Balanced*.** First known wrong published band caused by a source failure rather than a methodology choice.

### 18.2 THE KEY CHANGED SHAPE, NOT JUST NAME

```
dead:  ICP/M.U2.N.000000.4.ANR     <- still resolves, still returns 2025 data
live:  HICP/M.U2.N.000000.4D0.ANR  <- provider dimension 4 -> 4D0
```

A half-migration looks like it works. `fetchEuroAreaInflation` now lives in **`lib/fetchers/ecb.ts`** and was **deleted** from `eurostat.ts` — not deprecated, because an exported function is one somebody imports by autocomplete.

### 18.3 WHY NOTHING CAUGHT IT — READ THIS BEFORE ADDING ANY FETCHER

The only staleness check in the project is:

```
isStale = now − row.fetched_at > 72 hours
```

`fetched_at` is **when we last ASKED**. It says nothing about **what came back**. A frozen source answers instantly every morning and reads as perfectly live. The per-indicator observation dates (audit M-6) *display* the age to a reader; **no code tests it.**

The new ECB fetcher carries a local guard — it throws if the newest observation is over **100 days** old, generous against a ~7-week normal HICP gap. It throws rather than warns so `settle()` writes the row PARTIAL and the coverage gate withholds the score: **a confident wrong number is worse than a visible gap.**

**That guard covers ONE fetcher. Fourteen other live series can still fail this way.** A system-wide observation-age check in CI is the highest-value item outstanding.

### 18.4 Deploy ordering matters

| Shipped as… | EA composite | Band |
|---|---:|---|
| Live before the fix | 78.70 | Supportive |
| Inflation fix **alone** | 73.83 | **Balanced** |
| **With §17 Fiscal Resilience** | **75.57** | **Supportive** |

**Ship both together.** Fiscal Resilience removes the retired oil pillar that was docking every market for oil being up 17.9%, which offsets the inflation correction. Separately, the Euro Area changes band twice in a week for reasons unconnected to the euro area.

### 18.5 Two false statements also corrected

- **`SOURCE_NOTES` credited the World Bank for Canada, the UK, Australia and Japan.** They read Statistics Canada, ONS, ABS and e-Stat. The World Bank is used only for Japan's unemployment fallback and dormant Norway. These strings are stored on every row and shown as provenance. **Nothing binds them to the actual `settle()` calls — they drifted for weeks. Keep them in step by hand.**
- **Brent was labelled `cadence: "daily"`; the EIA series is monthly** and runs about two months behind. MMAI has no daily-updating input at all.

### 18.6 Still healthy, verified the same day

All routes 200, no console errors, CI green, cron running, Gulf Watch fully correct (including Saudi/Kuwait BIS policy rates), subscriber and feedback tables correctly locked to the service role, scores written for all six markets. UK GDP (6mo) and unemployment (4mo) are genuine ONS lag — checked against ONS directly, not assumed.

---

## 19. Observation-age checking (2026-09-02) — H-1 closed

The control that §18 said was missing. **Read §18 first**; this is the fix for the hole it describes.

### 19.1 The rule

`lib/freshness.ts`. Every figure's own observation date is compared against how often its source publishes — `cadence`, already in `lib/sources.ts`.

| Cadence | Limit | Reasoning |
|---|---:|---|
| daily | 10d | Long weekend + a few days of outage |
| monthly | 100d | ~3 missed releases |
| quarterly | 240d | ONS lags two quarters legitimately |
| annual | 800d | World Bank runs 1–2 years behind by design |
| **per decision** | **not checked** | See 19.2 |

Applied by `app/api/refresh/route.ts` on every run, recorded in `source_note`, and surfaced as `staleMarkets` at the top of the response.

### 19.2 WHY POLICY RATES ARE EXEMPT — do not "fix" this

A policy rate is a **level that persists**. A central bank holding rates for two years means the two-year-old decision **is** the current rate. Japan held near zero for over a decade; an age check would have screamed daily while the data was perfectly correct.

They fail loudly by another route: every policy-rate fetcher **throws** rather than returning a previous value, so a dead one is a null pillar, not a stale number.

### 19.3 THE WORKFLOW FAILS ON IT, AND THAT IS THE POINT

`.github/workflows/refresh.yml` exits non-zero when `staleMarkets > 0`.

The data is **already written** by then; failing rolls nothing back and is not meant to. **It exists to make a human look.** A warning in a log nobody reads is exactly what let the Eurostat series survive nine months.

Corollary, and it matters: **the limits are deliberately generous.** An alarm that cries wolf gets muted, and a muted alarm is worse than none because it is mistaken for coverage. If this fires, check the institution directly before touching a limit.

### 19.4 maxAgeDays — cadence is not lag

`cadence` says how often an institution publishes. It says nothing about **how far behind**, and those differ enormously. Any source may set `maxAgeDays` to override its default. **An override without a `note` explaining it fails CI.**

Two exist, both found by the test before shipping:

| Source | Limit | Why |
|---|---:|---|
| BIS government debt (×7) | 420d | BIS publishes credit stats ~3 quarters in arrears; 2025-Q4 was newest on 2026-09-02 (245d) |
| UK unemployment | 170d | ONS `MGSX` genuinely ended at 2026 MAY (124d), verified directly |

**Neither was a loosening of the general rule** — that would have let a dead ONS series run over a year. Attach the allowance to the row, never to the cadence.

### 19.5 What it would have done

| | |
|---|---|
| Eurostat HICP, found by hand | 2026-09-02 |
| **Would have fired** | **2026-03-12** |
| Earlier | **175 days** |

Replayed against live data: all six markets clean, `staleMarkets = 0`.

### 19.6 Also fixed: six Sources rows still pointed at the World Bank

Euro Area, Canada, UK, Japan (×2) and Australia still said *"Annual figure, updates once a year"* and four linked to `data.worldbank.org`, months after their fetchers moved to national quarterly sources. On the page whose whole purpose is "check our work". Replaced with real series identifiers and the institutions' own pages.

**There is still no test binding `SOURCE_NOTES` and the registry to the actual `settle()` calls.** Both drifted for weeks. Keep them in step by hand until something enforces it.

### 19.7 Noticed, not acted on

The ONS publishes unemployment **quarterly** as well as monthly, and the quarterly series was a month fresher (2026 Q2 vs 2026 MAY). Not changed — swapping the concept mid-audit is how comparability breaks. Worth considering deliberately.

### 19.8 The other half: asking the source what it has (2026-09-10)

Everything else in section 19 reasons about **age**, and can only ever be as good as the allowances written beside it. `/api/source-audit` asks a different question: fetch all 23 figures now and compare them against what the site is publishing.

| Verdict | Meaning | Fails the run? |
|---|---|---|
| `matches` | level with the source | no |
| `one release behind` | the source has published, the next refresh has not run | **no** |
| `RELEASES MISSED` | two or more releases behind | yes |
| `VALUE DIFFERS` | same period, different number — a revision that never landed | yes |
| `SOURCE WENT BACKWARDS` | the source now offers an OLDER period than we publish | yes |
| `FETCH FAILED` | the source did not answer | **no** |
| `NOT PUBLISHED` | nothing complete within `MAX_FALLBACK_DAYS`; the page shows N/A | yes |

It does **not** catch a source that keeps answering and stops updating — Eurostat would have matched every day for nine months. That half is the age rules. **Neither check replaces the other.**

**Why a route and not a workflow step.** The obvious home was `.github/workflows/refresh.yml`, and it cannot work: the fetchers need BEA, BLS and e-Stat keys plus Supabase credentials, and this repository holds exactly **one** secret, `CRON_SECRET`. The other five are Vercel environment variables. A step naming secrets that do not exist does not skip — it runs with empty strings and fails every morning for a reason unrelated to the data. So the check runs where the keys already are, called by curl like the two refreshes. It carries `if: always()` so it still runs when an earlier step failed, which is exactly when you want to know which source is wrong.

#### Two design mistakes caught in review, both worth recording

**1. The grace period measured the wrong interval.** The first version compared `now − liveDate` against a two-day grace. But `liveDate` is the *reporting period*, not the release date: a monthly figure is stamped the first of its month, so it is already ~40 days old the morning it is published, and a quarterly one ~100. The grace was therefore unreachable for 16 of the 20 probes, and **every ordinary release day would have gone red** — roughly 6–8 false alarms a month, each self-clearing at the next 06:10 refresh. It looked correct because the only series it was ever observed on was the daily UK policy rate, where period age and release age coincide. *One passing case was mistaken for a working design.*

The fix counts whole **releases** behind, which needs no clock and gives the same answer at any hour. `scripts/test-releases-behind.ts` pins it down.

**2. The claim that a dead source gets caught elsewhere was false.** The comments, and an earlier version of this section, said a permanently broken fetcher "stops the stored date advancing, and the age rules fail the refresh at that series' cadence limit". Traced through the code, none of that held:

- `settle()` returns null on a throw, so the row is written with a **NULL** observation date — not a frozen old one.
- `stalenessOf` returns null for a null date. Its own doc comment says *"null means no opinion, never fine: a caller must not read it as a pass"*.
- `stalenessWarnings` read it as a pass. `staleMarkets` stayed `0` and the workflow gate never fired.

So a source could have died permanently and **nothing anywhere would have alarmed.** The age rules only ever saw sources that kept answering with a frozen date — the Eurostat shape, not the dead-fetcher shape. Fixed in `app/api/refresh/route.ts`: a figure present with no observation date is now reported. A figure *absent* is still not — that is a null pillar, already visible on the page as a gap.

#### Related pre-existing bug: the US inflation fallback dropped its date

`route.ts` fell back from BEA PCE to BLS CPI but kept `infl?.observationDate`, which is null on that path — storing a CPI figure under a NULL date. Japan's fallback twelve lines below fixes this exact bug and comments on it; the US one never got the same treatment. It made US inflation exempt from every age rule whenever the fallback was in use (via the null-date hole above), and would have made the audit compare live PCE against stored CPI — figures that differ by several tenths — reporting the site as wrong on a day it was behaving exactly as documented.

#### The audit now shares the pages' definition of "published"

`newestScoreableByMarket` originally walked the rows itself and took the first complete one anywhere in its window. The pages use `latestCompleteObservation`, which stops at `MAX_FALLBACK_DAYS` (14) and renders N/A beyond it. Between day 14 and the end of the window the two disagreed, and the audit would have failed the run over a row **no reader could see**. It now delegates to the same function, and runs the same query the pages run — `.order("observation_date").order("fetched_at").limit(200)`, where it previously ordered by `fetched_at` alone and took 120. Both mattered: the ordering decides which row wins a same-day re-run, and a force-refresh writes every market at once (2026-09-01 wrote 60 rows in a day), so 120 rows can be two days of reach rather than twenty.

#### Coverage

23 probes against 30 scored figures. Absent by design: **Japan's unemployment** (OECD refuses Vercel's egress — the workflow fetches it on the runner) and **government debt** for all six markets (one shared BIS call, not a per-market fetch). Euro Area inflation, Euro Area policy rate and US policy rate were missing from the first version and have been added — EA inflation being the exact series behind the nine-month Eurostat incident.

### 19.9 Node has no default fetch timeout, and 25 call sites had none (2026-09-10)

Found by the audit above on its first real outage. Statistics Canada was answering intermittently — three identical curls returned `200 in 10.7s`, nothing at all in 45s, and `502 in 35.0s`. Our own fetchers, measured the same minute:

| Call | Time | Outcome |
|---|---:|---|
| CA inflation | 27,327ms | eventually succeeded |
| CA unemployment | 8,016ms | gave up — **it had a timeout** |
| CA GDP | **148,919ms** | ran on, then HTTP 500 |

`/api/refresh` fetches a market's four indicators together and then walks the markets **one after another**, inside `maxDuration = 60`. A 149-second call cannot finish in that budget: the function is killed part-way and every market after Canada is never written at all. The only call that behaved was the one that had a timeout.

`AbortSignal.timeout` was adopted partway through the project and never backfilled — **25 of 48 call sites across 16 files had none**. A fetcher without a timeout looks identical to one with a timeout on every day the source is healthy, which is why nothing noticed. All 48 now carry one (8000ms on the scored path, 15000ms for the slower Gulf sources), and `scripts/check-fetch-timeouts.ts` fails CI if a new call site appears without.

### 19.10 Two schedulers were a race, and the email path would have paid for it (2026-09-11)

A bug sweep of production found four markets with **two rows each on 2026-09-04, written under a second apart** at 06:29. GitHub ran once that day, under a concurrency lock, so the second writer was the **Vercel cron** — due at 06:00, fired 29 minutes late. The freshness guard checks *then* writes, so both runs heard "not done yet". The two rows held identical figures, so nothing showed.

What it would have cost, traced through the code rather than assumed:

- **Every watching subscriber emailed twice.** Each run reads the previous band before writing its own, and the sender keeps no record of what it sent. **Fixed:** the alert belongs to whichever run wrote **today's first** `mmai_scores` row (lowest identity id); racing runs always agree on which that is, with no new table and no lock. Deliberate side effect: a same-day forced re-run never emails.
- **The Vercel crons are gone.** `vercel.json` is removed. GitHub Actions runs three times a day under a concurrency lock and is the only scheduler.

Three more email bugs, all **dormant until the sending domain is verified** — which is exactly why they were fixed before it:

| Bug | Fix |
|---|---|
| Unsubscribe deleted on a plain **GET**, so corporate link scanners, which open every link in a message to vet it, would have unsubscribed people who never clicked | GET shows a confirm button; **POST** deletes. Emails now carry `List-Unsubscribe` and `List-Unsubscribe-Post` (RFC 8058), so the mail provider's own one-click button works — POST-only, so no scanner can fire it |
| Every re-subscribe minted a **new token**, killing the unsubscribe link in every earlier email | An existing subscription keeps its token |
| Re-subscribing **replaced** the markets — anyone could type in an address and silently stop its owner's other alerts | Markets are **added**, never removed; removing needs the owner's link. The response no longer echoes the market list, which would otherwise reveal what any address follows |

Also: the unused `latest_scores` view, flagged **ERROR** by Supabase's security advisor (it ran with its creator's rights, bypassing RLS), is removed from `schema.sql`. **The owner runs** `drop view if exists public.latest_scores;` in the SQL Editor, since the MCP connection is read-only. `withRetry` now clamps `attempts` to at least 1, and the audit step fails if the route's response loses a field its gates read.

**Still open, deliberately:** anyone can still sign up an address that is not theirs. Only a **confirmation email** (double opt-in) closes that. It is a product decision plus a schema change, and it should be settled **before** the domain is bought and alerts start flowing.

---

## 20. The "now" snapshot, and why it keeps biting (2026-09-02)

### 20.1 FALLBACK_MARKETS FEEDS PUBLISHED STATISTICS. Treat it accordingly.

It looks like demo data. It is not only demo data:

```
lib/markets.ts  FALLBACK_MARKETS
      |
      +--> demo mode when Supabase is unreachable
      +--> lib/history.ts's final "2026" point   <-- DERIVED since 2026-09-02
                |
                +--> scripts/measure-pillar-influence.ts
                          |
                          +--> PILLAR_EFFECTIVE_INFLUENCE  } PUBLISHED ON
                          +--> PILLAR_CROSS_MARKET_SD      } THE LEARN PAGE
```

**A stale value here becomes a wrong published statistic.** On 2026-09-02 it still held euro area inflation of 2.0 — the figure from Eurostat's retired dataset — and the Learn page consequently told readers that *Growth Momentum* separates the six markets least. **Monetary Conditions does.** That sentence was live for a day.

### 20.2 The duplication is gone; the drift is not

`lib/history.ts` used to repeat the snapshot by hand. It now **derives** the final point from `FALLBACK_MARKETS`, so those two cannot disagree — there is only one of them.

**But nothing notices when `FALLBACK_MARKETS` drifts from the DATABASE.** That needs a live query and CI cannot make one. It has drifted twice in nine days:

- 2026-08-24 — Canada's GDP growth 3.4% vs a real 1.74%, enough to rank Canada first in demo mode
- 2026-09-02 — Euro Area inflation 2.0 (dead source), Japan 3.17 (replaced source)

**Re-sync it whenever a source or a pillar changes.** It is not housekeeping.

### 20.3 A consistency check is not a currency check

`measure-pillar-influence.ts` was already in CI and passing. It enforces that `lib/scoring.ts` matches the panel — and it did. **It cannot tell that the panel itself is stale.** Same shape as the Eurostat failure one level up: something verified faithfully against the wrong input.

### 20.4 Published prose is now generated

The Learn page's separation ranking is built from `PILLAR_CROSS_MARKET_SD`, not typed. Third time this discipline has been applied after a hand-written claim drifted — inflation targets and neutral rates were the first two.

**Rule: if a sentence states a number or an ordering that the engine already knows, generate it.**

### 20.5 Subscriber alerts now fail loudly

Four people are subscribed. Every failure used to go to `console.error` and the run continued — right for one bounced address, wrong for a sender that cannot send, and indistinguishable. **Some** failing is still tolerated; **all** failing sets `notificationsBroken` and fails the workflow.

**LIKELY ROOT CAUSE, NOT FIXED:** emails send from `alerts@mmai-app.vercel.app`. A `vercel.app` address **cannot** be verified as a Resend sending domain — that needs DNS records on a domain you own. **Unconfirmed** (no API key locally), so no user-facing copy was changed on an assumption.

**To confirm in 30 seconds:** Resend dashboard → Domains. If none is verified, alerts have never been delivered and a real domain is the only fix.

---

## 21. Two more second copies removed (2026-09-02)

Both holes here had already caused a real, published error. The pattern is the same one §20 named: **a second copy of an answer that already exists somewhere else.**

### 21.1 The provenance line is GENERATED. Do not hand-write it again.

`SOURCE_NOTES` was a table in `app/api/refresh/route.ts` naming each market's institutions. It is stored on every row and shown to readers, and **nothing bound it to the fetchers that ran.** It had drifted three ways:

- Four markets credited the **World Bank** for data from Statistics Canada, the ONS, the ABS and e-Stat
- Every market credited the **EIA**, which stopped scoring anything when the oil pillar retired
- **No** market credited the **BIS**, which started scoring Fiscal Resilience the same day

Only the first was found by hand. **The other two surfaced the moment the generator was written.**

`sourceNoteFor(market)` in `lib/sources.ts` builds it now; each source carries a `shortName`. The table was **deleted, not corrected** — correcting it leaves the same trap for the next person who changes a source.

**`scripts/verify-sources.ts` guards the registry** (CI): every live scored source needs a `shortName` and a URL, every scored pillar of every published market must resolve to a live source, and no published market may credit the World Bank or the EIA.

### 21.2 The Learn page's statistics now check themselves against live data

`PILLAR_CROSS_MARKET_SD` is published as a measured fact, measured offline from a snapshot a human syncs by hand. It drifted twice in nine days and put a false claim on the page.

**`measure-pillar-influence.ts` ran in CI throughout and passed.** It checks the constants against the panel — it cannot tell the panel is stale. That distinction is the whole lesson: **a consistency check is not a currency check.**

So the check lives in the **refresh route**, where live data exists. It computes each pillar's live spread, compares it to the published constant, and **fails the daily workflow past 1.0 SD points.**

Tolerance is loose on purpose, same argument as the freshness limits: **an alarm that cries wolf gets muted.** 1.0 is about where the published ordering changes, which is when a reader is told something untrue.

When it fires:
1. Re-sync `FALLBACK_MARKETS` in `lib/markets.ts` to the database
2. `npx tsx scripts/measure-pillar-influence.ts`
3. Update `PILLAR_CROSS_MARKET_SD` / `PILLAR_EFFECTIVE_INFLUENCE` in `lib/scoring.ts`

### 21.3 Six verifiers now run in CI

`verify-scoring` · `verify-history` · `verify-published-formulas` · `measure-pillar-influence` · `verify-freshness` · `verify-sources`

Plus, on the daily refresh: observation-age checking, published-statistic drift, and failed-notification detection. **CI proves the code is self-consistent; the refresh job is the only thing that can prove it is still TRUE.** Put checks that need live data there.

---

## 22. Security and accessibility audit (2026-09-02)

First audit of the areas nobody had looked at: code hygiene, dependencies, accessibility, mobile, endpoint security.

### 22.1 THE REFRESH ENDPOINTS FAILED OPEN

```
if (process.env.CRON_SECRET && authHeader !== `Bearer ${...}`)
```

A **missing** secret was read as "no protection configured, let everyone through" instead of "misconfigured, let nobody through". One deleted environment variable — a typo, a new Vercel environment — would have made both refresh endpoints **public**: anyone could burn the BEA, BLS, e-Stat and EIA quotas, write to Supabase through the service role, and fire subscriber emails. None of it loud enough to notice.

`lib/cronAuth.ts` now fails **closed**. The local-development exception is explicit and can never apply in production, because `NODE_ENV` is `production` there.

### 22.2 The public write endpoints had no volume limit

`/api/subscribe` and `/api/feedback` validated input carefully — so *bad* submissions were refused, and nothing refused *ten thousand good ones*. Filling `subscribers` with fake addresses is worse than noise: those get emailed, and bounce complaints damage a sending domain permanently.

`lib/rateLimit.ts`: 10 writes per 10 minutes per address.

**Be honest about what it is.** An in-memory counter inside one serverless instance. Vercel runs several and recycles them, so an attacker spreading requests gets more through than the number suggests, and a cold start forgets everything. It costs nothing and turns "unlimited" into "awkward". **If real abuse ever appears, replace it with a shared store — do not tune it.**

Limits are generous on purpose: a limit that catches real users gets removed, and then there is no limit at all.

`scripts/verify-security.ts` pins both in CI, setting and restoring `NODE_ENV`/`CRON_SECRET` around each case so it tests the LOGIC, not the machine's configuration.

### 22.3 The charts were silent to screen readers

Recharts renders an SVG of `<path>` elements. To a screen reader that is **nothing** — and the charts *are* the content on Trends and Compare, so the site's main feature did not exist for those users.

Every chart now carries a description generated from the same `series` it draws:

> "Line chart. Government Debt (% of GDP) (Japan): falling from 211.8% at 2019 to 178.8% at 2026."

**Rounded to one decimal deliberately** — the first version read out *"seventy point five one seven five"*. Caught by opening the page and reading the label, not by a test.

Also fixed: `h1 → h3` skips on Trends and Gulf Watch (CSS now styles h2 and h3 identically so the tag can be chosen for **structure**, not looks); `scope="col"` on every `<th>`; `aria-hidden` on the five pillar rings, which made a screen reader read each score twice.

### 22.4 What was already right — do not regress it

`lang`, one `h1` per page, skip link, `main`/`nav` landmarks, alt text on every image, accessible names on every control, `aria-pressed` on every filter chip, `rel="noopener"` everywhere, and `Flag`/`CountryGlyph`/`WorldMap` already handling keyboard and ARIA correctly. **Mobile at 375px has zero horizontal overflow on every page.**

The CSV export is the best-built thing in the repo: quote/comma/newline escaping, a UTF-8 BOM for Excel, and pagination with a unique tiebreaker that survives Supabase's Max Rows setting.

### 22.5 Clean

0 dependency vulnerabilities. No real `any` (the one match is the word in a comment). All 28 `@ts-ignore` are in Next.js generated files, none in ours.

---

## 23. The composite was rebuilt from scratch (2026-09-03 → 2026-09-04)

**Branch `composite-three-dimensions`, PR #1. Not merged, not live.** The
five-pillar engine still produces every published number. This section is the
one to build against; §5 describes what is being replaced.

### 23.1 Why

The five weights — 25 / 25 / 18.75 / 18.75 / 12.5 — were never calibrated
against anything. 18.75% is not a decision, it is 15 ÷ 0.8: a sixth pillar was
dropped and the rest were scaled up to fill the gap. Asked "why 18.75?", there
was no answer that survived the question, and the project's own charter already
said the constants were not scientifically justified.

Four alternatives were tested before the rebuild. Equal weights (refuted for
the inflation/unemployment pair by Blanchflower, who tests it directly), PCA
(unstable — growth's weight swings 31 points depending on which half of history
you use), a central-bank loss function (costs 40% of recession detection), and
wellbeing coefficients. Only the last survived, and only partly — see 23.5.

### 23.2 The design

```
CONDITIONS  =  w_pi · Q(|pi - pi*|)  +  w_u · Q(unemployment)
DIRECTION   =  Q(GDP growth)                      -- one indicator, no weight
CAPACITY    =  0.5 · Q(debt)         +  0.5 · Q(policy rate)

Q = ±(X - mu) / sigma          sign aligned so positive always means better
C' = C / sd_C, and likewise    each dimension standardised across the history
MMAI_Z = (C' + D' + K') / 3    then read as a PERCENTILE of 148 market-years
```

**Why the dimensions are standardised before averaging.** They do not vary
equally — Conditions moves about a third less than Direction. Averaging raw
would hand Direction the larger voice whatever the 1/3 beside it said. That is
the nominal-versus-effective weight trap, and it is the error the five-pillar
design actually contained.

**The published score is a rank, not a mark out of 100.** 148 market-years, six
economies, 2000–2025, pooled. Strictly-less-than, so ties resolve downward. One
step is 0.675676 points; nothing finer is meaningful.

### 23.3 What it produces

| Market | Old | New | Conditions | Direction | Capacity |
|---|---|---|---|---|---|
| Australia | 82.8 | **85.1** | 80.4 | 50.7 | 83.8 |
| United States | 79.1 | **64.2** | 70.9 | 48.6 | 54.7 |
| United Kingdom | 78.2 | **60.8** | 71.6 | 19.6 | 68.9 |
| Japan | 82.2 | **50.7** | **100.0** | 14.9 | **9.5** |
| Canada | 73.5 | **39.9** | 41.2 | 25.7 | 48.6 |
| Euro Area | 75.6 | **38.5** | 37.2 | 23.0 | 52.7 |

Japan is the case the old index concealed: the best Conditions of every
market-year on record, Capacity in the 9th percentile. Those genuinely offset,
and "82.2, second best overall" told a reader neither fact.

### 23.4 A defect that made two of six rankings wrong

The first version of the analysis scored every historical row's Direction as
**GDP growth alone**, because the bond-yield history was collected and stored
but never joined onto the annual panel — while the six live markets scored it
as growth blended with the yield slope. Two different quantities compared on
one scale.

Found by one number: the historical Direction series reported a standard
deviation of **exactly 1.0000**, which is only possible for an untouched
z-score. Corrected, the US and UK swapped and Canada and the Euro Area swapped.

**Under the new design sd(D) = 1.0000 is CORRECT** — Direction is a single
z-score and carries no internal weight. `lib/composite.ts` and
`verify-composite.ts` both say so. Do not "fix" it.

### 23.5 No weight in this method is measured

The Conditions split comes from Blanchflower (2007), NBER WP 13505. Read
directly from the paper: the coefficient is estimated on the **inflation
RATE**, evaluated around a sample mean of 4.9%, and the paper contains no
mention of a target, a deviation or a gap. MMAI applies it to |pi - pi*|.

Those are not the same quantity. |pi - pi*| is V-shaped — below target it rises
as inflation falls — while Blanchflower's relationship is linear and monotone.
**67 of the 148 rows (45.3%) sit below target**, and on every one of them MMAI
penalises what the cited source calls a benefit.

Scoring inflation on the level restores the coefficient's legitimacy (ranking
unchanged, scores move ≤9.5 points) but makes nine deflation rows best-in-sample
and turns Japan's deflation decade into its strongest period. Not defensible
either.

**Decision: keep the gap, reclassify the weights.** 0.381355932 / 0.618644068
is a **declared judgment informed by** the evidence, not measured by it. That
qualification travels with the weight wherever it is published. A search for a
source estimating the welfare cost of deviation *from a target* found nothing
that fits — the wellbeing literature uses levels throughout, and welfare loss
functions weigh a gap against an *output* gap, which MMAI has no equivalent of.

Accounting: **0 measured, 4 declared judgments, 3 conventions.**

### 23.6 Equal thirds is a convention, and is not equal in effect

Declared 33.3% each. Measured across the reference history: **Conditions 25.5%,
Direction 39.6%, Capacity 34.9%** — a 14-point spread. The dimensions correlate
with each other (Direction × Capacity = 0.34; Conditions is nearly independent
of both), so the composite tracks some more closely than others.

This is the nominal-versus-effective gap one level up. Standardising equalised
their **spread**, which is what it was for. It does not equalise their
**influence**, and nothing can while they stay correlated. Published on Learn,
not hidden, and re-measured in CI.

### 23.7 Three publication decisions, adopted and binding

1. **The ±2.3 percentile-point source-break uncertainty is disclosed.**
   Rebuilding the whole reference history on a single source moves any score by
   up to that much; the ranking is unaffected.
2. **Equal thirds is described as a stated methodological convention**, never as
   an empirical finding.
3. **Countries closer together than the measured uncertainty are shown as tied.**
   Canada and the Euro Area currently are, at 1.4 points apart.

### 23.8 Verified by a third party, blind

Australia 2026 = **85.135135135** was reproduced from the published CSV and
specification alone, by a party with no knowledge of the expected result, using
executed code and a second implementation as a cross-check. Every figure matched
to floating-point precision — the three dimension standard deviations, the
composite, the ladder count, the percentile.

It found two real drafting defects, both fixed: the specification said 11
columns when the CSV had 12, and the brief simplified the standardisation step
in a way that described a different algorithm from the spec.

**That case is pinned in `verify-composite.ts` and runs in CI.** If it ever
fails, the engine has drifted away from the thing that was externally verified.

### 23.9 Missing data

The composite is **all-or-nothing** — a missing indicator withholds it rather
than reweighting, because a country scored on four indicators is not comparable
with one scored on five, and that comparison is the product.

Taken literally that blanks a country whenever one government website has a bad
morning. It happened on 4 September: Statistics Canada's unemployment fetch
failed and Canada had no score while the previous day's row was complete.

So the score comes from the most recent **complete** observation and the page
says which: *"Scored on 3 September data — the latest complete observation.
Today's figures are missing unemployment."* Nothing is interpolated.

**Bounded at 14 days** (`lib/latestComplete.ts`). Without a limit a permanently
broken source would freeze a stale score on screen and the site would look
healthy while being wrong.

### 23.10 Files

| | |
|---|---|
| `lib/referenceSet.ts` | The 148 rows, generated from the published CSV, carrying its SHA-256 |
| `lib/composite.ts` | The engine. Every constant DERIVED at load, never typed |
| `lib/latestComplete.ts` | The complete-observation rule and its bound |
| `scripts/verify-composite.ts` | Recomputes every constant independently; pins the acceptance case |
| `scripts/measure-dimension-influence.ts` | Effective influence and separation; `--check` in CI |
| `scripts/test-latest-complete.ts` | The fallback rule |
| `scripts/test-alert-guard.ts` | The cutover alert guard |
| `supabase/migrations/2026-09-04-three-dimension-composite.sql` | **Already applied** |

### 23.11 Cutover — four switches, when PR #1 is approved

1. `ALERT_ENGINE` → `"v2.0"` in `app/api/refresh/route.ts`
2. `band` reads `percentileBandLabel` instead of `bandFor`
3. Delete `lib/publishedFormulas.ts`, `scripts/verify-published-formulas.ts`, and that CI step
4. Retire the five-pillar engine and its columns

**The alert guard matters most.** On cutover every market's band changes at once
because the method changed — Japan 82.2 → 50.7 with nothing happening in Japan.
The pillar-shape signature cannot catch that (coverage is unchanged, the formula
moved), so the guard compares the engine **behind the band** — deliberately not
the row's raw version stamp, which would silently suppress real alerts every
time a source hiccup dropped the v2 score. Tested across all three phases.

### 23.12 What a new session must not do

- **Do not reintroduce the five pillars**, or extend them.
- **Do not "fix" sd(Direction) = 1.0000.** It is correct by construction now.
- **Do not describe any weight as measured.** None are. The site says so.
- **Do not hand-type a constant or a formula into a page.** Learn generates
  every one from the engine, because a hand-typed formula drifted once already
  (31 August) and the page promises a reader can reproduce a score by hand.
- **Do not reweight around missing data.** Withhold, fall back to the last
  complete observation, or show N/A.
- **Do not grep source to check copy.** Every remaining "five pillars" in the
  repo is inside a comment, so source greps come back clean while a page still
  displays it. Fetch the rendered HTML — that is how the Trends eyebrow and the
  Compare meta description were caught.

---

## 24. The investor dashboard, and two drawings (2026-09-12)

`/dashboard` exists for one reader — an **investor** — and answers three
questions in order: where is the macro environment supportive, what has
changed lately, and what does money cost. It is `app/dashboard/page.tsx`
(metadata) wrapping `app/dashboard/DashboardInner.tsx` (all of it).

### 24.1 It reads, it does not recompute

Scores, bands and the three dimensions come from `mmai_scores` exactly as the
refresh wrote them. `mmai_scores` stores the **standardised** dimension values,
which read as 1, 0, −1 and mean nothing to a reader, so the page converts them
through **`dimensionPercentiles`** — the same function every other page uses.
That conversion lives in ONE helper, `dimsOf()`, used by both the table and the
map. It was duplicated inline for about an hour and that is exactly how the two
market-colour maps that disagreed on five of six markets began.

Raw figures go through `latestCompleteObservation`, so this screen cannot quote
a figure the rest of the site has already stopped showing.

### 24.2 What it deliberately does not show

**A trend line of the SCORE.** The engine changed on 5 September 2026 (§23), so
score history is about a week long and anything spanning that date is not
comparable. "What moved" is built on the **indicators** instead — monthly back
to 2019, same measure throughout — which is what an investor wants anyway: not
"the score fell" but "inflation stopped falling and unemployment turned up".

### 24.3 `components/PositioningMap.tsx`

A quadrant scatter of the three dimensions: **Direction** across, **Conditions**
up, **Capacity** as the radius. It answers the question the composite hides.
Japan is the standing example — Conditions 100, Direction 15 — which its score
of 50.7 cannot say on its own.

Three rules built into it, each of which a future edit will be tempted to break:

- **It never moves a dot.** Canada and the Euro Area sit almost on top of each
  other. Only the **label** is displaced, with a leader line back to its dot.
  Moving the dot would be moving the finding.
- **Captions live in the padding, not the corners.** Japan's dot sits hard
  against the top of the plot and landed on "strong but fading" when the
  captions were drawn inside. `PAD.top`/`PAD.bottom` are sized for the largest
  radius (18) **plus** a caption clear of it.
- **It renders nothing until measured.** `width` starts at 0 and a
  ResizeObserver fills it, so the viewBox scale is always 1. A guessed 720
  inside a 247px phone card is the 3.2px axis-label bug (§16) reached by
  another route — `check-layout` caught it at 320px during this change.

Below 300px of plot the captions shorten ("strong, rising") and dots scale to
0.7, because two full captions are wider than a phone's plot and would collide
over the centre line.

### 24.4 `components/Sparkline.tsx`

The `2y` column beside each figure in "What moved": the last 24 months, drawn
to its own range, no axes and no numbers. A spike that came back down and a
steady glide to the same place are different facts, and the level and the
change either side of it cannot tell them apart.

- **`aria-hidden`, on purpose.** The row already states the figure and the
  change in text. This is texture, not information a screen reader should be
  read as a squiggle it cannot interpret.
- **Nulls break the line.** They are never bridged. The break in the US
  inflation and unemployment lines is **October 2025**, the month BLS published
  nothing during the shutdown. Japan has no monthly inflation series at all
  (§ "What moved" note), so that cell renders a dash, not an empty box.

### 24.5 A trap worth recording

A throwaway check script reported "no gaps" for the US series while the rendered
page clearly drew two segments. The script was wrong, not the component: it
mapped gaps to `p.month` on a type whose field is `period`, so `gaps` was
`[undefined]` and `gaps.join(", ") || "none"` printed "none". **The rendered
page was right and the verification script was lying.** Check the page before
trusting a script written to check the page.

### 24.6 Verification on this change

All **23** checks — the 19 offline ones plus `check-layout`,
`check-runtime-errors`, `check-text-legibility` and `check-accessibility`.

Two operational notes for whoever runs them next:

- `pkill -f "next start"` does **not** kill the server on Windows. A stale
  server kept serving a previous build's HTML against a wiped `.next`, and
  `check-runtime-errors` failed with 500s on a chunk that no longer existed —
  three times, looking exactly like a real CSP/MIME bug. Kill it by port:
  `Get-NetTCPConnection -LocalPort 3123 -State Listen` → `Stop-Process -Force`.
  And never rebuild while the old server is still serving `.next`.
- The two collisions in §24.3 were found by **looking at the rendered page**.
  No check failed on either, and no build would have.

---

## 25. Norway, South Korea, and four sources that had quietly died (2026-09-12 → 13)

The index went from seven scored markets to nine. More usefully, the two
days produced a **test a candidate country has to pass**, and it rejected
eight of the ten countries examined — for reasons that were never about
bad data.

### 25.1 The scope boundary, stated at last

MMAI is calibrated for **mature, floating-rate, inflation-targeting
economies whose GDP measures domestic activity**. That was always true and
was never written down, so it got rediscovered five times in two days.

A market can only be scored if its readings land **inside** the 148-row
reference distribution. Outside it, the score stops being wrong and starts
being *meaningless* — the dimension pegs and stops responding to the thing
it measures.

| Country | Reading | Distance | What happened |
|---|---|---|---|
| Turkey | policy rate 37% | **+17.9σ** | Capacity pegs at 100, ranks 1st |
| South Africa | unemployment 32.4% | **−12.7σ** | scored exactly **0.0**; a fall to 25% would not move it |
| Brazil | policy rate 14% | **+6.1σ** | Capacity pegged, ranked 1st at 99.3 |
| Denmark | GDP 3.42% avg | — | worth **32 points**, would rank 2nd of 9 |
| Malaysia | — | — | Bank Negara publishes **no inflation target** |
| Thailand | unemployment 0.8% | below the record's floor | informal-sector absorption |
| Poland, Czechia, Hungary | — | — | OECD prices frozen at 2025-12 |

Two deserve emphasis because they were nearly added:

**Brazil had the best data found anywhere** — Banco Central do Brasil's
SGS API, no key, no registration, all five indicators current, ODbL
licence. It fails on *interpretation*: a 14% rate in an emerging market is
a risk premium, not room to cut.

**South Africa's data is completely honest.** Stats SA measures 32.4%
unemployment properly and it really is that high. It fails because nothing
in the reference record exceeds 12%.

The screen to run on any future candidate is in
`scripts/verify-korea-fetch.ts`: every reading within ~3σ, checked before
wiring anything.

### 25.2 Norway — the blocker that never existed

Norway was paused on 2026-08-22 pending written confirmation from Norges
Bank that commercial reuse of the Key Policy Rate is permitted. Their own
terms do not say.

**Nobody ever needed to ask.** BIS republishes that rate, naming Norges
Bank as source, under terms that permit commercial use with citation —
the identical route already carrying Saudi Arabia's and Kuwait's since
August and Sweden's since days before. The answer sat in
`lib/fetchers/bis.ts` the whole time it was being waited on.

**The lesson is not about Norway.** A blocker was written down once and
re-read as settled every time anyone looked. When a market is parked on a
licence question, check whether an aggregator already carries it before
waiting on an institution.

Norway's unemployment and GDP also moved off World Bank **annual** series
(the unemployment one an ILO *modelled estimate*, not Norway's own
measurement) onto Eurostat. Inflation stays with Statistics Norway,
because Norges Bank's 2% target is set on Norway's own CPI.

### 25.3 South Korea — and why the name says South

The ninth market, and the first needing **no new institution and no new
licence**: OECD for inflation, unemployment and GDP; BIS for rate and
debt. Every reading sits inside 1.6σ.

Every institution calls it simply "Korea" — OECD `KOR`, BIS `KR`, the
Bank of Korea. That is unambiguous to a statistician, because North Korea
publishes no macro data and appears in none of these sources. It is **not**
unambiguous to a reader looking at a flag and a score, so the site says
**South Korea** while the Sources page still names institutions as they
name themselves.

### 25.4 OECD DOES NOT ANSWER FROM VERCEL

Korea merged green and failed on its first real refresh. The stored row:

    policy_rate    3       BIS      ok
    debt_pct_gdp   45.7    BIS      ok
    inflation      null    OECD
    unemployment   null    OECD
    gdp_growth     null    OECD

Five calls, one runtime, one moment. Both non-OECD ones worked.

**This project already knew.** Japan's unemployment has been fetched by
the GitHub Action with curl and relayed since August for exactly this
reason, and that workflow step sits thirty lines above the one calling the
route.

Korea's three series are now relayed the same way — for both
`/api/refresh` **and** `/api/source-audit`, which also runs on Vercel. The
direct fetchers stay and are tried first: they work everywhere that is not
Vercel, including the verify scripts.

**OECD also rate-limits hard**, on a window longer than a single call.
Concurrent requests return HTTP 500 for *all* of them, including ones that
work alone — which reads exactly like "OECD has no data for this country"
and is false. A parallel probe reported no OECD data for Japan, which this
project fetches every day.

### 25.5 Four dead sources, all returning HTTP 200

Every one answers with a plausible number and a stale date:

| Source | Frozen at | Age |
|---|---|---|
| OECD prices, Japan | 2021-06 | five years |
| OECD prices, Chile | 2023-12 | |
| OECD prices, Mexico | 2024-07 | |
| OECD prices — France, Poland, Czechia, Hungary, Switzerland | 2025-12 | |
| Eurostat `prc_hicp_manr` (incl. Denmark) | 2025-12 | retired 2026-02-04 |

The rot is **per country**: the US, UK, Germany, Canada and Australia are
current in the same dataflow.

**Every OECD-sourced series must carry an age guard.** Korea's do, matching
the one protecting euro area inflation after Eurostat's retirement cost
nine months of a wrong published figure.

### 25.6 A withheld score could not be written at all

The refresh route wrote `band = null` when a score is withheld, above a
comment claiming that was "the intended behaviour and what the mmai_scores
check constraint enforces". The schema says the opposite: `band text not
null`. So a market with a missing indicator could not be written **at
all** — the insert was refused, and on the site a market with no row is
indistinguishable from one never configured.

Dormant for months because every market had always returned all five
indicators. Korea was the first to arrive incomplete — precisely the
moment the site most needs to record something.

`percentileBandLabel(null)` already returns "Not published".
`scripts/test-withheld-score-is-storable.ts` holds the line.

### 25.7 Three tests that read stronger than they were

Worth recording together, because the pattern is the point: **a test can
pass without checking anything**, and only a mutation catches it.

- `verify-freshness` asserted *"there are eight"* BIS debt rows as a
  literal. Korea broke it. It now checks every scored market **has** a debt
  row, by name.
- `test-market-count-copy` policed the word "market". Three pages said
  **"Six economies"** while nine were scored — the homepage, About, and
  Compare's h1 — and it passed every time.
- Widening that test then made it **inert for ten minutes**: inside a
  template literal `` `\b` `` is a backspace character, not a word
  boundary, so the regex matched nothing and every assertion passed on
  every input. It now tests **itself** against strings it must and must not
  catch, before it is trusted on real pages.
- The green ban had the same shape of hole: `g > r+40 && g > b+40` misses
  olive, emerald and chartreuse. Found by *searching* the colour space for
  Korea's colour, not by anything failing. Hue is checked now.

**Every new test in this section was verified by reintroducing the bug and
confirming the suite goes red.** A test added without that is a guess.

### 25.8 Completeness — the thing a person kept catching

Adding a market touches **ten files** and the compiler enforces none of
it: each is a `Record` keyed by string, so a missing entry is an empty
chart, not a type error.

- Sweden shipped with no flag, map shape or glyph. The site owner reported
  it.
- Norway shipped with annual history only. Its charts rendered, so nothing
  looked wrong, and the monthly view was empty for a day.
- Korea shipped with no history at all — four empty panels on a page
  called Data Over Time.

`scripts/test-market-completeness.ts` now asks the question for every
market and every file at once, and runs in CI.

### 25.9 What a new session must not do

- **Do not fetch OECD from a Vercel route.** Relay it from the workflow.
- **Do not fire OECD requests concurrently.** Space them; a 500 means wait,
  not gone.
- **Do not add an OECD series without an age guard.** Four have died.
- **Do not add a market without running the σ screen first.** Eight of ten
  candidates failed it, and none failed for having bad data.
- **Do not hand-type a count into copy**, in any noun. It is right until
  the next market and silent afterwards.
- **Do not add a test without a mutation run.** Three in two days read
  stronger than they were.
- **Do not rewrite "six" where it describes the REFERENCE SET.** 148
  market-years from six economies is frozen and stays six however many
  markets are scored.

## 26. The site stopped looking generated: "Editorial Dark" (2026-09-15)

The owner felt the near-black + neon cyan/violet look (gradient buttons,
frosted glass, a glow behind every page, Space Grotesk, centred hero) read
as "made by AI". Three directions were mocked up on the real homepage with
live scores; the owner picked a tightened dark one ("3B").

**The palette** — all tokens in `app/globals.css :root`, with the rules
written above them:
- page `--paper #101826`, cards `--white/--card-bg/--glass #131D2E` (solid;
  no glass anywhere), rules `--hair #253247`, text `--ink #E9ECF1`,
  `--ink-soft #C5CCD7`, `--slate #9BA6B7`.
- ONE accent, gold `--accent #D4B06A`, spent only on what is current or
  chosen: the homepage score number, the selected market's underline, the
  latest point on the trend, the result in the Learn diagram. `--accent-2`
  is now a light neutral, not a second brand colour.
- A selected control is a solid off-white fill (`--on-bg`) with navy text
  (`--on-ink`). Buttons are `.btn-primary / .btn-secondary / .btn-quiet`.
- Type: Source Serif 4 headings (`--font-display`), IBM Plex Sans body
  (`--font-body`), IBM Plex Mono for figures (`--font-num`).
- Links in running text are underlined (`#main-content a:not([class])`),
  because they are no longer violet.

**Data colours kept their meaning.** Market lines, dimension tones and the
score ramp are data, not chrome. Three were lifted slightly because they
fell under 4.5:1 on navy: UK / Conditions red `#E14B4B → #E85A5A`, Euro Area
violet `#8B5CF6 → #9B70F8` (also the ramp stop), missing-score grey
`#7B8096 → #838AA0`. The dimension tones now live once, as
`DIMENSION_TONE` in `lib/composite.ts` (they were copied into five files).
Gold is NOT a ramp stop — the earlier note about gold→cyan passing through
green still applies to the ramp.

**Homepage score:** the number is gold; the ramp colour moved to the bar
and a swatch in the band pill, with the band written in words.

**Nav:** the menu button now takes over below 1100px, not 900. Eleven links
need ~1,045px on one row; at 960 every page scrolled 83px sideways.

**Two new CI checks** (scoring job):
- `scripts/check-palette.ts` — fails on Space Grotesk, blur, glow
  (text-shadow, drop-shadow, feGaussianBlur, blurred box-shadow),
  brightness/saturate filters, CSS gradients, the retired colours and the
  pre-lift data colours. Self-tests every rule against a sample.
- `scripts/check-palette-contrast.ts` — every text token, market, dimension
  and stablecoin colour, the N/A grey and the whole score ramp (0–100 in
  0.5 steps) against both page and card, read from globals.css. No browser,
  so it is not at the mercy of the day's scores.
`check-layout.ts` gained a 1101px width; `check-accessibility.ts` and
`test-stablecoin-series.ts` measure against the navy grounds.

**Found and fixed on the way** (both were live before the restyle): the
Learn diagram's Direction card printed "gdp growth" on top of "51
percentile"; the homepage axis put "+2.5 sd" a line below "−2.5 sd".

**Do not** reintroduce a second accent, a gradient or a glow "just for
emphasis" — the checks will fail, and that is the point.

**Next (owner chose, not built yet):** homepage additions from the mockup —
strongest/weakest dimension line, yearly score trend 2019–2025 + today, the
period each figure describes under its bar, and an "Updated … · 9 markets"
status line. No monthly score history exists; the trend uses yearly scores
from `lib/history.ts` via `computeMmai`.

**Learn page on phones and tablets (same PR, after the owner tested the
preview on an iPhone).** The two wide diagrams — the 940px score recipe and
the correlation ring/triangle — were sideways scrolls that hid the answer.
Below 1000px each now renders a second, stacked HTML drawing instead
(`.only-narrow` / `.only-wide` in globals.css; exactly one is displayed, so
a screen reader hears it once). Same engine numbers in both. Also: topic
cards moved from inline styles to `.learn-topic` with phone padding; the
per-market target list no longer breaks mid-entry; the five steps are one
column below 1000px; desktop recipe labels no longer sit on their lines;
and a stale "Five of the six aim at 2%" beside a list of nine was corrected.

## 27. The homepage map, and formulas in words (2026-09-15)

**Map stripes were a data bug.** Russia, Fiji and Antarctica cross the
180° line; their outlines jumped edge to edge, and the SVG fill drew
full-width bands over Canada/Alaska and the Pacific. `lib/mapdata/seam.ts`
unwraps each ring and draws it on both sides of the map (the viewport clips
both); Antarctica is dropped below the crop. `scripts/test-map-seam.ts`
(CI) asserts the raw data still crosses and the repaired data never jumps
more than half the map.

**No score labels on the map** (supersedes the label anchors and
CROP_HEIGHT 420 recorded in the earlier map section; the crop is now 400). Norway/Sweden overlapped and South Korea
had no label at all. The map now shows where (soft ramp colour, selected
market full strength with a gold outline); the ranked key beneath it —
real buttons — carries every score. Country cards are a fixed 3×3 (one
column on phones) with grey silhouettes, gold when selected; the score
number keeps the ramp colour. Norway's glyph no longer includes Svalbard.

**Learn page formulas.** Each indicator now leads with a sentence and two
worked values generated from `INDICATOR_STATS` and `q()`; the exact
formula is behind "Show the exact formula" and is still what
`verify-published-formulas.ts` parses. Three false statements removed:
the debt note described the retired five-pillar 60% rule ("full marks",
"gentle penalty"); "for the current six" (nine are measured); and Gulf
Watch's "no policy-rate feed / 70% pillar coverage" (Saudi and Kuwait are
live via BIS; the real reason is labour-market comparability).

## 28. WHERE THINGS STAND — 16 September 2026 (read this first)

Everything below was true at commit `b07c8a7`, with `main` clean and
deployed. Sections 1–27 are history; this is the state.

### What is live
- **Nine scored markets:** US, Euro Area, Canada, UK, Japan, Australia,
  Sweden, Norway, South Korea. Scored by the three-dimension composite in
  `lib/composite.ts` (Conditions, Direction, Capacity), published as a
  percentile against **148 market-years from six economies, 2000–2025** —
  a frozen reference set that stays six however many markets are scored.
- **Gulf Watch:** six Gulf countries, raw indicators, deliberately no
  score (labour-market figures are not comparable). Saudi and Kuwait carry
  a BIS policy rate.
- **The Observatory:** Denmark and Finland, tracked with real figures and
  no score, each with a published reason. Sources: ECB HICP, Eurostat
  (unemployment, GDP, 10-year yields), BIS (policy rate, debt).
- **Look and feel:** "Editorial Dark" (§26, §27) — navy ground, one gold
  accent for what is current or chosen, Source Serif headings, IBM Plex
  Sans body, Plex Mono figures. No gradients, glow, glass or Space
  Grotesk; `scripts/check-palette.ts` fails the build if they return.
- **Refresh:** GitHub Actions, three times daily, writing to Supabase.
  OECD is unreachable from Vercel, so Japan and Korea come via a relay
  step in the workflow (§25).

### Open, and waiting on the owner
1. **Homepage additions the owner already chose** (mocked up, not built):
   strongest/weakest dimension line; a yearly score trend 2019–2025 plus
   today (no monthly score history exists — use `lib/history.ts` through
   `computeMmai`); the period each figure describes under its bar; an
   "Updated … · 9 markets · rechecked daily" status line.
2. **More Observatory countries.** Probed live on 16 September against the
   existing sources, so no new licences are needed:
   - Full data today: **Poland, Czechia, Hungary** (own central banks);
     Germany, France, Italy, Spain, Netherlands, Belgium, Austria,
     Ireland, Portugal (euro members, ECB rate). Luxembourg works but its
     GDP figure runs ~6 months behind.
   - Everything except BIS debt: Romania, Bulgaria, Croatia, Slovakia,
     Slovenia, Estonia, Latvia, Lithuania, Cyprus, Malta.
   - **Greece works but Eurostat files it under `EL`, not `GR`.**
   - Switzerland and Iceland need new sources (no ECB HICP, no Eurostat
     10-year yield).
3. **A tenth scored market.** Czechia is the strongest candidate. Israel
   was declined by the owner. Brazil has the best data found anywhere but
   its licence is share-alike (ODbL) and needs a decision.
4. **Owner-only tasks:** buy the domain, then set `NEXT_PUBLIC_SITE_URL`
   in Vercel and the `SITE_URL` repo variable; verify the Resend sending
   domain so band-change alerts can actually send; take a database backup.

### How this project is run (do not skip)
- The owner is **not a developer**. Explain in plain language, and never
  hand over a diff to judge.
- **A reviewer reads every plan and every diff before merge** — Fable
  when it has credits, otherwise Opus. Both gates: before writing code,
  and before merging.
- **Commit and push only when the owner says so.** Before merging, assert
  every check is SUCCESS (`gh pr view <n> --json statusCheckRollup`).
- **Verify against the live source before wiring anything in** — this rule
  has caught a dead Eurostat dataset, the wrong Swedish inflation series,
  and three rotten OECD series.
- **Every new test gets a mutation run**: break the thing on purpose and
  confirm the test fails.
- Local checks: `npx tsc --noEmit`, `npm run lint`, `npm run build`, then
  the scripts in `.github/workflows/ci.yml`. Five of them need a local
  server: `npx next start -p 3123` (on Windows, stop it by port, not by
  name).

### The files that carry the context
- `MMAI_MASTER_HANDOVER.md` (this file) — the full history, section by
  section, and this state page.
- `MMAI_TODO.md` — the plain-language to-do list.
- `MMAI_CHANGE_LOG.md` — what changed and why, per change.
- `AGENTS.md` / `CLAUDE.md` — instructions for the coding assistant.

## 29. Warmer, on the owner’s judgement (2026-09-16)

The owner compared the live site with the original mockup and said the
tightened version read "a bit dry". Four of direction 3’s warmer moves came
back, deliberately short of the full mockup:

- **A selected control is GOLD, not off-white** (`--on-bg`), so "chosen" is
  the warmest thing on the page — selected market, active nav item, active
  filter, primary button. Navy on gold is 8.65:1.
- **One accented phrase per headline**: `.hl` — italic, gold, used on the
  homepage and About hero only.
- **Section eyebrows are gold** rather than grey.
- **Fraunces** replaces Source Serif for headlines (it carries the true
  italic the accented phrase needs).
- **Softer shapes**: card radius 6 → 10px, controls 4 → 6/8px, a little more
  padding, and the 2px hover lift back on cards (under
  prefers-reduced-motion: no-preference).
- The band pill beside the score is gold-tinted again, keeping the ramp
  swatch that says which band it is.

What did NOT come back: gradients, glow, glass. `check-palette.ts` still
fails the build on all three, and every contrast check still passes.

### 29.1 Signs of life, and a score ramp that suits the ground (same PR)

The owner asked for the Sources page to read "like a live terminal of a
stock exchange", said the homepage felt dead, and called the map colours
unappealing. Three changes:

- **`components/LiveBar.tsx` + `lib/liveTime.ts`**: a breathing dot, the
  word LIVE, the facts that belong beside it, and a refresh time that
  TICKS — "22 h 07 m ago", moving every 30 seconds. On the homepage hero
  and at the top of Sources. The clock is `useSyncExternalStore` with a
  null server snapshot (no hydration mismatch) and a tick-bucketed client
  snapshot (no render loop); an effect that called setState failed lint
  for exactly that reason.
- **The Sources table reads like a register that is running**: LIVE badge
  with its own pulsing dot, timestamps in full ink and mono tabular
  figures with the relative time beneath, institution links that turn
  gold on hover, and a row highlight under the pointer. The pulse stops
  under prefers-reduced-motion.
- **The score ramp was retuned** (`lib/indicators.ts`): clay red → neutral
  → blue, a diverging scale, which is what a percentile against a record
  is. The old red → orange → violet → cyan was left over from the neon
  palette and went muddy on navy — the map came out brown and purple.
  Measured before shipping: nothing under 4.60:1 on either surface, no
  green, and 39 dE clear of the gold accent so a score is never mistaken
  for "chosen". Map fills went 0.55 → 0.72 opacity.

### 29.2 Movement, and a darker ground (2026-09-16)

The owner said three times that the site felt dead, and each answer was
more colour. It was not colour: nothing on the page ever moved.

- **`components/MarketTicker.tsx`**: every market scrolling along the top
  — flag, code, score in its ramp colour, and the move against the last
  FULL year (computed through `computeMmai` on `lib/history.ts`, never
  typed). Pauses on hover and on focus; each item is a real button.
- **The score counts up** to itself in ~650ms (`ScoreDisplay`), and the
  homepage **trend line draws itself in** (`pathLength={1}` + a dash
  animation). Every setState sits inside the animation frame: the lint
  rule forbidding setState in an effect body is right, and both of these
  were rewritten because of it.
- All of it stops under `prefers-reduced-motion`, and nothing is hidden
  when it does — the ticker wraps and reads as a list.
- **`check-palette.ts` now allows a gradient inside `mask-image`** (the
  ticker fades its own edges; a mask paints no colour), and self-tests
  that exception alongside the repeating-gradient one.

**A darker ground.** The owner asked for black, for contrast. Measured
first: every colour GAINS on a darker ground, so nothing had to change
for legibility. The ground went to `#0A0F1A` — near-black with a trace of
navy left in it, keeping the site's own identity — with the panels, hairlines,
hover and track greys re-tuned to match (they are navy-tinted, and on a
pure black they would have read as blue boxes floating on black). Gold is
now 9.32:1, the weakest point of the score ramp 5.22:1.

## 30. The ticker carries news, from the institutions themselves (2026-09-16)

The owner asked whether the ticker could carry news, and whether an API
existed for it. General news APIs were researched and rejected: nearly
all forbid republishing headlines or want a contract, which breaks this
project’s rule of clean, already-granted licences. Three things shipped
instead, all first-hand.

**1. The site’s own figures as events** (`lib/tickerEvents.ts`). Two stored
readings become one line: a band change ("Japan moved up into Above
average") or a figure that moved ("UK inflation 2.9% → 3.1%"). Band
changes win. Age gate 14 days, one line per market, five at most — BIS
published government debt on 16 September and every market moved the same
day, filling the strip with nine near-identical lines.

**2. Two outside feeds** (`lib/fetchers/newsFeeds.ts`):
- **ONS release calendar**, upcoming only, filtered to inflation, labour
  market, GDP and public sector finances. Open Government Licence v3.0,
  which grants commercial use with attribution.
- **ECB press feed**, filtered to `/press/pr/` and the monetary policy
  statement. The feed is mostly speeches (eleven of fifteen items the day
  this was written); a speech is a person’s view, not a decision, so they
  are dropped. ECB terms: reuse permitted, the ECB must be cited — which
  is why every rendered item carries "ECB".
Both are listed on the Sources page, marked "announcements — not scored".

**3. `/api/announcements` + `components/NewsBand.tsx`**: a route with a
15-minute cache (neither feed sends CORS headers, so the browser cannot
read them directly), and a two-column band on the homepage — "Coming up"
and "Just announced". **Nothing has to be run for it to stay current:** no
cron, no table, no manual step. If both feeds are unreachable the band
renders nothing rather than something stale.

**Rejected and worth remembering:** Bank of England news (terms require
written permission for commercial reuse — and the owner’s rule is no
emails to institutions); BLS and RBA (both 403 automated requests);
general and AI news (off-mission for a site whose claim is that every
line traces to the institution that published it).

Tests: `test-ticker-events.ts` and `test-news-feeds.ts`, both on fixtures
with a pinned clock, both in CI, both mutation-tested.
`check-runtime-errors.ts` gained one scoped exception: the announcements
fetch can still be in flight when that script closes the tab.

### 30.1 One switch for everything that moves (2026-09-16)

The owner reported the desktop as "horrible, nothing is working" while
the phone was fine. Nothing was broken. Windows had animation effects
turned off, Chrome reported prefers-reduced-motion, and the site
correctly stopped the ticker, the counting score, the self-drawing trend
line and the live pulse — every sign of life at once, with no way to ask
for it back. The phone had no such setting, so the phone looked alive.

Driving the live desktop site first ruled out an actual fault: no
horizontal scroll, no console errors, market chips, navigation and the
news band all working at 1920 and 1440.

`lib/motion.ts` now holds one preference — auto (follow the system),
play, or still — remembered in localStorage and published as
`data-motion` on `<html>` so CSS reads the same state the components do.
A button at the left edge of the ticker toggles it. Under
prefers-reduced-motion the CSS rules are written as
`:root:not([data-motion="play"])`, so the system still wins by default
and a reader who asks is not refused.

Verified in three states: system-still with no press (score appears
instantly, strip static), system-still after pressing play (counts up,
strip moves 115px/1.2s, trend line draws, dot pulses), and system-normal
(all of it, as before).

Two defects the pre-merge review found, fixed before PR #60 merged: each
component had kept its own copy of the setting, so play on the ticker did
not reach the score on the same page (now one store read through
`useSyncExternalStore`); and the rule that wraps a stopped strip lived
only under prefers-reduced-motion, so stopping it on an ordinary desktop
cut off every market past the right edge (now `.ticker.is-still`).
GitHub Actions minutes were exhausted for the month, so #60 was verified
locally: tsc, lint, every offline script, a production build and all five
browser checks.

## 31. The top bar: eleven links became five entries (2026-09-17)

The owner found the bar too long and oddly ordered. It listed every page
in the order each was built — Overview, Dashboard, Data Over Time,
Compare, Gulf Watch, Observatory, Stablecoins, Learn More, Sources, About,
Contact — so a scored tool, an unscored watchlist and a contact form sat
at the same level. Offered three structures; the owner chose this one and
named the groups:

- **Dashboard · Compare · Trends** — the scored tools, in the order used.
- **Beyond the score ▾** — Gulf Watch, Observatory, Stablecoins.
- **About the index ▾** — How the score works (`/learn`), Data sources,
  About MMAI.
- **Overview** dropped (the logo goes home). **Contact** moved to a new
  link row in the footer, beside About, How the score works and Sources.
- Renamed to match: "Data Over Time" → **Trends**, "Learn More" →
  **How the score works** (page titles too; URLs unchanged).

How it is built (`components/NavBar.tsx`): the groups are disclosures —
a button with `aria-expanded` showing a panel of plain links — not ARIA
menus. Opened by click, never hover. One open at a time; closes on
Escape (focus back to its button), a click outside, focus leaving the
group, and following any link, including the link to the current page.
The focus-leaving rule ignores a null `relatedTarget`, because Safari does
not focus a clicked link and closing then would swallow the click. The
group holding the current page gets a gold underline (`.has-active`); the
page itself keeps the gold fill. On a phone the groups are laid out in
full under paragraph labels (not headings, so each page's h1 comes first),
and the panel scrolls on its own so a phone held sideways reaches the
last link.

Breakpoint 1100px → 760px, then → **820px** on 18 September, when **Home
came back as a sixth entry**: dropping it had left the logo as the only
way home, which a reader has to know, and the phone menu had no route
home at all. Six entries left ~55px of slack at 761, which is a fit but
not one to trust to a fallback font, so the breakpoint moved.
`scripts/check-layout.ts` "nav-row" is 821 and `check-nav` opens the
groups there; check-nav also asserts the phone menu contains "/". New `scripts/check-nav.ts` (wired into CI after check-accessibility)
opens both groups at 761 and 1280 and on a 740×360 touch phone and asserts
every behaviour above. Reviewed before coding and before merge.

## 32. Everyday controls, round 1 of the functionality review (2026-09-17)

The owner asked for a review against comparable data sites (Our World in
Data, FRED, Trading Economics) and approved all eight recommendations.
Built in two rounds. Round 1:

- **Back to top** — `components/BackToTop.tsx`, in the layout. Not in the
  page until the reader is two screens down (measured: Sources is 32
  phone-screens, Learn 19). Returns to the top and focuses `<main>`
  (`tabIndex=-1`). Footer bottom padding is 88px so it never covers the
  last footer line on a phone.
- **The address remembers the choice** — `lib/urlState.ts`
  (`useQuery` via useSyncExternalStore; `setQuery(changes, push|replace)`).
  Home `?market=`; Trends `?market=&dimension=&range=&raw=`; Compare
  `?markets=&from=&to=&dim=&raw=&view=`. Choosing a market PUSHES (Back
  returns to the previous one); every other control REPLACES. Defaults are
  omitted so untouched pages keep clean addresses. Never rAF for this —
  it does not fire in a tab that is not painting.
- **Share this view** — `components/ShareButton.tsx`: phone share sheet on
  touch devices, copy-link with a "Link copied" status on desktop, a
  selected text box if copying is refused. On Home's market detail, Trends
  and Compare.
- **Friendly errors** — `app/error.tsx` (inside the layout; Try again /
  homepage / Report it) and `app/global-error.tsx` (own document, literal
  colours). Next 16 names the recovery prop `retry`, not `reset`. Verified
  with a temporary client-throwing route, since deleted.
- **Visitor statistics** — `@vercel/analytics`, `<Analytics />` in the
  layout, production only. Cookieless and same-origin, so the CSP is
  unchanged. **The owner must click Enable under Analytics in the Vercel
  project** or nothing is counted. Hobby plan: 50,000 page views a month,
  one month of reporting, no custom events (Pro only). The About page
  states what is counted. `check-runtime-errors.ts` ignores exactly the
  analytics script, which does not exist under a local `next start`.

New `scripts/check-site-functions.ts` (in CI after check-nav) tests back to
top, the address on all three pages including Back and reload, and copy
link. Round 2 (next): Sources page navigation, downloads beside charts,
term explanations.

### 32.1 Round 2: sources navigation, chart downloads, term explanations (2026-09-17)

- **/sources folds** — each market group is a native `<details>` (closed by
  default, DOM-owned `open`, never React state), with "Open all / Close
  all" and an "On this page" row (`components/SourcesJumpNav.tsx`) of plain
  `#src-japan` / `#gulf-oman` links. A hash opens its group on arrival and
  on hashchange; a click opens it too (same hash twice fires no event). A
  real h2 now heads the scored table, because headings inside `<summary>`
  are dropped by screen readers.
- **Downloads beside charts** — `TrendChart` takes `download={{ title,
  source, unit }}` and renders `components/ChartDownload.tsx`: PNG (the
  chart's largest `svg.recharts-surface` with computed styles inlined,
  drawn with title, legend and credit lines onto a 2x canvas) and CSV
  (ISO period where the chart has one, BOM, quoted Source rows). Credit
  lines live in `lib/chartSources.ts`; the six daily bond curves are NOT
  on /sources, so their lines are spelled out there, including the OGL
  v3.0 statement and "data processed by MMAI" for RBA (CC BY 4.0) and
  Japan (PDL 1.0). Nothing claims a licence for the downloaded file.
  Shared CSV/download helpers: `lib/download.ts` (ExportDataButtons uses
  them too).
- **Term explanations** — `components/Term.tsx` toggletip (click pins,
  mouse hover previews, Escape/outside/resize close; always-mounted status
  region) with text from `lib/glossary.ts`, every number derived from the
  reference set. Placed in the Home hero and meta row, Compare subtitle,
  bond spread note and Dashboard spread note — never inside headings.

`scripts/check-site-functions.ts` now also covers folds, both downloads
(PNG decoded, must contain the chart) and terms on a phone and with a mouse.

## 33. The strip along the top, rebuilt after a phone report (2026-09-17)

Reported as "pausing and fading and not working good even on mobile",
with a photo of the live site showing an apparently EMPTY strip. Measured
on the live site rather than guessed; five separate faults:

1. **118 px/s at every width.** The animation was a fixed 40s for one
   pass, and the row had grown to ~4,700px. `components/MarketTicker.tsx`
   now measures the row (ResizeObserver, only while playing) and writes
   `--ticker-seconds`, so it travels ~55 px/s with a mouse and ~45 with a
   finger. Measured: 56 and 45.
2. **A moving button cannot be tapped** -- Playwright literally timed out
   on it. A touch now holds the strip still while the finger is down and
   for 3s after (10s ceiling, in case the OS takes the gesture); a
   cancelled gesture releases at once. `touch-action: pan-y pinch-zoom`.
3. **A phone's lingering hover could freeze it.** The hover pause now
   sits inside `@media (hover: hover) and (pointer: fine)`; the
   `:has(:focus-visible)` pause stays for keyboards.
4. **The strip jumped** as each of its two queries landed and widened the
   row mid-scroll. Both now land together (`extras`, one state) and the
   animation only starts after they do -- with a 4s deadline, so a hanging
   route can never leave the strip stopped.
5. **THE ACTUAL PHOTO.** Order was: every announcement, then every weekly
   change, then the scores. The first three headlines measured 656, 361
   and 721px -- nearly two phone screens each -- so a phone reader watched
   ~2,400px of news (about a minute) before the first score, and often saw
   a fragment of one headline and nothing else. Scores lead now, with one
   other line dealt in after every three, and `.ticker-feed-title` is
   clipped to 42ch (24ch on a phone). Row: 4,702px -> 3,715px; first score
   at 0px; widest item 365px.

Also: the edge fade is 18px under 640px (was 40px each end, a fifth of a
390px screen -- the "fading" in the report).

`scripts/check-ticker.ts` (CI, after check-nav) measures speed on a touch
phone and a desktop, the finger hold, the tap, the width staying put, and
the shape of the strip: a score within the first screenful, no item wider
than 470px, no run over 900px without a score.

### 33.1 The site has its own domain: mmai.markets (2026-09-17)

Bought at Cloudflare Registrar, so the DNS stays at Cloudflare (that
registrar requires its own nameservers). Two records, both **grey cloud /
DNS only** — proxying in front of Vercel breaks certificate issuance and
can loop redirects:

    A      @      216.198.79.1
    CNAME  www    ec37a0b58b1582ce.vercel-dns-017.com

**www is canonical**; the bare domain 308s to it, which is how Vercel set
it up and what it recommends. `NEXT_PUBLIC_SITE_URL` is set to
`https://www.mmai.markets` in the Vercel project (Config, not Secret), and
`lib/siteUrl.ts`'s FALLBACK now matches, so a build without the variable
still produces the right canonicals. Everything else on the site derives
from SITE_URL: page canonicals, the sitemap, robots.txt, the structured
data, OG images, unsubscribe links and the credit line on downloaded
charts. Verified on a production build: canonical, sitemap and robots all
read https://www.mmai.markets.

Still to do, when wanted: subscriber emails. They have never been able to
send because a vercel.app sender cannot be verified; with a real domain,
Resend verification (a few more Cloudflare records, also grey cloud) makes
`alerts@mmai.markets` possible. `ALERT_FROM` already derives from
SITE_URL's hostname, and `IS_VERCEL_DOMAIN` (which explains the failure in
the refresh route) will go false on its own.

### 33.2 Email actually sends: welcome message on sign-up (2026-09-18)

With mmai.markets verified in Resend (DKIM TXT + two SPF CNAMEs + DMARC,
all at Cloudflare, grey cloud) and RESEND_API_KEY set in Vercel, the site
can send for the first time. Two things were wrong before it could:

1. **ALERT_FROM was alerts@www.mmai.markets.** The site is served at www;
   the VERIFIED domain is the bare one. `MAIL_DOMAIN` in lib/siteUrl.ts
   now strips a leading `www.`, so mail sends as alerts@mmai.markets.
2. **A rejected send counted as a success.** `resend.emails.send` resolves
   with `{ data, error }` rather than throwing, and every call sat inside
   a try/catch — so the refresh route's `sent`/`failed` tallies could not
   see a rejection. One `send()` helper in lib/notify.ts now unwraps that
   and throws; both emails go through it.

**The welcome email** (`sendWelcomeEmail`) goes out from the subscribe
route via `after()`, so the form answers instantly and a mail failure can
never turn a saved subscription into an error on screen. It is sent only
when the stored market list actually CHANGED (set membership, not length:
mergedMarkets is re-filtered against current markets, so lengths lie).
That rule is the form's abuse control, and it is load-bearing: anyone can
type in someone else's address, and this caps what a stranger can inflict
at one email per market, ever. The message names the markets by NAME,
carries the RFC 8058 one-click unsubscribe headers, and tells a reader
who never signed up exactly what to do. Rejected: a per-address cooldown
(needs a manual schema change for a bound the above already gives).

Copy corrected in the same change: SubscribeForm no longer promises that
"alerts begin when MMAI moves to its own domain" (it has), and says "if
this address is new to the list" because a repeat submission sends
nothing; the unsubscribe page covers the never-signed-up case.

`scripts/test-welcome-email.ts` (CI, beside test-alert-guard) renders the
message offline and pins the market names, the tokenised absolute
unsubscribe URL, the didn't-sign-up line, no undefined/NaN/null, that
every market has a display name, and that the sender is on the bare
domain. The send path itself is proved by subscribing on the live site.

## 34. Security review, and the patch it found (2026-09-18)

Full review at the owner's request. One real finding, five confirmations.

**THE FINDING: Next 16.3.1 carried two CRITICAL advisories** — an
unauthenticated RCE on Windows-hosted servers, and an unauthenticated RCE
in the Image Optimization API when AVIF files are processed — plus a high
one in the `sharp`/libheif chain it pulls in. Patched by pinning
**next and eslint-config-next to 16.3.5**; `npm audit --omit=dev` then
reports zero vulnerabilities. The site uses no `next/image`, which limits
the second, but the framework serves that route regardless. Re-run
`npm audit` after every dependency change; this is the first time it had
found anything.

**Confirmed sound, by testing rather than reading:**
- **RLS holds.** With the PUBLIC key (the one in every visitor's bundle):
  `subscribers` and `feedback_submissions` return `[]` (RLS on, no
  policies = deny all); an INSERT into `raw_indicators` is refused with
  42501; a DELETE against `subscribers` removes nothing (5 rows before
  and after — PostgREST answers 204 for zero matched rows, which is not
  evidence of success and was checked separately).
- **The service-role client is imported only by route handlers**, never by
  a file carrying "use client"; no SERVICE_ROLE reference outside
  lib/supabase.ts.
- **No secrets tracked**: .env.local and backups/ are gitignored, and a
  scan of tracked content for key-shaped strings finds nothing.
- **Headers on the live domain**: CSP, HSTS (2 years, preload),
  X-Frame-Options DENY, frame-ancestors 'none', nosniff, Referrer-Policy,
  Permissions-Policy.
- **Cron routes fail closed**; forms validate, cap length and rate-limit;
  unsubscribe tokens are UUIDs and GET has no side effect; the one
  dangerouslySetInnerHTML builds from repo constants and escapes `<`.

**Known, accepted limits** (documented, not new): the rate limiter is
per-instance memory, so it slows a flood rather than stopping one; and the
CSP allows 'unsafe-inline' for scripts, measured as necessary here (§ the
next.config.ts header comment).
