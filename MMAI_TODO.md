# MMAI — To-Do List
*Last updated: 2026-08-24*

## ✅ Just finished — full site audit (2026-08-24)
- [x] **Confirmed the daily auto-refresh runs on its own.** On 2026-08-23 all
      6 markets were written in one 9-second burst at 06:37 UTC with nobody
      triggering it. This was an open question for weeks — it's answered.
- [x] **Fixed the three things that broke the "verify our math yourself"
      promise:** the weights are now published on the Learn page (they were
      missing entirely, so the formula couldn't be completed), the 0–100 cap
      is now disclosed, and the Overview's pillar weights no longer add up
      to 101%.
- [x] **Removed the last green in the UI** — the "LIVE" badge on the Trends
      page was still using the old palette.
- [x] **Replaced the favicon.** The browser tab was still showing the Next.js
      logo from the starter template.
- [x] **Added social sharing previews** — sharing an MMAI link now shows a
      proper card instead of a bare URL.
- [x] **Sources page institutions are now clickable** (all 16 verified).
- [x] Added a branded "page not found" page, per-page titles/descriptions,
      robots.txt, sitemap.xml, and an h1 on the Compare page.
- [x] **Fixed Canada's GDP figure** — the demo data said 3.4% against a real
      World Bank value of 1.74%, which alone put Canada top of the rankings.
      All demo/fallback figures are now synced to the live database.
- [x] Fixed `/trends` sending a blank page to crawlers and link-preview bots.

## ✅ Finished earlier
- [x] US GDP growth (BEA) and Brent Crude (EIA) wired to live data
- [x] All 7 markets confirmed 100% live — no placeholder data left anywhere
- [x] Credentials saved to `mmai-app-credentials.txt` on the Desktop
- [x] Full legal/licensing review of every data source (17 institutions)
- [x] Stopped using FRED entirely (their terms banned storing data in a
      database, which conflicted with how this whole site works) — US Fed
      Funds Rate now comes from the New York Fed directly, Japan's CPI and
      unemployment now come from the World Bank
- [x] Fixed incorrect/missing license text on the Sources page (RBA Cash
      Rate, Bank of Canada, several plain-language rewrites)

## 🔜 Next up
- [ ] **Send the Norges Bank email.** Draft already sent to you as
      `mmai-app-norges-bank-email-draft.txt` — their own website doesn't
      clearly confirm whether commercial use of the Key Policy Rate data
      is allowed. Send it whenever convenient, no rush while the site
      stays non-commercial.
- [ ] **Bank of Japan gate — before this site is ever monetized:** their
      data (Japan's policy rate) explicitly requires contacting their
      Public Relations Department for permission before commercial use.
      Fine today since the site is free/non-commercial; must be resolved
      before charging for anything.
- [ ] **Two audit findings left deliberately undone** (both judgement calls,
      not oversights): markets use slightly different conventions for the
      same indicator (US policy rate is an annual average, UK/Australia are
      year-end; US inflation is monthly, Japan's is an annual estimate), and
      the Overview page makes two separate database queries where one would
      do. Neither is wrong or visible to a visitor — worth revisiting only
      if you want strict like-for-like comparison across markets.
- [ ] **Turn on email alerts.** The feature is built (people get an email
      when a market's score crosses into a new category), but needs a
      free Resend account + a verified sending domain before it can
      actually send anything.
- [ ] **Add BEA_API_KEY and EIA_API_KEY to your local `.env.local`** if you
      ever want local testing on this machine to fully match production
      (currently only in Vercel).
- [ ] **Minor chart-labeling bug found during review (not urgent):** every
      indicator gets stamped with today's date when saved, even if the
      real data is from a year ago (true for any annual-frequency source —
      World Bank figures, etc.). Right now this makes an annual number look
      like it just changed "this year" on the trend charts when it didn't.
      Doesn't affect the actual scores, just the chart's x-axis label — a
      real fix would mean using each source's own reported date instead of
      today's date when saving to the database.

## 🤔 Decide when ready (no rush)
- [ ] **Domain name** — keep `mmai-app.vercel.app`, or buy a dedicated
      domain like `marketpuls.com`? (Discussed: reasonable name, but the
      missing "e" reads as a typo and it's a bit generic — worth weighing
      against something built around "Moshnib" or "MMAI" instead.)
- [ ] **8th market?** Brazil was researched and looks workable (just needs
      one more license double-check before building). New Zealand and
      South Korea were also looked at but have unresolved technical/legal
      snags.

## 📌 Standing reminders
- Always get Fable's (or Opus, when Fable's out of credits) review before
  writing code, and again before merging.
- Never commit or push without saying "GO" first.
- The full technical handover doc (if a new chat ever needs it) is the
  file already sent to you: `MMAI_MASTER_HANDOVER.md`.
