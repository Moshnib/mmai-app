# MMAI — MASTER HANDOVER DOCUMENT

**Last updated:** 2026-08-24
**Reflects commit:** `4b1c33b` ("Show live data-refresh times on the Sources page instead of licence dates")
**Purpose:** Paste or upload this entire document into a new chat with Claude Code to continue the MMAI project with zero loss of context.

> **This file now lives INSIDE the repo** (`MMAI_MASTER_HANDOVER.md` in the project root), so every version of it is permanently backed up on GitHub and can never be lost with a laptop, a chat, or a OneDrive sync. An older copy dated **2026-08-22** may still exist in `OneDrive/Documents/mmai project handover august 22/` — **that copy is stale and should be ignored or deleted.** It describes FRED as a live data source (it was removed for legal reasons), lists Norway as an active market (it isn't right now), and describes the BEA/EIA work as uncommitted (it was committed on 2026-08-22).

> **Companion docs, all in the repo root:**
> - `MMAI_TODO.md` — the plain-language running to-do list. **This is the doc to read first for "what's next."**
> - `MMAI_Claude_Code_Kickoff.md` — the project's original kickoff/status doc.
> - `README.md` — standard repo readme.
> Keep all of these in sync as work lands.

---

## 0. STATE VERIFICATION (run 2026-08-24)

Everything below was checked directly, not assumed:

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

**What MMAI is:** Market Pulse / **MMAI (Moshnib Market Analysis Index)** — a Next.js macro-economic dashboard built for Mohammad Elmoshnib / FINTECH.TV. It tracks **6 active markets** across **5 weighted "pillars"** and combines them into a single 0–100 composite score with a plain-language interpretation band ("Supportive," "Balanced," etc.).

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
  page.tsx                    -- Overview homepage (client component). Gauge, PillarGrid,
                                 KeyRatesRow, Heatmap, WorldMap, CompareGrid, SubscribeForm.
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
  Gauge, PillarGrid, KeyRatesRow, Heatmap, WorldMap, Sparkline, CompareGrid,
  TrendChart, Flag, SubscribeForm, ContactForm, ExportDataButtons,
  SiteFooter, SourcesTable

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

S_PS = clip(100 − 15 × |inflation − 2|, 0, 100)      -- Price Stability, target τ=2%
S_GM = clip(50 + 10 × gdpGrowth, 0, 100)             -- Growth Momentum
S_LM = clip(100 − 10 × (unemployment − 2), 0, 100)   -- Labour Market
S_MC = clip(100 − 12 × |policyRate − 2.5|, 0, 100)   -- Monetary Conditions, neutral=2.5%
S_EC = clip(100 − 1.2 × |brentYoY|, 0, 100)          -- External & Commodities

MMAI = (Σ weight × pillar_score) / (Σ active weights)  -- reweights around any missing pillar
```

- **Publication threshold:** coverage (populated pillars ÷ 5) must be ≥ **70%** (at least 4 of 5 pillars). Below that the composite is `null` and the site shows "N/A" rather than a misleading partial score.
- **Interpretation bands** (label only): 80+ "Strongly Supportive" · 65+ "Supportive" · 45+ "Balanced" · 30+ "Challenging" · <30 "Highly Challenging"
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
- **UAE removed 2026-08-19** — no verified public policy-rate source; permanently failed the 70% coverage threshold. **Do not re-add without solving the policy-rate-source problem first.**
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
4. **Do NOT re-add UAE** without solving the policy-rate-source problem.
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
*End of handover document.*
