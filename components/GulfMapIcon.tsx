import Flag from "@/components/Flag";

// A stylized, non-geographic Gulf "map" -- not traced from real coastline
// data on purpose. lib/mapdata/world-paths.json (used by WorldMap.tsx) has
// no Bahrain polygon at all and near-illegible Qatar/Kuwait shapes at low
// resolution, so a real-border version was already ruled out for the full
// interactive map (see project plan). This is the same honest workaround
// the EA flag already uses -- an abstract shape (a ring of stars, not
// Europe's outline) rather than a precise map claiming accuracy it can't
// back up. Flag positions below are relative placement in the right
// rough order (Kuwait north, Oman southeast tip), not to scale.
const PINS: Array<{ code: string; top: string; left: string; size: number }> = [
  { code: "KW", top: "10%", left: "20%", size: 15 },
  { code: "SA", top: "46%", left: "28%", size: 20 },
  { code: "BH", top: "40%", left: "54%", size: 14 },
  { code: "QA", top: "58%", left: "60%", size: 15 },
  { code: "AE", top: "72%", left: "76%", size: 16 },
  { code: "OM", top: "80%", left: "92%", size: 15 },
];

export default function GulfMapIcon({ width = 130, height = 90 }: { width?: number; height?: number }) {
  return (
    <div style={{ position: "relative", width, height, flexShrink: 0 }}>
      <svg width={width} height={height} viewBox="0 0 130 90" style={{ display: "block" }}>
        <defs>
          <linearGradient id="gulf-land" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#D9A441" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#B9822A" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="gulf-water" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0E7A8C" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {/* land -- soft abstract landmass, not a real coastline */}
        <path
          d="M8,20 C30,8 55,10 70,22 C85,32 78,50 88,58 C98,66 95,80 78,84 C55,90 30,86 16,72 C4,60 2,38 8,20 Z"
          fill="url(#gulf-land)"
          stroke="rgba(217,164,65,0.5)"
          strokeWidth="1"
        />
        {/* gulf waters -- abstract inlet, not traced */}
        <path
          d="M70,22 C90,20 118,28 124,44 C128,56 116,66 100,62 C88,58 88,44 78,34 C74,30 71,26 70,22 Z"
          fill="url(#gulf-water)"
          stroke="rgba(34,211,238,0.45)"
          strokeWidth="1"
        />
      </svg>
      {PINS.map((p) => (
        <div key={p.code} style={{ position: "absolute", top: p.top, left: p.left, transform: "translate(-50%, -50%)" }}>
          <Flag code={p.code} size={p.size} />
        </div>
      ))}
    </div>
  );
}
