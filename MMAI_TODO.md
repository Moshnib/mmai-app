# MMAI — To-Do List
*Last updated: 2026-08-26 (Gulf Watch: fully live, debugged, and expanded with history/charts)*

## 🔒 Security fix (2026-08-26) — CRON_SECRET was silently not working
While testing Gulf Watch's new refresh job, discovered the password
protecting **both** daily refresh endpoints (`/api/refresh` and the new
`/api/refresh-gulf`) wasn't actually being enforced — every request
succeeded regardless of what secret was sent, including none at all.
Root cause unconfirmed (Vercel's "Secret" type variables can never be
viewed again once saved, so there was no way to inspect what was
actually stored) — most likely corrupted when it was last changed on
2026-08-22. **Fixed**: deleted and recreated `CRON_SECRET` in Vercel
with a known value (`mmai-verify-2026`, same as documented), redeployed,
and re-verified — both endpoints now correctly reject requests with a
missing or wrong secret, and accept only the right one. This predates
Gulf Watch entirely; it was just discovered while testing it.

## ✅ "Gulf Watch" feature — live, debugged, and expanded (2026-08-25 → 26)

A new section of the site, separate from the main 6-market score — six
countries (UAE, Bahrain, Qatar, Kuwait, Oman, Saudi Arabia) shown with real
live numbers but **no composite score**, since none of them have a usable
policy-rate source. Full plan and reasoning in `MMAI_MASTER_HANDOVER.md` §11.

**The whole feature is live at `/gulf-watch` now** — cards, historical trend
charts, a comparison table across all 6 countries, a homepage entry point,
and Gulf Watch content on the "Learn More" page. Along the way:
- Found and fixed a real security gap — the password protecting both daily
  refresh jobs wasn't actually working (see above).
- Found and fixed 3 separate bugs that kept the page showing stale/fake data
  right after it first went live (a sort-order bug, a cache-staleness issue,
  and a Next.js code pattern that silently stopped the page from loading
  real data at all) — full detail in the handover doc §11.7.
- Caught and prevented two would-have-shipped fake-data problems while
  building the historical charts: Saudi's data source returns 12 fabricated
  "0.0% inflation" months for 2013 (dropped before it ever reached the
  site), and a first-draft "is this month's data complete" rule would have
  deleted the single busiest month in Qatar's whole real-estate history by
  mistake (caught and fixed before it shipped).

**Still ahead:**
- [ ] **Homepage widget — you said you don't like the current design,** will
      revisit with you later. Not urgent, just flagging it's not finished.
- [ ] **Interactive Gulf map** — the last item on your original wishlist.
      Deliberately saved for last because the site's underlying map data
      can't show all 6 countries clearly (one country's outline is missing
      entirely, two others are too small to see).
- [ ] Saudi Arabia's real estate (KAPSARC) — still needs your decision: send
      a permission email (their terms conflict with their own "public
      domain" label), or skip it.
- [ ] Bahrain's real estate — already agreed to skip, source is too fragile.

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
- Gulf Watch's full step-by-step build plan lives in `MMAI_MASTER_HANDOVER.md`
  §11 — it's written into the repo, not just a local plan file, specifically
  so it survives a new chat or a new machine.
- Always get Fable's (or Opus, when Fable's out of credits) review before
  writing code, and again before merging.
- Never commit or push without saying "GO" first.
- The full technical handover doc (if a new chat ever needs it) is the
  file already sent to you: `MMAI_MASTER_HANDOVER.md`.
