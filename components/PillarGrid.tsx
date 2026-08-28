"use client";

import { PILLAR_NAMES, formatWeightPct, bandFor, type PillarKey, type PillarScores } from "@/lib/scoring";
import Link from "next/link";

const ORDER: PillarKey[] = ["PS", "GM", "LM", "MC", "EC"];

// One-line plain-language descriptor per pillar (design brief §3: the
// five cards should make it obvious what each one measures without a
// separate legend). These describe the EXISTING pillars -- the names
// themselves come from PILLAR_NAMES and are methodology, not copy.
export const PILLAR_DESC: Record<PillarKey, string> = {
  PS: "Inflation trends & price pressures",
  GM: "Output, demand & economic momentum",
  LM: "Employment, wage growth & participation",
  MC: "Policy stance & financial conditions",
  EC: "Oil prices & external conditions",
};

// Simple line icons, one per pillar, matching the design reference's
// card structure. Inline SVG rather than an icon dependency -- five
// glyphs don't justify a package, and these inherit currentColor so
// they follow each card's own score colour.
export const PILLAR_ICONS: Record<PillarKey, React.ReactNode> = {
  // coins — price level
  PS: (
    <>
      <ellipse cx="8" cy="5" rx="5.5" ry="2.2" />
      <path d="M2.5 5v4c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2V5" />
      <path d="M2.5 9v4c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2V9" />
    </>
  ),
  // rising bars — growth
  GM: (
    <>
      <path d="M2 14h12" />
      <rect x="3.5" y="9" width="2.6" height="5" />
      <rect x="7.7" y="6" width="2.6" height="8" />
      <rect x="11.9" y="3.5" width="2.6" height="10.5" />
    </>
  ),
  // people — labour market
  LM: (
    <>
      <circle cx="6" cy="5.5" r="2.4" />
      <path d="M1.8 14c0-2.4 1.9-4 4.2-4s4.2 1.6 4.2 4" />
      <circle cx="12.2" cy="6.4" r="1.9" />
      <path d="M11 10.3c2 .1 3.4 1.6 3.4 3.7" />
    </>
  ),
  // bank — monetary conditions
  MC: (
    <>
      <path d="M8 2l6 3.2H2L8 2z" />
      <path d="M3.6 6.4v6M6.8 6.4v6M9.2 6.4v6M12.4 6.4v6" />
      <path d="M2 14h12" />
    </>
  ),
  // globe/arrow — external & commodities
  EC: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12M8 2c1.8 2 2.7 4 2.7 6s-.9 4-2.7 6c-1.8-2-2.7-4-2.7-6S6.2 4 8 2z" />
    </>
  ),
};

export default function PillarGrid({ pillars, market }: { pillars: PillarScores; market: string }) {
  return (
    <div className="pillar-grid">
      {ORDER.map((key) => {
        const val = pillars[key];
        const excluded = val == null;
        const band = excluded ? { color: "#8A93A6" } : bandFor(val);
        const circumference = 2 * Math.PI * 23;
        const pct = excluded ? 0 : val / 100;

        const cardStyle = { textDecoration: "none", color: "inherit", display: "block", cursor: excluded ? "default" : "pointer" } as const;

        const cardBody = (
          <>
            <svg
              viewBox="0 0 16 16" width={24} height={24} aria-hidden="true"
              fill="none" stroke={excluded ? "#3A3D4A" : band.color}
              strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round"
              style={{ display: "block", margin: "0 auto 12px", opacity: excluded ? 0.6 : 0.95 }}
            >
              {PILLAR_ICONS[key]}
            </svg>
            <div style={{ width: 92, height: 92, margin: "0 auto", position: "relative" }}>
              <svg viewBox="0 0 56 56" width={92} height={92} style={{ transform: "rotate(-90deg)", overflow: "visible" }}>
                <circle cx={28} cy={28} r={23} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
                <circle
                  cx={28} cy={28} r={23} fill="none"
                  stroke={excluded ? "#3A3D4A" : band.color}
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeDasharray={`${circumference * pct} ${circumference}`}
                  style={{
                    transition: "stroke-dasharray 0.8s ease, filter 0.4s ease",
                    filter: excluded ? undefined : `drop-shadow(0 0 6px ${band.color}) brightness(1.1)`,
                  }}
                />
              </svg>
              <div
                style={{
                  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 26,
                  color: excluded ? "var(--slate)" : band.color,
                  textShadow: excluded ? undefined : `0 0 14px ${band.color}70`,
                  filter: excluded ? undefined : "brightness(1.12) saturate(1.05)",
                }}
              >
                {excluded ? "—" : val!.toFixed(0)}
              </div>
            </div>
            <div className="pillar-name">{PILLAR_NAMES[key]}</div>
            <div className="pillar-desc">{PILLAR_DESC[key]}</div>
            <div className="pillar-weight" style={{ marginTop: 6 }}>{formatWeightPct(key)} weight</div>
            {!excluded && (
              <div style={{ marginTop: 6, fontSize: 10, fontFamily: "monospace", color: "var(--gold-deep)" }}>
                View trend →
              </div>
            )}
          </>
        );

        // A pillar with no data isn't a link at all -- href="#" is a real
        // navigation that yanks the reader back to the top of the page.
        return excluded ? (
          <div key={key} className="pillar-card" style={cardStyle}>{cardBody}</div>
        ) : (
          <Link key={key} href={`/trends?market=${market}&pillar=${key}`} className="pillar-card" style={cardStyle}>
            {cardBody}
          </Link>
        );
      })}
    </div>
  );
}
