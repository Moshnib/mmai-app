"use client";

import { bandFor } from "@/lib/scoring";
import { scoreMarket, type MarketData } from "@/lib/markets";

export default function CompareGrid({
  markets,
  current,
  onSelect,
}: {
  markets: MarketData[];
  current: string;
  onSelect: (code: string) => void;
}) {
  return (
    <div className="compare-grid">
      {markets.map((m) => {
        const { composite } = scoreMarket(m);
        const band = bandFor(composite);
        return (
          <div
            key={m.code}
            className={`compare-card${m.code === current ? " selected" : ""}`}
            onClick={() => onSelect(m.code)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span className="compare-name">{m.name}</span>
              <span className="compare-score" style={{ color: band.color }}>
                {composite === null ? "N/A" : composite.toFixed(1)}
              </span>
            </div>
            <div className="compare-band" style={{ color: band.color }}>{band.label}</div>
          </div>
        );
      })}
    </div>
  );
}
