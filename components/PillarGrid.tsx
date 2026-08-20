"use client";

import { PILLAR_NAMES, PILLAR_WEIGHTS, bandFor, type PillarKey, type PillarScores } from "@/lib/scoring";
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

        return (
          <Link
            key={key}
            href={excluded ? "#" : `/trends?market=${market}&pillar=${key}`}
            className="pillar-card"
            style={{ textDecoration: "none", color: "inherit", display: "block", cursor: excluded ? "default" : "pointer" }}
          >
            <div style={{ width: 56, height: 56, margin: "0 auto", position: "relative" }}>
              <svg viewBox="0 0 56 56" width={56} height={56} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={28} cy={28} r={23} fill="none" stroke="#E7E9EF" strokeWidth={5} />
                <circle
                  cx={28} cy={28} r={23} fill="none"
                  stroke={excluded ? "#C7CCD6" : band.color}
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeDasharray={`${circumference * pct} ${circumference}`}
                />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: excluded ? "#8A93A6" : band.color }}>
                {excluded ? "—" : val!.toFixed(0)}
              </div>
            </div>
            <div className="pillar-name">{PILLAR_NAMES[key]}</div>
            <div className="pillar-weight">{(PILLAR_WEIGHTS[key] * 100).toFixed(0)}% weight</div>
            {!excluded && (
              <div style={{ marginTop: 6, fontSize: 10, fontFamily: "monospace", color: "var(--gold-deep)" }}>
                View trend →
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
