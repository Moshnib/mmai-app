# MMAI — Next.js + Supabase + Vercel Build

This is a real, working Next.js app — not a mockup. It has been:
- Built successfully (`npm run build` — zero errors)
- Verified against every known-correct score from the project (`npx tsx scripts/verify-scoring.ts` — 5/5 pass)
- Started and content-checked (both pages render real, correct data)

It runs fully on hardcoded fallback data out of the box (matching every number
already validated in the deck, workbook, and methodology paper), and
automatically switches to live Supabase data the moment you connect a database.

## What's already done for you
- `/` — Overview page: score display, pillar grid, an interactive world map (click a market to open its Data Over Time page), a Gulf Watch section, and a weekly change feed. (Note: this line described the original ported-from-HTML version; see `MMAI_MASTER_HANDOVER.md` for the current, restructured homepage.)
- `/learn` — Learn page: all 6 educational topics
- `/api/refresh` — a real serverless function that fetches **live** BLS (US CPI, unemployment) and New York Fed (US Fed Funds Rate) data, computes scores, and writes to Supabase
- `lib/scoring.ts` — the exact 7 equations from the methodology paper, unit-tested
- `supabase/schema.sql` — the database structure, ready to run

## What you need to do (no coding required for this part)

### 1. Create a free Supabase project
Go to supabase.com → New Project → note your project URL and two keys (Settings → API).

### 2. Run the schema
Supabase Dashboard → SQL Editor → New query → paste the entire contents of `supabase/schema.sql` → Run.

### 3. Set your environment variables
Copy `.env.local.example` to `.env.local` and fill in the values from step 1.
(For deployment, add the same variables in Vercel: Project Settings → Environment Variables.)

### 4. Push this project to GitHub
```
git init
git add .
git commit -m "Initial MMAI Next.js build"
```
Then create a new repository on github.com and follow its "push an existing repository" instructions.

### 5. Deploy on Vercel
Go to vercel.com → New Project → Import your GitHub repo → it auto-detects Next.js → add your environment variables → Deploy.
Scheduling runs from GitHub Actions (`.github/workflows/refresh.yml`), not Vercel — add `CRON_SECRET` as a repository secret with the same value as in Vercel. There is deliberately no Vercel cron; see `MMAI_MASTER_HANDOVER.md` §19.10.

### 6. Trigger your first live refresh
Once deployed, open the repository's **Actions** tab and run **Refresh MMAI data** by hand
(or wait for the scheduled run at 06:10 UTC) to populate the database for the first time.
The endpoint itself refuses any request without `CRON_SECRET`, so visiting it in a browser returns 401.

## Extending to the other 9 sources
`app/api/refresh/route.ts` has a `TODO` block showing exactly which source
covers which market — Eurostat/ECB for Euro Area, Statistics Canada/Bank of
Canada for Canada, ONS/Bank of England for UK, World Bank for UAE. Each one
follows the same two-file pattern as `lib/fetchers/bls.ts` and
`lib/fetchers/nyfed.ts`: one function that fetches, one that returns clean
numbers. This maps directly onto Steps 5–11 of the Power BI Connection Guide
— same sources, same URLs, just called from code instead of Power Query.

## Local development
```
npm install
npm run dev
```
Visit http://localhost:3000 — works immediately on fallback data, no setup required.
