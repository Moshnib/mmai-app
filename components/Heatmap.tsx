"use client";

import { PILLAR_NAMES, bandFor, type PillarKey } from "@/lib/scoring";
import { scoreMarket, type MarketData } from "@/lib/markets";

const ORDER: PillarKey[] = ["PS", "GM", "LM", "MC", "EC"];

export default function Heatmap({ markets }: { markets: MarketData[] }) {
  return (
    <div className="heatmap-grid">
      <div />
      {ORDER.map((key) => (
        <div key={key} className="hm-colhead">{PILLAR_NAMES[key]}</div>
      ))}

      {markets.map((m) => {
        const { pillars } = scoreMarket(m);
        return (
          <div key={m.code} style={{ display: "contents" }}>
            <div className="hm-rowhead">{m.name}</div>
            {ORDER.map((key) => {
              const val = pillars[key];
              const excluded = val == null;
              const band = excluded ? null : bandFor(val);
              return (
                <div
                  key={key}
                  className={`hm-cell${excluded ? " excluded" : ""}`}
                  style={!excluded ? { background: band!.color, boxShadow: `0 0 14px -2px ${band!.color}80` } : undefined}
                  title={excluded ? `${m.name} — ${PILLAR_NAMES[key]}: excluded` : `${m.name} — ${PILLAR_NAMES[key]}: ${val!.toFixed(1)}`}
                >
                  <div className="hm-val">{excluded ? "—" : val!.toFixed(0)}</div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
