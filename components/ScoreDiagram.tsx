import {
  DIMENSION_NAMES, DIMENSION_INDICATORS, INDICATOR_FIELD, INDICATOR_WEIGHT,
  DIMENSION_STATS, type DimensionKey,
} from "@/lib/composite";
import { REFERENCE_SET } from "@/lib/referenceSet";

const ORDER: DimensionKey[] = ["C", "D", "K"];
const DIM_COLOR: Record<DimensionKey, string> = {
  C: "#E14B4B",
  D: "#F0975B",
  K: "#22D3EE",
};

const REF_N = REFERENCE_SET.length;

/**
 * How five published numbers become one rank, drawn rather than described.
 *
 * WHY. The method has four stages and every one of them changes what the
 * number means -- a rate becomes a distance from average, distances get
 * combined into a dimension, dimensions get put on a common footing, and
 * only then does an average become a rank. Prose has to hold all four in a
 * reader's head at once. A diagram does not.
 *
 * Server-rendered inline SVG: no chart library, no client JavaScript, and
 * it appears in the HTML for anyone whose browser never runs a script.
 * Every label is read from the engine, so the picture cannot drift from
 * the arithmetic the way a drawn-once asset would.
 */
export default function ScoreDiagram() {
  const W = 880;
  const ROW_H = 46;
  const COL = { raw: 8, z: 208, dim: 396, std: 590, out: 742 };
  const BOX_W = { raw: 172, z: 150, dim: 156, std: 116, out: 130 };

  // One row per indicator, grouped by the dimension it feeds.
  const rows: { key: string; label: string; dim: DimensionKey; y: number }[] = [];
  let y = 58;
  for (const d of ORDER) {
    for (const ind of DIMENSION_INDICATORS[d]) {
      rows.push({ key: ind, label: INDICATOR_FIELD[ind].label, dim: d, y });
      y += ROW_H;
    }
    y += 10; // a gap between dimensions, so the grouping reads
  }
  const H = y + 34;

  const dimBand = (d: DimensionKey) => {
    const rs = rows.filter((r) => r.dim === d);
    const top = rs[0].y;
    const bottom = rs[rs.length - 1].y;
    return { top, bottom, mid: (top + bottom) / 2 };
  };

  const midAll = (dimBand("C").top + dimBand("K").bottom) / 2;

  const label = (x: number, text: string) => (
    <text x={x} y={30} fontFamily="IBM Plex Mono, monospace" fontSize={10.5} fill="var(--slate)" letterSpacing={1}>
      {text}
    </text>
  );

  const box = (x: number, cy: number, w: number, h: number, stroke: string, fill = "rgba(255,255,255,0.03)") => (
    <rect x={x} y={cy - h / 2} width={w} height={h} rx={8} fill={fill} stroke={stroke} strokeWidth={1} />
  );

  // A connector that steps across rather than curving, so the path from
  // one stage to the next is unambiguous at small sizes.
  const elbow = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = x1 + (x2 - x1) / 2;
    return `M${x1},${y1} H${mx} V${y2} H${x2}`;
  };

  return (
    <figure style={{ margin: "0 0 8px" }}>
      <div style={{ overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: "block", minWidth: 620 }}
          role="img"
          aria-label={
            `How the MMAI score is built, in four steps. Step one: five published figures — ` +
            `inflation, unemployment, GDP growth, government debt and the policy rate — are each ` +
            `converted to how far they sit from their own historical average across ${REF_N} market-years, ` +
            `with the sign flipped where a lower figure is better. Step two: those are combined into ` +
            `three dimensions — Conditions from inflation and unemployment, Direction from GDP growth alone, ` +
            `and Capacity from government debt and the policy rate. Step three: each dimension is divided ` +
            `by its own spread across the record, so all three carry equal weight in fact and not just in name. ` +
            `Step four: the three are averaged, and that average is ranked against the same ${REF_N} market-years ` +
            `to give the published percentile.`
          }
        >
          {label(COL.raw, "1 · PUBLISHED FIGURE")}
          {label(COL.z, "2 · VS ITS HISTORY")}
          {label(COL.dim, "3 · THREE DIMENSIONS")}
          {label(COL.std, "4 · PUT LEVEL")}
          {label(COL.out, "5 · RANKED")}

          {/* stage 1 and 2, one row per indicator */}
          {rows.map((r) => {
            const c = DIM_COLOR[r.dim];
            return (
              <g key={r.key}>
                {box(COL.raw, r.y, BOX_W.raw, 30, "var(--hair)")}
                <text x={COL.raw + 12} y={r.y + 4} fontSize={12} fill="#fff" fontFamily="IBM Plex Sans, sans-serif">
                  {r.label}
                </text>

                <path d={elbow(COL.raw + BOX_W.raw, r.y, COL.z, r.y)} fill="none" stroke="var(--hair)" strokeWidth={1} />

                {box(COL.z, r.y, BOX_W.z, 30, "var(--hair)")}
                <text x={COL.z + 12} y={r.y + 4} fontSize={11} fill="var(--ink-soft)" fontFamily="IBM Plex Mono, monospace">
                  (X − mean) ÷ sd
                </text>

                {/* into its dimension, weighted */}
                <path
                  d={elbow(COL.z + BOX_W.z, r.y, COL.dim, dimBand(r.dim).mid)}
                  fill="none" stroke={c} strokeWidth={1.2} opacity={0.75}
                />
                <text
                  x={COL.z + BOX_W.z + 16} y={r.y - 5}
                  fontSize={10} fill={c} fontFamily="IBM Plex Mono, monospace"
                >
                  × {INDICATOR_WEIGHT[r.key as keyof typeof INDICATOR_WEIGHT] === 1
                    ? "1"
                    : INDICATOR_WEIGHT[r.key as keyof typeof INDICATOR_WEIGHT].toFixed(3)}
                </text>
              </g>
            );
          })}

          {/* stage 3 and 4, one per dimension */}
          {ORDER.map((d) => {
            const b = dimBand(d);
            const c = DIM_COLOR[d];
            const h = Math.max(34, b.bottom - b.top + 34);
            return (
              <g key={d}>
                {box(COL.dim, b.mid, BOX_W.dim, h, c, `${c}14`)}
                <text x={COL.dim + 12} y={b.mid - 2} fontSize={12.5} fill="#fff" fontWeight={600} fontFamily="IBM Plex Sans, sans-serif">
                  {DIMENSION_NAMES[d]}
                </text>
                <text x={COL.dim + 12} y={b.mid + 13} fontSize={10} fill={c} fontFamily="IBM Plex Mono, monospace">
                  {DIMENSION_INDICATORS[d].length === 1 ? "1 indicator" : `${DIMENSION_INDICATORS[d].length} indicators`}
                </text>

                <path d={elbow(COL.dim + BOX_W.dim, b.mid, COL.std, b.mid)} fill="none" stroke={c} strokeWidth={1.2} />

                {box(COL.std, b.mid, BOX_W.std, 34, c, `${c}14`)}
                <text x={COL.std + 10} y={b.mid - 2} fontSize={10.5} fill="var(--ink-soft)" fontFamily="IBM Plex Mono, monospace">
                  ÷ own spread
                </text>
                <text x={COL.std + 10} y={b.mid + 11} fontSize={10} fill={c} fontFamily="IBM Plex Mono, monospace">
                  {DIMENSION_STATS[d].sd.toFixed(3)}
                </text>

                <path d={elbow(COL.std + BOX_W.std, b.mid, COL.out, midAll)} fill="none" stroke={c} strokeWidth={1.2} opacity={0.75} />
              </g>
            );
          })}

          {/* the average, then the rank */}
          {box(COL.out, midAll, BOX_W.out, 62, "#8B5CF6", "rgba(139,92,246,0.14)")}
          <text x={COL.out + 12} y={midAll - 16} fontSize={11} fill="#fff" fontFamily="IBM Plex Mono, monospace">
            average
          </text>
          <text x={COL.out + 12} y={midAll - 2} fontSize={11} fill="var(--ink-soft)" fontFamily="IBM Plex Mono, monospace">
            of the three
          </text>
          <text x={COL.out + 12} y={midAll + 16} fontSize={11.5} fill="#8B5CF6" fontWeight={700} fontFamily="IBM Plex Mono, monospace">
            → percentile
          </text>
          <text x={COL.out + 12} y={midAll + 30} fontSize={9.5} fill="var(--slate)" fontFamily="IBM Plex Mono, monospace">
            vs {REF_N} market-years
          </text>
        </svg>
      </div>

      <figcaption style={{ fontSize: 12, color: "var(--slate)", lineHeight: 1.65, marginTop: 12, maxWidth: "76ch" }}>
        <b style={{ color: "var(--ink-soft)" }}>Step 4 is the one that is easy to miss.</b> Dividing each dimension by
        its own spread is what makes the equal thirds real. Conditions varies about a third less across history than
        Direction does, so averaging the three without this step would hand Direction the loudest voice whatever the
        weights said — the difference between a weight on paper and a weight in effect.
      </figcaption>
    </figure>
  );
}
