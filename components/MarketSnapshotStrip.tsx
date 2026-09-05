"use client";

import { colorForScore, type RawIndicators } from "@/lib/indicators";

// ============================================================
// "Featured Market Snapshot" context bar (design brief §2): a compact
// label, the latest verification date, and 2-3 very short state chips
// above the main score card.
//
// The chips are DESCRIPTIVE, not predictive, and they re-use the exact
// thresholds MMAI already publishes and already applies in the
// homepage's rate narrative -- 2% inflation target (Equation 1's tau)
// and 2.5% neutral policy rate (Equation 4's default). Nothing new is
// introduced here: this is the same claim the page already makes,
// stated in three words instead of a paragraph.
//
// Deliberately NOT phrased as direction ("Inflation easing" / "Labor
// resilient" as in the reference mock-up). Direction needs a prior
// reading to compare against, and the homepage's score card has only a
// current snapshot -- claiming a trend from one value would be
// inventing information. Week-over-week direction lives in the Weekly
// Feed, which has both endpoints and the gates to know they're
// comparable.
// ============================================================

const INFLATION_TARGET = 2.0; // Equation 1's default tau
const RATE_NEUTRAL = 2.5; // Equation 4's default neutral rate
const NEAR = 0.5; // within this many points reads as "near"

interface Chip {
  label: string;
  color: string;
}

function buildChips(raw: RawIndicators): Chip[] {
  const chips: Chip[] = [];
  const { inflation, policyRate, unemployment } = raw;

  if (inflation != null) {
    const gap = inflation - INFLATION_TARGET;
    chips.push({
      label:
        Math.abs(gap) <= NEAR ? "Inflation near target" : gap > 0 ? "Inflation above target" : "Inflation below target",
      color: "#E14B4B",
    });
  }
  if (policyRate != null) {
    const gap = policyRate - RATE_NEUTRAL;
    chips.push({
      label: Math.abs(gap) <= NEAR ? "Policy near neutral" : gap > 0 ? "Policy above neutral" : "Policy below neutral",
      color: "#8B5CF6",
    });
  }
  if (unemployment != null) {
    // labourMarketScore() treats 2% as the top of its scale and loses 10
    // points per point above it; 6% is where that score reaches 60.
    chips.push({
      label: unemployment <= 4 ? "Labour market tight" : unemployment <= 6 ? "Labour market steady" : "Labour market loose",
      color: "#22D3EE",
    });
  }
  return chips;
}

export default function MarketSnapshotStrip({
  marketName,
  composite,
  raw,
  verifiedAt,
}: {
  marketName: string;
  composite: number | null;
  raw: RawIndicators;
  verifiedAt: string | null;
}) {
  const chips = buildChips(raw);
  const accent = colorForScore(composite);

  return (
    <div className="snapshot-strip">
      <span className="meta-label" style={{ color: accent, letterSpacing: 1.4 }}>
        Featured Market Snapshot
      </span>
      <span style={{ fontSize: 12, color: "var(--slate)" }}>
        {marketName}
        {verifiedAt && (
          <>
            {" · "}
            <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>Verified {verifiedAt}</span>
          </>
        )}
      </span>
      {chips.length > 0 && (
        <div className="snapshot-chips">
          {chips.map((c) => (
            <span key={c.label} className="chip">
              <i style={{ background: c.color }} />
              {c.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
