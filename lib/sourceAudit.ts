// ============================================================
//  DOES WHAT WE PUBLISH STILL AGREE WITH ITS SOURCE?
//
//  Every other freshness check on this project reasons about AGE: is the
//  stored observation date older than this cadence allows. Necessary,
//  and not sufficient — it can only ever be as good as the allowances
//  written beside it, and the UK's labour series legitimately carries a
//  170-day allowance while the BIS debt series carries 420. A source can
//  die well inside its own allowance and nothing notices.
//
//  This asks a different question: fetch it now, and see whether what
//  comes back is what we are publishing. It catches three things the age
//  rules cannot.
//
//  1. A MISSED RELEASE — the source has a newer observation than the
//     site. A fetch failed and the fallback served the previous reading,
//     which is right for one day and a problem on the fifth.
//
//  2. A REVISION — same period, different number. A revision that never
//     lands leaves the site publishing a figure its source has withdrawn.
//
//  3. A BROKEN FETCHER — the call throws or returns a shape we no longer
//     understand. Invisible in production today: settle() catches it,
//     the fallback serves the last complete reading, and every page
//     looks healthy.
//
//  Those first two say THE SITE IS WRONG and are returned as `problems`.
//  The third says THE SOURCE DID NOT ANSWER and is returned separately as
//  `unreachable`, because on any given morning it usually means the
//  source is simply having a bad day — see the note on runSourceAudit
//  for why conflating the two would turn this into a daily false alarm.
//
//  Being ONE RELEASE BEHIND is a fourth state and also only warns: it is
//  the ordinary gap between a source publishing and the next morning's
//  refresh. Two or more releases behind is a `problem`. See
//  releasesBehind for why this is counted in releases and not in days.
//
//  WHAT IT DOES NOT CATCH, stated plainly because the gap matters: a
//  source that keeps answering and stops updating. Eurostat returned
//  December 2025 for nine months, and a stored-versus-live comparison
//  would have said "matches" every day, because it did. That failure
//  belongs to the age rules in lib/freshness.ts. The two checks cover
//  different halves and neither replaces the other.
//
//  Lives here rather than in the script because it runs in two places:
//  scripts/check-sources-live.ts for a local run, and the cron-guarded
//  /api/source-audit route for the daily job. The route exists because
//  the fetchers need BEA, BLS and e-Stat keys that live in Vercel and
//  not in GitHub — putting the check where the keys already are avoids
//  copying five secrets into a second system.
//
//  IT DOES NOT COVER EVERY FIGURE. 27 probes against 35 scored figures
//  (7 markets x 5 indicators). Absent, each for a reason: Japan's
//  unemployment (OECD refuses Vercel's egress — the workflow fetches it
//  on the runner instead), and every market's government debt, which
//  comes from a single BIS call shared across every market rather than a
//  per-market fetch.
// ============================================================

import { withRetry } from "./retryFetch";
import { latestCompleteObservation, MAX_FALLBACK_DAYS } from "./latestComplete";
import { fetchUkInflation, fetchUkUnemployment, fetchUkGdpGrowthQuarterly } from "./fetchers/ons";
import { fetchUsUnemployment } from "./fetchers/bls";
import { fetchUsPceInflation, fetchUsGdpGrowthQuarterly } from "./fetchers/bea";
import { fetchCanadaInflation, fetchCanadaUnemployment, fetchCanadaGdpGrowthQuarterly } from "./fetchers/statcan";
import { fetchEuroAreaUnemployment, fetchEuroAreaGdpGrowthQuarterly } from "./fetchers/eurostat";
import { fetchJapanInflation, fetchJapanGdpGrowthQuarterly } from "./fetchers/estat";
import { fetchAustraliaInflation, fetchAustraliaUnemployment, fetchAustraliaGdpGrowthQuarterly } from "./fetchers/abs";
import { fetchUkPolicyRate } from "./fetchers/boe";
import { fetchJapanPolicyRate } from "./fetchers/boj";
import { fetchCanadaPolicyRate } from "./fetchers/boc";
import { fetchAustraliaPolicyRate } from "./fetchers/rba";
import { fetchEuroAreaInflation, fetchEuroAreaPolicyRate } from "./fetchers/ecb";
import { fetchUsPolicyRate } from "./fetchers/nyfed";
import { fetchSwedenInflation, fetchSwedenUnemployment, fetchSwedenGdpGrowthQuarterly } from "./fetchers/scb";
import { fetchBisPolicyRate } from "./fetchers/bis";
import { fetchNorwayInflation } from "@/lib/fetchers/ssb";
import { fetchNorwayUnemployment, fetchNorwayGdpGrowthQuarterly } from "@/lib/fetchers/norway";

/** A fetcher result, in any of the shapes the fetchers return. */
type Fetched = {
  value?: number; inflation?: number; unemployment?: number; gdpGrowth?: number; policyRate?: number;
  observationDate?: string;
};

export interface Probe {
  market: string;
  label: string;
  column: "inflation" | "unemployment" | "gdp_growth" | "policy_rate";
  dateColumn: string;
  fetch: () => Promise<unknown>;
  /** How close is close enough. Sources round differently from us; the
   *  point is to catch a revision, not a floating-point tail. */
  tolerance: number;
}

/** Japan's unemployment is deliberately absent. It comes from OECD,
 *  which is reachable from a GitHub runner and NOT from Vercel — the
 *  refresh workflow fetches it separately for that reason. Probing it
 *  from a Vercel route would fail every day and prove nothing. */
export const PROBES: Probe[] = [
  { market: "US", label: "inflation (PCE)", column: "inflation", dateColumn: "inflation_observation_date", fetch: fetchUsPceInflation, tolerance: 0.02 },
  { market: "US", label: "unemployment", column: "unemployment", dateColumn: "unemployment_observation_date", fetch: fetchUsUnemployment, tolerance: 0.02 },
  { market: "US", label: "GDP growth", column: "gdp_growth", dateColumn: "gdp_observation_date", fetch: fetchUsGdpGrowthQuarterly, tolerance: 0.05 },
  { market: "US", label: "policy rate", column: "policy_rate", dateColumn: "policy_rate_observation_date", fetch: fetchUsPolicyRate, tolerance: 0.01 },

  { market: "UK", label: "inflation", column: "inflation", dateColumn: "inflation_observation_date", fetch: fetchUkInflation, tolerance: 0.02 },
  { market: "UK", label: "unemployment", column: "unemployment", dateColumn: "unemployment_observation_date", fetch: fetchUkUnemployment, tolerance: 0.02 },
  { market: "UK", label: "GDP growth", column: "gdp_growth", dateColumn: "gdp_observation_date", fetch: fetchUkGdpGrowthQuarterly, tolerance: 0.05 },
  { market: "UK", label: "policy rate", column: "policy_rate", dateColumn: "policy_rate_observation_date", fetch: fetchUkPolicyRate, tolerance: 0.01 },

  { market: "CA", label: "inflation", column: "inflation", dateColumn: "inflation_observation_date", fetch: fetchCanadaInflation, tolerance: 0.02 },
  { market: "CA", label: "unemployment", column: "unemployment", dateColumn: "unemployment_observation_date", fetch: fetchCanadaUnemployment, tolerance: 0.02 },
  { market: "CA", label: "GDP growth", column: "gdp_growth", dateColumn: "gdp_observation_date", fetch: fetchCanadaGdpGrowthQuarterly, tolerance: 0.05 },
  { market: "CA", label: "policy rate", column: "policy_rate", dateColumn: "policy_rate_observation_date", fetch: fetchCanadaPolicyRate, tolerance: 0.01 },

  { market: "EA", label: "inflation", column: "inflation", dateColumn: "inflation_observation_date", fetch: fetchEuroAreaInflation, tolerance: 0.02 },
  { market: "EA", label: "unemployment", column: "unemployment", dateColumn: "unemployment_observation_date", fetch: fetchEuroAreaUnemployment, tolerance: 0.02 },
  { market: "EA", label: "GDP growth", column: "gdp_growth", dateColumn: "gdp_observation_date", fetch: fetchEuroAreaGdpGrowthQuarterly, tolerance: 0.05 },
  { market: "EA", label: "policy rate", column: "policy_rate", dateColumn: "policy_rate_observation_date", fetch: fetchEuroAreaPolicyRate, tolerance: 0.01 },

  { market: "JP", label: "inflation", column: "inflation", dateColumn: "inflation_observation_date", fetch: fetchJapanInflation, tolerance: 0.02 },
  { market: "JP", label: "GDP growth", column: "gdp_growth", dateColumn: "gdp_observation_date", fetch: fetchJapanGdpGrowthQuarterly, tolerance: 0.05 },
  { market: "JP", label: "policy rate", column: "policy_rate", dateColumn: "policy_rate_observation_date", fetch: fetchJapanPolicyRate, tolerance: 0.01 },

  { market: "AU", label: "inflation", column: "inflation", dateColumn: "inflation_observation_date", fetch: fetchAustraliaInflation, tolerance: 0.02 },
  { market: "AU", label: "unemployment", column: "unemployment", dateColumn: "unemployment_observation_date", fetch: fetchAustraliaUnemployment, tolerance: 0.02 },
  { market: "AU", label: "GDP growth", column: "gdp_growth", dateColumn: "gdp_observation_date", fetch: fetchAustraliaGdpGrowthQuarterly, tolerance: 0.05 },
  { market: "AU", label: "policy rate", column: "policy_rate", dateColumn: "policy_rate_observation_date", fetch: fetchAustraliaPolicyRate, tolerance: 0.01 },

  { market: "SE", label: "inflation (CPIF)", column: "inflation", dateColumn: "inflation_observation_date", fetch: fetchSwedenInflation, tolerance: 0.02 },
  { market: "SE", label: "unemployment", column: "unemployment", dateColumn: "unemployment_observation_date", fetch: fetchSwedenUnemployment, tolerance: 0.02 },
  { market: "SE", label: "GDP growth", column: "gdp_growth", dateColumn: "gdp_observation_date", fetch: fetchSwedenGdpGrowthQuarterly, tolerance: 0.05 },
  { market: "SE", label: "policy rate", column: "policy_rate", dateColumn: "policy_rate_observation_date", fetch: () => fetchBisPolicyRate("SE"), tolerance: 0.01 },

  // Norway, added to the audit 2026-09-13. It became a scored market the
  // day before and was not probed for a day -- which is exactly the
  // window in which a source can die unnoticed.
  { market: "NO", label: "inflation (CPI)", column: "inflation", dateColumn: "inflation_observation_date", fetch: fetchNorwayInflation, tolerance: 0.02 },
  { market: "NO", label: "unemployment", column: "unemployment", dateColumn: "unemployment_observation_date", fetch: fetchNorwayUnemployment, tolerance: 0.02 },
  { market: "NO", label: "GDP growth", column: "gdp_growth", dateColumn: "gdp_observation_date", fetch: fetchNorwayGdpGrowthQuarterly, tolerance: 0.05 },
  { market: "NO", label: "policy rate", column: "policy_rate", dateColumn: "policy_rate_observation_date", fetch: () => fetchBisPolicyRate("NO"), tolerance: 0.01 },

  // KOREA'S THREE OECD PROBES ARE RELAYED, NOT FETCHED HERE.
  //
  // Two reasons, either of which alone would be enough:
  //
  //   1. OECD does not answer from Vercel, and this audit runs on Vercel.
  //      Korea's first refresh proved it -- policy rate and debt arrived
  //      from BIS while all three OECD series came back null in the same
  //      runtime at the same moment. Probing them here would produce a
  //      FETCH FAILED warning every single morning, which is how a check
  //      stops being read.
  //
  //   2. PROBES run through Promise.all below. OECD answers concurrent
  //      requests with HTTP 500 across the board, so three parallel
  //      Korean probes would fail even somewhere OECD worked.
  //
  // The workflow already fetches these three, sequentially, for the
  // refresh relay. It hands the same values to this route, and the probe
  // compares them against what is published. That is real drift
  // coverage: if OECD starts returning a DIFFERENT number rather than no
  // number, VALUE DIFFERS still fires. A dead source shows up separately,
  // as a withheld Korean score.
  //
  // If the relay is absent the probe reports FETCH FAILED with a note
  // saying so, rather than pretending the figure was checked.
  { market: "KR", label: "inflation (CPI)", column: "inflation", dateColumn: "inflation_observation_date", fetch: relayOnly("KR inflation (CPI)"), tolerance: 0.02 },
  { market: "KR", label: "unemployment", column: "unemployment", dateColumn: "unemployment_observation_date", fetch: relayOnly("KR unemployment"), tolerance: 0.02 },
  { market: "KR", label: "GDP growth", column: "gdp_growth", dateColumn: "gdp_observation_date", fetch: relayOnly("KR GDP growth"), tolerance: 0.05 },
  { market: "KR", label: "policy rate", column: "policy_rate", dateColumn: "policy_rate_observation_date", fetch: () => fetchBisPolicyRate("KR"), tolerance: 0.01 },
];

/** A probe whose value cannot be fetched from this runtime and must be
 *  handed in. Throwing rather than returning null keeps the existing
 *  FETCH FAILED path, so an absent relay is reported as unchecked instead
 *  of silently counted as matching. */
function relayOnly(name: string): () => Promise<never> {
  return async () => {
    throw new Error(
      `no relayed value for "${name}". OECD does not answer from Vercel, so the workflow must pass this figure in.`,
    );
  };
}

/** How often each kind of figure is published. Derived from the column
 *  rather than stored per probe because it is exact: every inflation and
 *  unemployment series here is monthly, every GDP series quarterly, and
 *  every policy rate publishes a level each trading day. */
const CADENCE_OF: Record<Probe["column"], "daily" | "monthly" | "quarterly"> = {
  inflation: "monthly",
  unemployment: "monthly",
  gdp_growth: "quarterly",
  policy_rate: "daily",
};

/**
 * HOW MANY RELEASES BEHIND THE SITE IS — measured in the series' own
 * periods, not in days.
 *
 * THE FIRST VERSION OF THIS ASKED THE WRONG QUESTION and would have
 * failed the run roughly six to eight times a month. It compared
 * `now − liveDate` against a two-day grace, but `liveDate` is the
 * REPORTING PERIOD, not the release date: a monthly figure is stamped
 * the first of its month, so it is already ~40 days old on the morning
 * it comes out, and a quarterly one ~100. The grace was therefore
 * unreachable for 16 of the 20 probes — every ordinary release day would
 * have gone red at 18:00 and green again at 06:10 the next morning. It
 * appeared to work only because the one series it was tested against was
 * the daily UK policy rate, where period age and release age coincide.
 *
 * No single snapshot can tell "released an hour ago" from "missed for a
 * week" — that needs the source's release time, which these APIs do not
 * give, or memory between runs, which this has none of. What a snapshot
 * CAN establish is how many whole releases separate us from the source,
 * and that is unambiguous:
 *
 *   0 → level with the source.
 *   1 → the newest release is not in yet. Expected between the source
 *       publishing and the next 06:10 refresh, so it only warns.
 *   2+ → a release was definitely missed and never recovered. No timing
 *       argument makes that innocent, so it fails the run.
 */
export function releasesBehind(cadence: "daily" | "monthly" | "quarterly", storedDate: string, liveDate: string): number {
  const a = new Date(storedDate), b = new Date(liveDate);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  if (cadence === "daily") {
    // WORKING DAYS, not calendar days. A daily rate is published on
    // trading days only, so Friday's figure against Monday's is ONE
    // release behind. Counted in calendar days it was three -- "releases
    // missed" -- and every Monday afternoon run went red for nothing
    // (15 September: "source has 2026-09-14, site publishes 2026-09-11").
    let n = 0;
    for (let t = a.getTime() + 86_400_000; t <= b.getTime(); t += 86_400_000) {
      const day = new Date(t).getUTCDay();
      if (day !== 0 && day !== 6) n++;
    }
    return n;
  }
  const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  return cadence === "quarterly" ? Math.round(months / 3) : months;
}

/** How far behind is a MISSED release, not an ordinary gap. Two for
 *  monthly and quarterly figures, as before. Three working days for a
 *  daily one: the morning's figure against the source's evening one is
 *  one, and a public holiday -- when the central bank publishes nothing
 *  but the calendar still turns -- can make an innocent gap two. A week
 *  stuck is five, and still fails. */
const MISSED_AT: Record<"daily" | "monthly" | "quarterly", number> = { daily: 3, monthly: 2, quarterly: 2 };

export function releasesMissed(cadence: "daily" | "monthly" | "quarterly", storedDate: string, liveDate: string): boolean {
  return releasesBehind(cadence, storedDate, liveDate) >= MISSED_AT[cadence];
}

export type Verdict = "matches" | "one release behind" | "RELEASES MISSED" | "VALUE DIFFERS" | "FETCH FAILED" | "SOURCE WENT BACKWARDS" | "NOT PUBLISHED";

export interface AuditRow {
  name: string;
  storedValue: number | null;
  storedDate: string;
  liveValue: number | null;
  liveDate: string;
  verdict: Verdict;
  detail?: string;
}

export interface AuditResult {
  rows: AuditRow[];
  /** The site is publishing something its source no longer agrees with.
   *  Worth failing a run and waking somebody for. */
  problems: string[];
  /** The source did not answer. NOT the same thing — see the note on
   *  the return of runSourceAudit. */
  unreachable: string[];
  /** Behind, but not by a missed release: the source has published and
   *  the next refresh has not run yet (for a daily series, up to two
   *  trading days, which allows a public holiday -- see releasesMissed). The ordinary state of affairs between a
   *  release and 06:10 the following morning, so it only warns. */
  behind: string[];
  checked: number;
}

const numberOf = (r: Fetched): number | undefined =>
  r.value ?? r.inflation ?? r.unemployment ?? r.gdpGrowth ?? r.policyRate;

/** The longest any one probe may hold the whole audit up, retries and
 *  all.
 *
 *  TWENTY PROBES RUN AT ONCE, NOT ONE AFTER ANOTHER. Sequentially they
 *  would take as long as the sum of twenty external APIs, and the route
 *  that calls this is capped at 60 seconds — one slow morning at ONS and
 *  the run dies part-way with no verdict on the markets further down the
 *  list. Run together, the audit takes as long as its slowest single
 *  source, and this cap bounds even that. They hit thirteen different
 *  hosts, at most three requests to any one of them, so nothing here is
 *  hammering a server.
 *
 *  A probe that trips this reports FETCH FAILED, which is the honest
 *  answer: a source that cannot be reached cannot confirm anything about
 *  what the site is publishing. */
const PROBE_TIMEOUT_MS = 35_000;

/** Two goes, not the usual three. This is a report, not the refresh:
 *  the refresh retries hard because a rescued value is the whole point,
 *  whereas here a third attempt only delays saying "could not reach it".
 *  Every probed fetcher aborts at 8s, so two attempts plus backoff bound
 *  a probe at ~16.4s, comfortably inside PROBE_TIMEOUT_MS. A source that
 *  misses twice is reported as unreachable, which is truthful either
 *  way. */
const PROBE_ATTEMPTS = 2;

async function withTimeout<T>(run: () => Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`no answer within ${ms / 1000}s`)), ms);
      }),
    ]);
  } finally {
    // Without this the pending timer keeps a Node process alive for the
    // full PROBE_TIMEOUT_MS after the work is done, which turns the local
    // script into something that looks hung after it has finished.
    if (timer) clearTimeout(timer);
  }
}

/**
 * `published` maps a market code to its newest SCOREABLE stored row —
 * what the site is actually showing. The caller supplies it so this
 * module stays free of any particular database client.
 *
 * TWO KINDS OF BAD NEWS, RETURNED SEPARATELY.
 *
 * `problems` means the site is publishing a figure its own source no
 * longer agrees with. Nothing else on the project detects that, and it
 * is worth failing a run and sending an email for.
 *
 * `unreachable` means the source did not answer. That is NOT the same
 * thing, and treating it as though it were is how a daily check turns
 * into a daily false alarm — which is the alarm people learn to skip,
 * and then the real one goes unread too. Statistics Canada was measured
 * on 2026-09-10 answering three identical requests with 200 in 10.7s,
 * nothing at all in 45s, and 502 in 35s. On such a morning every
 * Canadian probe reports unreachable while the stored Canadian figures
 * are perfectly correct — verified the same day, when the calls that did
 * return gave exactly what the site publishes.
 *
 * A fetcher that is PERMANENTLY broken also shows up here, and that must
 * not be shrugged off. What actually catches it, traced through the code
 * rather than assumed:
 *
 *   - settle() returns null, so the row is written with a NULL value AND
 *     a NULL date. The composite is all-or-nothing, so it is withheld
 *     rather than reweighted, and the market shows no score.
 *   - the pages fall back to the last complete observation, bounded at
 *     MAX_FALLBACK_DAYS. Past that the market reads N/A.
 *   - a value that arrives WITHOUT a date -- the fallback case -- is
 *     reported by stalenessWarnings, which fails the refresh.
 *
 * AN EARLIER VERSION OF THIS COMMENT CLAIMED SOMETHING FALSE, and it is
 * worth recording because the claim was load-bearing: it said a dead
 * source "stops the stored date advancing, and the age rules fail the
 * refresh at that series' cadence limit". The date does not stop
 * advancing, it goes null; stalenessOf returns null for a null date --
 * "no opinion", as its own doc comment says -- and stalenessWarnings read
 * that as a pass. So nothing fired at all. The age rules only ever saw
 * sources that kept answering with a frozen date, which is the Eurostat
 * shape, not the dead-fetcher shape. That hole is now closed in
 * app/api/refresh/route.ts; this note stands so nobody reinstates the
 * shortcut on the strength of a comment.
 */
// No `now` parameter, deliberately. The first version took one to age
// the live observation date against a grace period, which turned out to
// be the wrong question entirely -- see releasesBehind above. Nothing
// here depends on the wall clock any more: the comparison is between two
// dates the sources themselves supply, which also makes it reproducible.
/** Figures fetched elsewhere and handed in, keyed by probe name -- the
 *  same `${market} ${label}` string the rows are titled with. */
export type RelayedProbeValues = Map<string, { value: number; observationDate: string }>;

export async function runSourceAudit(
  published: Map<string, Record<string, unknown>>,
  relayed: RelayedProbeValues = new Map(),
): Promise<AuditResult> {
  const problems: string[] = [];
  const unreachable: string[] = [];
  const behind: string[] = [];

  const rows = await Promise.all(
    PROBES.map(async (probe): Promise<AuditRow> => {
      const name = `${probe.market} ${probe.label}`;
      const stored = published.get(probe.market);

      if (!stored) {
        return { name, storedValue: null, storedDate: "—", liveValue: null, liveDate: "—", verdict: "NOT PUBLISHED" };
      }

      let live: Fetched | null = null;
      let err = "";
      const handedIn = relayed.get(name);
      try {
        // A relayed figure was fetched by the workflow moments ago. Using
        // it rather than re-fetching is not a shortcut: for Korea this
        // runtime cannot reach the source at all.
        live = handedIn
          ? ({ value: handedIn.value, observationDate: handedIn.observationDate } as unknown as Fetched)
          : ((await withTimeout(
              () => withRetry(name, probe.fetch, { attempts: PROBE_ATTEMPTS }),
              PROBE_TIMEOUT_MS,
            )) as Fetched);
      } catch (e) {
        // withRetry prefixes its label, which is useful in a server log
        // and redundant here where the row already names the indicator.
        const msg = (e as Error).message;
        err = (msg.startsWith(`${name}: `) ? msg.slice(name.length + 2) : msg).slice(0, 90);
      }

      const storedValue = stored[probe.column] == null ? null : Number(stored[probe.column]);
      const storedDate = (stored[probe.dateColumn] as string | null) ?? "?";

      if (!live) {
        return { name, storedValue, storedDate, liveValue: null, liveDate: "—", verdict: "FETCH FAILED", detail: err };
      }

      const liveValue = numberOf(live) ?? null;
      const liveDate = live.observationDate ?? "?";
      let verdict: Verdict = "matches";

      if (liveDate !== "?" && storedDate !== "?" && liveDate > storedDate) {
        // One behind is the ordinary gap between a source publishing and
        // the next morning's refresh — a policy rate stamps a fresh date
        // every trading day at an unchanged level, and that is a new date
        // rather than a new rate. Past MISSED_AT, a release was missed and
        // never recovered.
        verdict = releasesMissed(CADENCE_OF[probe.column], storedDate, liveDate) ? "RELEASES MISSED" : "one release behind";
      } else if (liveDate !== "?" && storedDate !== "?" && liveDate < storedDate) {
        // THE SOURCE IS OFFERING AN OLDER PERIOD THAN THE ONE WE STORED.
        //
        // Not a staleness problem — the opposite. Either the institution
        // withdrew a release, or a fetcher has started reading a different
        // series and we have been publishing something that was never
        // there. Both are worse than being behind, because the site is
        // showing a figure its own source will no longer confirm.
        //
        // This used to fall through to the value comparison below and be
        // reported as "for the same period", naming our date. It was not
        // the same period, and the message asserted something the check
        // had just disproved.
        verdict = "SOURCE WENT BACKWARDS";
      } else if (
        liveValue != null && storedValue != null &&
        Math.abs(liveValue - storedValue) > probe.tolerance
      ) {
        verdict = "VALUE DIFFERS";
      }

      return { name, storedValue, storedDate, liveValue, liveDate, verdict };
    }),
  );

  // Collected AFTER the fan-out rather than inside it, so the order of
  // the report is the order of PROBES and not the order twenty APIs
  // happened to answer in. A list that reshuffles itself daily is
  // unreadable next to yesterday's.
  for (const r of rows) {
    if (r.verdict === "NOT PUBLISHED") problems.push(`${r.name}: nothing complete published for this market within ${MAX_FALLBACK_DAYS} days (the page shows N/A)`);
    else if (r.verdict === "RELEASES MISSED") problems.push(`${r.name}: source has ${r.liveDate}, site publishes ${r.storedDate} — releases missed (see releasesMissed)`);
    else if (r.verdict === "VALUE DIFFERS") problems.push(`${r.name}: source says ${r.liveValue}, site publishes ${r.storedValue} for the same period (${r.storedDate})`);
    else if (r.verdict === "SOURCE WENT BACKWARDS") problems.push(`${r.name}: source now offers ${r.liveDate}, older than the ${r.storedDate} the site publishes — a withdrawn release, or a fetcher reading the wrong series`);
    else if (r.verdict === "FETCH FAILED") unreachable.push(`${r.name}: ${r.detail}`);
    else if (r.verdict === "one release behind") behind.push(`${r.name}: source has ${r.liveDate}, site publishes ${r.storedDate}`);
  }

  return { rows, problems, unreachable, behind, checked: PROBES.length };
}

/** The fields that must all be present for a row to be the one the site
 *  scores. Identical to the list app/page.tsx passes, and it must stay
 *  identical — see below. */
const SCORED_FIELDS = ["inflation", "gdp_growth", "unemployment", "policy_rate", "debt_pct_gdp"] as const;

/**
 * The row each market is actually publishing right now.
 *
 * THIS DELEGATES TO latestCompleteObservation RATHER THAN REIMPLEMENTING
 * IT, and the distinction is not tidiness. The first version walked the
 * rows itself and took the first complete one it found, anywhere in the
 * window. The pages do not do that: they stop at MAX_FALLBACK_DAYS (14)
 * and render N/A beyond it, because a score frozen on three-week-old data
 * would look healthy while being wrong.
 *
 * So between day 14 and the end of the window the two disagreed, and the
 * audit would have compared a live source against a row NO READER COULD
 * SEE — failing the run over a figure that is not on the site. That is
 * the exact failure the old comment claimed to prevent, which is what a
 * copied definition does: it starts as a faithful copy and quietly stops
 * being one.
 *
 * Sharing the function means the audit cannot drift from the pages again:
 * change the bound or the field list and both move together.
 */
export function newestScoreableByMarket(
  rows: readonly Record<string, unknown>[],
): Map<string, Record<string, unknown>> {
  const byMarket = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const m = row.market as string;
    const list = byMarket.get(m);
    if (list) list.push(row);
    else byMarket.set(m, [row]);
  }

  const out = new Map<string, Record<string, unknown>>();
  for (const [market, list] of byMarket) {
    const pick = latestCompleteObservation(
      list,
      SCORED_FIELDS as unknown as readonly (keyof Record<string, unknown>)[],
      (r) => String(r.observation_date ?? ""),
    );
    // pick.row is null exactly when the page shows N/A for this market:
    // nothing complete inside the bound. Left out of the map, which the
    // caller reports as "nothing published" rather than comparing against
    // a row the site has already stopped showing.
    if (pick.row) out.set(market, pick.row);
  }
  return out;
}
