import Link from "next/link";
import type { Metadata } from "next";
import { SOURCES } from "@/lib/sources";
import { FALLBACK_MARKETS } from "@/lib/markets";
import ExportDataButtons from "@/components/ExportDataButtons";
import SourcesTable from "@/components/SourcesTable";

export const metadata: Metadata = {
  title: "Data Sources & Licences",
  description:
    "Every institution, licence, and verification date behind every number on MMAI — plus a full CSV export of the underlying data.",
};

const marketOrder = ["All markets", ...FALLBACK_MARKETS.map((m) => m.name)];
const codeForName = Object.fromEntries(FALLBACK_MARKETS.map((m) => [m.name, m.code]));

export default function SourcesPage() {
  const grouped = marketOrder
    .map((name) => ({ name, entries: SOURCES.filter((s) => s.market === name) }))
    .filter((g) => g.entries.length > 0);

  return (
    <>
      <nav>
        <div className="navrow">
          <Link href="/" className="brand"><span className="dot" />MMAI</Link>
          <div className="navlinks">
            <Link href="/" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Overview</Link>
            <Link href="/trends" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Data Over Time</Link>
            <Link href="/compare" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Compare</Link>
            <Link href="/learn" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Learn</Link>
            <button className="navlink active">Sources</button>
            <Link href="/contact" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Contact</Link>
          </div>
        </div>
      </nav>

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
              Every formula used to convert these raw figures into the 0–100 pillar scores and the composite MMAI score is
              published in full on the <Link href="/learn" style={{ color: "var(--gold)" }}>Learn</Link> page — nothing in
              the calculation is hidden or proprietary.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
