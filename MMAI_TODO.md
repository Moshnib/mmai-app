# MMAI — To-Do List
*Last updated: 2026-09-21 (live central bank press conferences on the homepage)*

> **If a chat breaks, nothing is lost.** The code is on GitHub, the site
> runs from there, and these notes are committed beside the code. Open a
> new chat in this folder and say: *"Read §28 of MMAI_MASTER_HANDOVER.md
> and MMAI_TODO.md, then tell me where we are before changing anything."*

## ✅ 21 September — live press conferences on the homepage (handover §43)
- [x] **The homepage shows the next central bank press conference**, and
      a LIVE NOW player while one is on: the ECB, the Bank of England and
      the Bank of Canada play on the site; the Fed only streams on its own
      website, so its button opens there. Nothing from YouTube loads until
      a reader presses play, so the page is no heavier.
- [ ] **Add the Bank of Canada 2027 dates** when it publishes them
      (bankofcanada.ca/press/upcoming-events), in `lib/pressConferences.ts`.
- [ ] **Each autumn, add next year's dates** for all four banks. CI fails
      on its own when fewer than three conferences are left, as a reminder.

## ✅ 21 September — second audit (handover §42)
- [x] **Shared links now show the MMAI picture on every page**, not only
      the homepage. Before, a Trends or Gulf Watch link posted on WhatsApp
      showed only text.
- [x] Checked and fine: speed (main content in about 1.4 s on a phone),
      search tags, the 404 page, code safety, and the stored data.
- [ ] **Before charging money:** add a proper privacy page. The short note
      on About is enough while the site is free.

## ✅ Since 2026-09-17 — the site got its own address, and can send email
- [x] **mmai.markets is live**, bought at Cloudflare. `www` is the real
      address; the bare domain and the old `mmai-app.vercel.app` both
      forward to it, so there is one address to share and the visitor
      count stops being split in two.
- [x] **Email works for the first time.** The sending domain is verified,
      and someone who subscribes now gets a welcome email. Two bugs were
      in the way: it was sending from the wrong version of the domain
      (`www.`, which isn't the verified one), and a **rejected** email was
      being counted as a successful one — so the site would have reported
      success while sending nothing.
- [x] **Security patch.** A full review found the framework version in use
      carried two critical vulnerabilities; patched the same day. The rest
      of the review came back clean (database permissions, secrets, page
      headers, the contact and subscribe forms).
- [x] **Top-bar fixes** — "Home" is a working link again and the bar keeps
      its spacing.

## 🔔 19 September — so it can't happen silently again
The homepage now shows the right day each figure changed, and the strip
along the top leads with the newest changes (the US rate rise had been
missing from it). The LIVE badge says **UPDATE DELAYED** if a day of
refreshes fails. Three separate alarms email you if the data ever stops,
**once you switch them on**:
- [ ] Vercel → Settings → Environment Variables → add `OWNER_ALERT_EMAIL`
      = your email address.
- [ ] GitHub → Actions → **Test the watchdog email** → Run workflow, then
      check the email arrives.
- [ ] Healthchecks.io: free account, one check, then put its ping link in
      GitHub as the secret `HEALTHCHECK_PING_URL`.
- [ ] GitHub → Settings → Notifications → email me when a workflow fails.

## ✅ 19 September — the data had stopped updating for three days; fixed
Nothing was written from 16 to 19 September. GitHub had run out of free
minutes (the Actions budget was $0), and once that was fixed, the refresh
job was still calling the site's old address. **Fixed:** the Actions budget
is $5 a month (it can't cost more), the `SITE_URL` setting points at
www.mmai.markets, and today's refresh went green for every market.
Details in the handover, §36.

- [ ] **Export the subscriber list into the backup folder** (Supabase →
      Table Editor → subscribers → Export to CSV → save into
      `MMAI-backup-2026-09-18\2-database`).
- [ ] **Not urgent:** the refresh password saved on the laptop is out of
      date. It only matters for running a refresh by hand from the laptop;
      the site and GitHub have the right one.

## ✅ 19 September — the news feed from seven institutions is live (PR #71)
The homepage news section and the strip along the top now read seven
institutions: the US Fed, the ECB, the Bank of Canada, the Reserve Bank
of Australia, the UK's ONS, Statistics Norway and the US labour-statistics
release calendar. Tested against all seven live feeds on 18 September.

- The homepage section now opens with "Latest: 2 h ago" and groups items
  as Today / Yesterday / Last 30 days / Coming up, showing only groups
  that have something.
- Each of the five new institutions has its licence listed on the Sources
  page, and the site's checks now refuse a news feed without one.
- **You'll notice "Sources: N" on a market got smaller** (the US goes
  from 8 to 4). That's a fix: it was counting the oil price and the news
  feeds, which don't feed the score, and counting one institution
  several times.
- **Your choice, done:** the Bank of Canada and RBA feeds are filtered to
  economy news (rate decisions, policy reports, financial stability).
  Bank notes, staff appointments and payments notices are dropped.

Merged and live since 19 September.

The licence checks are **done** — seven feeds cleared. Refused, on their
own published terms: the Bank of England and Bank of Japan (commercial
reuse needs written permission), the Riksbank and Norges Bank (terms don't
confirm reuse — the same reason this site already takes their rates via
BIS), and the IMF and OECD (they block automated readers outright). The
reasoning is written into the code itself so it can't get lost.

One thing worth knowing, because it's the sort of trap that bites later:
an institution already on your Sources page is cleared there for its
**numbers**, which is not the same permission as its **news headlines**.
The RBA is the example — its cash rate is specifically excluded from the
open licence that covers its media releases.

The Bank of Canada and Australia feeds coming back empty was found and
fixed in the same session — both publish a slightly different flavour of
feed than the others, and the reader was looking for the common one.

## 🔒 Security fix (2026-08-26) — CRON_SECRET was silently not working
While testing Gulf Watch's new refresh job, discovered the password
protecting **both** daily refresh endpoints (`/api/refresh` and the new
`/api/refresh-gulf`) wasn't actually being enforced — every request
succeeded regardless of what secret was sent, including none at all.
Root cause unconfirmed (Vercel's "Secret" type variables can never be
viewed again once saved, so there was no way to inspect what was
actually stored) — most likely corrupted when it was last changed on
2026-08-22. **Fixed**: deleted and recreated `CRON_SECRET` in Vercel
with a new value (not written here: passwords stay out of these notes), redeployed,
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
- [x] Bahrain's real estate — closed: agreed to skip, the source is too fragile.

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
- [x] ~~Send the Norges Bank email.~~ **Not needed** (closed in the 21
      September audit): Norway's policy rate has come through the BIS
      since 12 September, and the BIS's terms state reuse plainly.
- [ ] **IMF gate — before this site is ever monetized** (added 19
      September): Gulf Watch now uses IMF data (Oman, Kuwait and UAE
      inflation; Qatar's policy rate). Free publishing with credit is
      allowed; commercial use needs permission from copyright@imf.org.
- [ ] **Qatar's monthly inflation:** its open-data portal stopped at the
      end of 2025. Qatar's National Planning Council still publishes it
      on its own site; its terms need reading before we can use it.
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
- [x] **Turn on email alerts.** Done 18 September — the account and the
      verified sending domain are both in place. One caveat: the
      band-crossing alert has still never actually fired, because no
      market's score has crossed into a new category since it started
      working. The welcome email proves the send path works.
- [ ] **Add BEA_API_KEY and EIA_API_KEY to your local `.env.local`** if you
      ever want local testing on this machine to fully match production
      (currently only in Vercel).
- [x] ~~Minor chart-labeling bug~~ **Already fixed** (confirmed in the 21
      September audit): every figure has stored its own reporting date
      since August, so an annual number no longer looks like it changed
      this year.

## 🤔 Decide when ready (no rush)
- [x] **Domain name** — bought 17 September 2026: **mmai.markets**, at
      Cloudflare, DNS there (grey cloud, proxy off) pointing at Vercel;
      www is canonical. Was: keep `mmai-app.vercel.app`, or buy a dedicated
      domain like `marketpuls.com`? (Discussed: reasonable name, but the
      missing "e" reads as a typo and it's a bit generic — worth weighing
      against something built around "Moshnib" or "MMAI" instead.)
- [ ] **A 10th scored market?** (There are nine now; South Korea joined on
      13 September.) Czechia is the strongest candidate and is already on
      the Observatory being evaluated. Brazil has excellent data but a
      share-alike licence (ODbL) that needs your decision.

## 📌 Standing reminders
- Gulf Watch's full step-by-step build plan lives in `MMAI_MASTER_HANDOVER.md`
  §11 — it's written into the repo, not just a local plan file, specifically
  so it survives a new chat or a new machine.
- Always get Fable's (or Opus, when Fable's out of credits) review before
  writing code, and again before merging.
- Never commit or push without saying "GO" first.
- **Push at the end of every working session.** Work that is only on the
  laptop is the one thing a broken chat or a dead machine can actually
  take. Once it's pushed, it's safe.
- **Update this file and §28 of the handover in the same commit as the
  code**, so a new chat is never more than one session behind.
- The full technical handover doc (if a new chat ever needs it) is the
  file already sent to you: `MMAI_MASTER_HANDOVER.md`.

## ✅ Since 2026-09-12
- [x] Norway and South Korea added — nine scored markets.
- [x] The Observatory (Denmark, Finland): tracked, deliberately unscored.
- [x] SEO: canonical URLs, social cards, structured data.
- [x] "Editorial Dark" restyle across every page, email and social card.
- [x] Homepage map stripes fixed; country cards evened up; Learn-page
      formulas explained in plain words with the exact formula behind a
      button; three false statements corrected.

## ▶️ Next up (owner has already chosen these)
- [ ] Homepage additions: strongest/weakest part, yearly trend line since
      2019, how recent each figure is, and an "updated" status line.
- [x] **Poland, Czechia and Hungary added to the Observatory** (19
      September), labelled "not scored yet" because nothing rules them
      out. Next step for them: the checks to score them properly.
- [ ] More Observatory countries: the euro members (Germany, France,
      Italy, Spain and others) are ready with the same sources; see §28
      of the handover for the list tested live.
- [x] **Fixed 19 September:** if a reading failed, the Observatory
      showed N/A all day. Every refresh now retries it (handover §38.1).
- [x] **Fixed 21 September:** a source down ALL day now shows its last
      published figure, under that figure's own date, marked "did not
      refresh today", for up to 14 days (handover §41).

> The current state of the whole project, in one page, is §28 of
> MMAI_MASTER_HANDOVER.md. Start there in a new chat.
