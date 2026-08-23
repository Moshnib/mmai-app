import Link from "next/link";
import type { Metadata } from "next";
import { SOURCES } from "@/lib/sources";
import { FALLBACK_MARKETS } from "@/lib/markets";
import Flag from "@/components/Flag";
import ExportDataButtons from "@/components/ExportDataButtons";

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
          <p className="sub">Institution, licence, live-or-manual status, and the date each source was last verified — for every chart and widget in MMAI, not just the ones that make the index look good.</p>
        </div>
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          {grouped.map((group) => (
            <div key={group.name} style={{ marginBottom: 28 }}>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: 19, fontWeight: 600, margin: "0 0 12px", color: "var(--ink)", display: "flex", alignItems: "center", gap: 10 }}>
                {codeForName[group.name] && <Flag code={codeForName[group.name]} size={22} />}
                {group.name}
              </h2>
              <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--hair)", borderRadius: 14, overflow: "hidden", backdropFilter: "blur(14px)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.6fr 2.2fr 0.9fr 1fr", background: "rgba(139,92,246,0.18)", padding: "10px 18px", fontSize: 10.5, fontFamily: "monospace", fontWeight: 700, color: "var(--gold)", letterSpacing: 0.5 }}>
                  <span>INDICATOR</span>
                  <span>INSTITUTION</span>
                  <span>LICENCE</span>
                  <span>STATUS</span>
                  <span>LAST VERIFIED</span>
                </div>
                {group.entries.map((e, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4fr 1.6fr 2.2fr 0.9fr 1fr",
                      padding: "12px 18px",
                      fontSize: 12.5,
                      borderTop: i > 0 ? "1px solid var(--hair)" : undefined,
                      alignItems: "start",
                      gap: 6,
                    }}
                  >
                    <span style={{ fontWeight: 700, color: "var(--ink)" }}>{e.indicator}</span>
                    <span style={{ color: "var(--ink-soft)" }}>
                      {e.url ? (
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--ink-soft)", textDecoration: "underline", textDecorationColor: "var(--hair)", textUnderlineOffset: 3 }}
                        >
                          {e.institution} <span style={{ color: "var(--slate)", fontSize: 10 }}>↗</span>
                        </a>
                      ) : (
                        e.institution
                      )}
                    </span>
                    <span style={{ color: "var(--slate)" }}>
                      {e.license}
                      {e.note && <div style={{ fontSize: 10.5, fontStyle: "italic", color: "var(--gold-deep)", marginTop: 2 }}>{e.note}</div>}
                    </span>
                    <span>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: "3px 9px",
                          borderRadius: 999,
                          background: e.status === "live" ? "var(--teal-bg)" : "var(--gold-bg)",
                          color: e.status === "live" ? "var(--teal)" : "var(--gold-deep)",
                        }}
                      >
                        {e.status === "live" ? "LIVE" : "MANUAL"}
                      </span>
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: 11.5, color: "var(--slate)" }}>{e.lastVerified}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
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

      <footer>
        <div className="wrap">
          © 2026 MMAI — Moshnib Market Analysis Index. An analytical communication tool, not investment advice.
        </div>
      </footer>
    </>
  );
}
