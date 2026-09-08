"use client";

import Link from "next/link";
import Flag from "@/components/Flag";
import { formatPeriod } from "@/lib/gulfHistoryHelpers";
import {
  GULF_CPI_GRANULARITY,
  GULF_FX_RESERVES_GRANULARITY,
  GULF_CURRENT_ACCOUNT_GRANULARITY,
  GULF_REAL_ESTATE_GRANULARITY,
  GULF_POLICY_RATE_GRANULARITY,
  GULF_POLICY_RATE_LABELS,
} from "@/lib/gulfMarkets";

export interface GulfCardData {
  code: string;
  name: string;
  /** Human names of any indicators filled from an earlier reading
   *  because this run's fetch failed -- see lib/useGulfIndicators.ts.
   *  Empty when everything on the card came from the latest run.
   *
   *  The card says so. Carrying a value forward is defensible; doing it
   *  invisibly is not, and the previous design recorded it only in a
   *  database column no page ever read. */
  carriedFields: string[];
  cpiYoy: number | null;
  realEstateValue: number | null;
  realEstateMetricLabel: string | null;
  fxReservesMonthsImports: number | null;
  currentAccountPctGdp: number | null;
  // Each field's own true reporting period -- CPI, FX reserves, and
  // current account routinely come from different years for the same
  // country (World Bank publishes annually and often lags by 1-2 years;
  // national CPI sources vary too). A single shared date used to hide
  // this -- a site owner spot-check against IMF/national sources found
  // no way to tell which numbers were current and which were stale,
  // because the real per-field dates were being fetched correctly but
  // discarded before reaching the database. Null on rows written before
  // this existed, or when that specific source failed this run.
  cpiObservationDate: string | null;
  realEstateObservationDate: string | null;
  fxReservesObservationDate: string | null;
  currentAccountObservationDate: string | null;
  // Saudi Arabia and Kuwait only (BIS). The label travels with the
  // value because these are different instruments -- Saudi's repo rate
  // vs Kuwait's discount rate -- so a shared generic heading would
  // imply a comparability that isn't there.
  policyRate: number | null;
  policyRateLabel: string | null;
  policyRateObservationDate: string | null;
  fetchedAt: string | null;
  // Computed once when the data is fetched (lib/useGulfIndicators.ts),
  // not here at render time -- calling Date.now() directly in a
  // component body is an impure render (flagged by the
  // react-hooks/purity rule: results can shift between renders with no
  // prop change), even though the practical risk here is low.
  isStale: boolean;
  hasScore?: boolean; // Oman-shaped escape hatch for later, unused today
}

// Stored dates are Postgres `date` values ("2025-01-01"), but the DAY is
// never meaningful and the MONTH is only meaningful for monthly sources
// -- World Bank stamps an annual figure as Jan 1 of its year, so
// rendering that as "Jan 2025" would invent a January reading for a
// whole-calendar-year statistic. Granularity therefore has to be passed
// in (from lib/gulfMarkets.ts), never sniffed from the string: an annual
// 2026 figure and a real January 2026 reading are both "2026-01-01".
//
// Parsed with a regex rather than `new Date()` on purpose -- no
// timezone can shift a date across a year boundary this way, and a
// malformed value returns null (no date shown) instead of the string
// "Invalid Date". Delegates the actual wording to formatPeriod() so
// these cards and GulfTrends' comparison table can never disagree.
function formatObsDate(iso: string, granularity: "annual" | "monthly" | "daily"): string | null {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(iso);
  if (!m) return null;
  const [, year, month, day] = m;
  if (granularity === "annual") return formatPeriod(year, "annual");

  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  if (granularity === "daily") {
    // A daily granularity with no day component means the stored value
    // doesn't match what the source is supposed to provide -- show no
    // date rather than silently degrade it to a month.
    if (!day) return null;
    return formatPeriod(`${year}-${month}-${day}`, "daily");
  }
  return formatPeriod(`${year}-${month}`, "monthly");
}

function Stat({
  label,
  value,
  asOf,
  granularity,
}: {
  label: string;
  value: string | null;
  asOf?: string | null;
  granularity?: "annual" | "monthly" | "daily";
}) {
  // Only ever shown alongside a real value. A null value means the
  // figure is missing or stale, and its reporting period alone would
  // read as if that period's number were on display -- and for the
  // legacy fallback path in useGulfIndicators, the date behind a null
  // CPI can be a FETCH date rather than a reporting period. Do not
  // render a date without a value (e.g. as a "last known: ..." line)
  // without fixing that fallback first.
  const asOfLabel = value != null && asOf && granularity ? formatObsDate(asOf, granularity) : null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", gap: 10 }}>
      <span style={{ fontSize: 12, color: "var(--slate)" }}>{label}</span>
      <span style={{ textAlign: "right" }}>
        <span style={{ display: "block", fontFamily: "Space Grotesk, monospace", fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>
          {value ?? "—"}
        </span>
        {/* Class rather than an inline font-size: at 9.5px this was the
            smallest text on the site and unreadable on a phone, and an
            inline size cannot be raised by a media query. */}
        {asOfLabel && <span className="gulf-obs-date">as of {asOfLabel}</span>}
      </span>
    </div>
  );
}

export default function GulfCard({ country, compact = false }: { country: GulfCardData; compact?: boolean }) {
  const isStale = country.isStale;
  // Whether a policy-rate SOURCE exists for this country -- deliberately
  // read from config rather than from country.policyRateLabel, so a
  // failed BIS fetch (which leaves both the value and the stored label
  // null) can't make the footer claim no source exists. See
  // GULF_POLICY_RATE_LABELS.
  const policyRateHeading = GULF_POLICY_RATE_LABELS[country.code];

  // The homepage shows a condensed version -- two headline figures and
  // a short note -- with the full indicator set living on /gulf-watch.
  // Compact cards are links, so tapping a country on the homepage goes
  // somewhere.
  //
  // THIS NOTE USED TO READ "Score pending", WHICH PROMISED SOMETHING
  // THAT IS NEVER COMING. Gulf countries are unscored by decision, not
  // by delay: a feasibility check put all six at roughly 81-91, above
  // every scored market, because the labour-market input rewards low
  // official unemployment and Gulf unemployment is low substantially
  // through how migrant labour is counted. Publishing "Saudi Arabia 88,
  // United States 78.5" was judged indefensible, and that judgment
  // stands. "Pending" told a reader to wait for a number nobody intends
  // to publish, and contradicted the full card two clicks away, which
  // said the opposite.
  if (compact) {
    return (
      <Link href="/gulf-watch" className="compare-card gulf-compact">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Flag code={country.code} size={22} />
          <span className="compare-name">{country.name}</span>
        </div>
        <div style={{ borderTop: "1px solid var(--hair)", paddingTop: 4 }}>
          <Stat
            label="Inflation (YoY)"
            value={isStale || country.cpiYoy == null ? null : `${country.cpiYoy.toFixed(1)}%`}
            asOf={country.cpiObservationDate}
            granularity={GULF_CPI_GRANULARITY[country.code]}
          />
          <Stat
            label="Current account"
            value={isStale || country.currentAccountPctGdp == null ? null : `${country.currentAccountPctGdp.toFixed(1)}% of GDP`}
            asOf={country.currentAccountObservationDate}
            granularity={GULF_CURRENT_ACCOUNT_GRANULARITY}
          />
        </div>
        <div style={{ borderTop: "1px solid var(--hair)", marginTop: 8, paddingTop: 8, fontSize: 11, color: "var(--slate)" }}>
          {isStale ? "Not refreshing" : "Not scored — by design"}
        </div>
      </Link>
    );
  }

  return (
    <div className="compare-card" style={{ cursor: "default" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Flag code={country.code} size={22} />
        <span className="compare-name">{country.name}</span>
      </div>

      <div style={{ borderTop: "1px solid var(--hair)", paddingTop: 4 }}>
        <Stat
          label="Inflation (YoY)"
          value={isStale || country.cpiYoy == null ? null : `${country.cpiYoy.toFixed(1)}%`}
          asOf={country.cpiObservationDate}
          granularity={GULF_CPI_GRANULARITY[country.code]}
        />
        {/* Only Qatar has a real estate fetcher wired up (see
            app/api/refresh-gulf/route.ts) -- every other country's
            real_estate_metric_label is permanently null, by design, not
            a temporary gap. Showing "Real estate activity: —" implied a
            number was coming; hiding the row entirely for those 5
            countries is the honest version. */}
        {country.realEstateMetricLabel != null && (
          <Stat
            label={country.realEstateMetricLabel}
            value={isStale || country.realEstateValue == null ? null : country.realEstateValue.toLocaleString()}
            asOf={country.realEstateObservationDate}
            granularity={GULF_REAL_ESTATE_GRANULARITY}
          />
        )}
        <Stat
          label="FX reserves"
          value={isStale || country.fxReservesMonthsImports == null ? null : `${country.fxReservesMonthsImports.toFixed(1)} mo. imports`}
          asOf={country.fxReservesObservationDate}
          granularity={GULF_FX_RESERVES_GRANULARITY}
        />
        <Stat
          label="Current account"
          value={isStale || country.currentAccountPctGdp == null ? null : `${country.currentAccountPctGdp.toFixed(1)}% of GDP`}
          asOf={country.currentAccountObservationDate}
          granularity={GULF_CURRENT_ACCOUNT_GRANULARITY}
        />
        {/* Keyed on whether a SOURCE exists (a code-level fact), not on
            whether today's row carries a value. The other four countries
            have no policy-rate source at all, so their row is absent
            entirely -- same as real estate. Saudi and Kuwait always show
            the row: if a BIS fetch failed, it shows "—" like any other
            temporarily-missing indicator, rather than vanishing and
            implying no source exists. */}
        {policyRateHeading && (
          <Stat
            label={country.policyRateLabel ?? policyRateHeading}
            value={isStale || country.policyRate == null ? null : `${country.policyRate.toFixed(2)}%`}
            asOf={country.policyRateObservationDate}
            granularity={GULF_POLICY_RATE_GRANULARITY}
          />
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--hair)", marginTop: 8, paddingTop: 8, fontSize: 11, color: "var(--slate)", lineHeight: 1.5 }}>
        {isStale ? (
          "Not currently refreshing — no recent data available."
        ) : (
          <>
            {/* ONE SENTENCE, THE SAME FOR ALL SIX, AND THE TRUE REASON.
                This branched on whether a policy rate existed, and told
                the four countries without one that the missing rate was
                why they had no score. That was never the reason, and it
                implied the opposite of the decision on record: that
                sourcing a policy rate would unlock a score.
                What actually happened is that a feasibility check put
                all six Gulf countries at roughly 81-91, ABOVE every
                scored market. Not an arithmetic bug -- the labour-market
                input rewards low official unemployment, and Gulf
                unemployment is low substantially because of how migrant
                labour is counted, so it does not mean what it means in
                Germany. Ranking Saudi Arabia above the United States on
                that basis was judged indefensible, and the countries are
                unscored by choice. Saying so is the difference between a
                methodological position a reader can argue with and a
                gap that looks like neglect. */}
            {/* CARRYING A VALUE FORWARD IS DEFENSIBLE. DOING IT SILENTLY
                IS NOT. When a source does not answer, the card shows its
                last real reading with that reading's own period -- which
                is honest only if the reader is told it happened. The
                previous design recorded it in a database column no page
                ever read, so a carried number and a live one looked
                identical. */}
            {country.carriedFields.length > 0 && (
              <>
                <b style={{ color: "var(--ink-soft)" }}>
                  {country.carriedFields.length === 1
                    ? `The ${country.carriedFields[0]} figure did not refresh today.`
                    : `${country.carriedFields.length} figures did not refresh today.`}
                </b>{" "}
                The last reading is shown, with its own reporting date — nothing has been estimated.{" "}
              </>
            )}
            Not scored, deliberately: Gulf unemployment largely reflects how migrant labour is counted, so it does
            not carry the same meaning as in the six scored economies and the two cannot share one scale.
            {country.fxReservesMonthsImports != null && (
              <>
                {" "}FX reserves use the World Bank&apos;s own calculation — other institutions (e.g. the IMF) sometimes report a
                different figure for the same year using a different method.
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
