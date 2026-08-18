"use client";

import { bandFor } from "@/lib/scoring";

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export default function Gauge({ score }: { score: number | null }) {
  const band = bandFor(score);
  const angle = score === null ? 0 : Math.min(180, Math.max(0, (score / 100) * 180));

  return (
    <div style={{ position: "relative", width: 260, height: 170 }}>
      <svg viewBox="0 0 260 170" width={260} height={170} style={{ overflow: "visible" }}>
        <path d="M 30 150 A 100 100 0 0 1 230 150" fill="none" stroke="#E7E9EF" strokeWidth={20} strokeLinecap="round" />
        <path
          d={describeArc(130, 150, 100, 0, angle)}
          fill="none"
          stroke={band.color}
          strokeWidth={20}
          strokeLinecap="round"
          style={{ transition: "d 0.5s ease, stroke 0.4s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", top: "62%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
        <div className="gauge-num" style={{ color: band.color }}>{score === null ? "N/A" : score.toFixed(1)}</div>
        <div className="gauge-label">MMAI Score</div>
        <div className="band-pill" style={{ background: band.bg, color: band.color }}>{band.label}</div>
      </div>
    </div>
  );
}
