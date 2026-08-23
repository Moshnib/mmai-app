"use client";

import { PILLAR_NAMES, formatWeightPct, bandFor, type PillarKey, type PillarScores } from "@/lib/scoring";
import Link from "next/link";

const ORDER: PillarKey[] = ["PS", "GM", "LM", "MC", "EC"];

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
            <div style={{ width: 60, height: 60, margin: "0 auto", position: "relative" }}>
              <svg viewBox="0 0 56 56" width={60} height={60} style={{ transform: "rotate(-90deg)", overflow: "visible" }}>
                <circle cx={28} cy={28} r={23} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
                <circle
                  cx={28} cy={28} r={23} fill="none"
                  stroke={excluded ? "#3A3D4A" : band.color}
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeDasharray={`${circumference * pct} ${circumference}`}
                  style={{
                    transition: "stroke-dasharray 0.8s ease, filter 0.4s ease",
                    filter: excluded ? undefined : `drop-shadow(0 0 5px ${band.color}90)`,
                  }}
                />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 13, color: excluded ? "var(--slate)" : band.color, textShadow: excluded ? undefined : `0 0 10px ${band.color}50` }}>
                {excluded ? "—" : val!.toFixed(0)}
              </div>
            </div>
            <div className="pillar-name">{PILLAR_NAMES[key]}</div>
            <div className="pillar-weight">{formatWeightPct(key)} weight</div>
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
