import Link from "next/link";
import type { Metadata } from "next";
import { SOURCES } from "@/lib/sources";
import { FALLBACK_MARKETS } from "@/lib/markets";
import { GULF_SOURCES, GULF_NAME_TO_CODE } from "@/lib/gulfSources";
import { GULF_COUNTRIES } from "@/lib/gulfMarkets";
import ExportDataButtons from "@/components/ExportDataButtons";
import SourcesTable from "@/components/SourcesTable";

export const metadata: Metadata = {
  title: "Data Sources & Licences",
  description:
    "Every institution, licence, and verification date behind every number on MMAI — plus a full CSV export of the underlying data.",
};

const marketOrder = ["All markets", ...FALLBACK_MARKETS.map((m) => m.name)];
const codeForName = Object.fromEntries(FALLBACK_MARKETS.map((m) => [m.name, m.code]));

const gulfOrder = GULF_COUNTRIES.map((c) => c.name);
const gulfGrouped = gulfOrder
  .map((name) => ({ name, entries: GULF_SOURCES.filter((s) => s.country === name) }))
  .filter((g) => g.entries.length > 0);

export default function SourcesPage() {
  const grouped = marketOrder
    .map((name) => ({ name, entries: SOURCES.filter((s) => s.market === name) }))
    .filter((g) => g.entries.length > 0);

  return (
    <>
      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">SOURCES &amp; FRESHNESS</p>
          <h1 className="headline" style={{ maxWidth: "22ch" }}>Every number, traced back to where it actually came from</h1>
          <p className="sub">Institution, licence, live-or-manual status, and when the data last came in — for every chart and widget in MMAI, not just the ones that make the index look good.</p>
        </div>
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SourcesTable groups={grouped} codeForName={codeForName} />
        </div>
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 8 }}>
            <p className="eyebrow">GULF WATCH (NON-SCORED)</p>
            <h2>Six more countries, without a composite score</h2>
            <p style={{ maxWidth: "68ch" }}>
              UAE, Bahrain, Qatar, Saudi Arabia, Kuwait, and Oman appear on the{" "}
              <Link href="/gulf-watch" style={{ color: "var(--gold-deep)" }}>Gulf Watch</Link> page with real, live
              data — but none of them get an MMAI score. Gulf Watch deliberately shows each country&apos;s raw
              indicators instead of a composite. Policy rates are now live for Saudi Arabia and Kuwait, via BIS
              republishing their own central banks; no usable, legal, automatable source has been found for the UAE
              or Bahrain, and Qatar&apos;s and Oman&apos;s are not wired in yet. Entries marked{" "}
              <b>UNAVAILABLE</b> below mean exactly that: no source exists at all, not that one is simply unused.
            </p>
          </div>
          <SourcesTable groups={gulfGrouped} codeForName={GULF_NAME_TO_CODE} freshnessTable="gulf_indicators" freshnessKeyColumn="country_code" />
        </div>
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <ExportDataButtons />
        </div>
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--hair)", borderRadius: 18, padding: "28px 32px", color: "#fff", backdropFilter: "blur(14px)" }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "var(--gold)", letterSpacing: 1, marginBottom: 10 }}>
              DISCLAIMER
            </div>
            <p style={{ fontSize: 13.5, color: "#DCE3EE", lineHeight: 1.75, margin: "0 0 12px" }}>
              MMAI is an analytical communication tool built entirely from data published by the government and multilateral
              institutions listed above. It is <b>not</b> a forecast, credit rating, trading signal, or recommendation to buy
              or sell any security, currency, or asset. Nothing on this site should be relied upon as investment, legal, or
              financial advice.
            </p>
            <p style={{ fontSize: 13.5, color: "#DCE3EE", lineHeight: 1.75, margin: "0 0 12px" }}>
              Entries marked <b>LIVE</b> are fetched directly from the source institution&apos;s public API at refresh time.
              Entries marked <b>MANUAL</b> use the most recent figure verified by hand and have not yet been connected to
              a live feed — the exact gap is stated in each row&apos;s note, and none are silently treated as current or
              extrapolated forward.
            </p>
            <p style={{ fontSize: 13.5, color: "#DCE3EE", lineHeight: 1.75, margin: 0 }}>
              Every formula used to turn these raw figures into the three dimension scores and the composite MMAI
              percentile is published in full on the <Link href="/learn" style={{ color: "var(--gold)" }}>Learn More</Link> page,
              together with the reference table the scores are ranked against — so the averages behind them can be checked
              rather than taken on trust. Nothing in the calculation is hidden or proprietary, and the page states plainly
              which numbers were measured and which were decided.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
