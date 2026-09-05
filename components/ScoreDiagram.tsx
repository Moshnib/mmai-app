import {
  DIMENSION_NAMES, DIMENSION_INDICATORS, INDICATOR_FIELD, INDICATOR_WEIGHT,
  computeMmai, dimensionPercentiles, explainDimension, standardiseDimensions,
  rawDimensions, type DimensionKey, type IndicatorKey,
} from "@/lib/composite";
import { inflationTargetFor } from "@/lib/indicators";
import { FALLBACK_MARKETS } from "@/lib/markets";
import { REFERENCE_SET } from "@/lib/referenceSet";

const ORDER: DimensionKey[] = ["C", "D", "K"];
const TONE: Record<DimensionKey, string> = { C: "#E14B4B", D: "#F0975B", K: "#22D3EE" };
const FINAL = "#8B5CF6";
const N = REFERENCE_SET.length;

/** A real worked example rather than an abstract one. Australia because it
 *  is the current top scorer, so every dimension reads positive and the
 *  picture is not asking a reader to parse three minus signs on their first
 *  encounter with the method. */
const EXAMPLE = FALLBACK_MARKETS.find((m) => m.code === "AU")!;
/** Australia targets the midpoint of the RBA’s 2-3% band. Read from the
 *  engine so the drawing cannot disagree with the score. */
const EXAMPLE_TARGET = inflationTargetFor(EXAMPLE.code);

/**
 * The recipe: five published figures, grouped into three, averaged, ranked.
 *
 * Drawn with the REAL numbers for one market rather than symbols. A reader
 * meeting this method for the first time does not need "(X − mean) ÷ sd";
 * they need to see 4.35% go in one end and a rank come out the other, with
 * the grouping visible in between. The formula is on the same page, below,
 * for anyone who wants it.
 *
 * Server-rendered inline SVG. Every value is computed from the engine at
 * build time, so the illustration cannot drift from the arithmetic.
 */
export default function ScoreDiagram() {
  const result = computeMmai(EXAMPLE.raw, EXAMPLE.code);
  const std = standardiseDimensions(rawDimensions({
    infGap: Math.abs((EXAMPLE.raw.inflation as number) - EXAMPLE_TARGET),
    une: EXAMPLE.raw.unemployment as number,
    gdp: EXAMPLE.raw.gdpGrowth as number,
    debt: EXAMPLE.raw.debtPctGdp as number,
    rate: EXAMPLE.raw.policyRate as number,
  }));
  const dimPct = dimensionPercentiles(std);

  // ---------- layout ----------
  const W = 940, H = 430;
  const IN_X = 14, IN_W = 210, IN_H = 50;
  const DIM_X = 400, DIM_W = 216;
  const OUT_X = 726, OUT_W = 200;

  const rows: { key: IndicatorKey; dim: DimensionKey; y: number }[] = [];
  let y = 74;
  for (const d of ORDER) {
    for (const k of DIMENSION_INDICATORS[d]) { rows.push({ key: k, dim: d, y }); y += IN_H + 14; }
    y += 16;
  }
  const band = (d: DimensionKey) => {
    const rs = rows.filter((r) => r.dim === d);
    return (rs[0].y + rs[rs.length - 1].y) / 2;
  };
  const centre = (band("C") + band("K")) / 2;

  // A soft S-curve, so the eye follows the flow rather than tracing corners.
  const flow = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = (x2 - x1) * 0.55;
    return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
  };

  const valueOf = (k: IndicatorKey) => {
    const f = INDICATOR_FIELD[k];
    const v = EXAMPLE.raw[f.key] as number;
    return `${v.toFixed(f.decimals)}${f.unit.includes("%") ? "%" : ""}`;
  };

  return (
    <figure style={{ margin: 0 }}>
      <div style={{ overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", minWidth: 680 }}
          role="img"
          aria-label={
            `The recipe behind an MMAI score, using Australia as a worked example. Five published figures — ` +
            `inflation ${valueOf("infGap")}, unemployment ${valueOf("une")}, GDP growth ${valueOf("gdp")}, ` +
            `government debt ${valueOf("debt")} and a policy rate of ${valueOf("rate")} — are each compared with ` +
            `${N} market-years of history for the same six economies. They are grouped into three: Conditions from ` +
            `inflation and unemployment, Direction from GDP growth alone, and Capacity from debt and the policy rate. ` +
            `Those three are averaged, and the average is ranked against the same history to give Australia a score of ` +
            `${result.percentile?.toFixed(1)}.`
          }
        >
          <defs>
            {ORDER.map((d) => (
              <linearGradient key={d} id={`g-${d}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={TONE[d]} stopOpacity="0.18" />
                <stop offset="100%" stopColor={TONE[d]} stopOpacity="0.75" />
              </linearGradient>
            ))}
            <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="7" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* column headings */}
          {[
            [IN_X, "TODAY’S PUBLISHED FIGURES"],
            [DIM_X, "GROUPED INTO THREE"],
            [OUT_X, "ONE RANK"],
          ].map(([x, t]) => (
            <text key={t as string} x={x as number} y={30} fontSize={10.5} letterSpacing={1.4}
              fill="var(--slate)" fontFamily="IBM Plex Mono, monospace">
              {t as string}
            </text>
          ))}
          <text x={IN_X} y={48} fontSize={11} fill="var(--accent-2)" fontFamily="IBM Plex Sans, sans-serif">
            Australia, as a worked example
          </text>

          {/* the flowing connectors, drawn first so cards sit above them */}
          {rows.map((r) => (
            <path
              key={`f-${r.key}`}
              d={flow(IN_X + IN_W, r.y + IN_H / 2, DIM_X, band(r.dim))}
              fill="none" stroke={`url(#g-${r.dim})`} strokeWidth={2.4} strokeLinecap="round"
            />
          ))}
          {ORDER.map((d) => (
            <path
              key={`o-${d}`}
              d={flow(DIM_X + DIM_W, band(d), OUT_X, centre)}
              fill="none" stroke={`url(#g-${d})`} strokeWidth={3} strokeLinecap="round" opacity={0.9}
            />
          ))}

          {/* five ingredients */}
          {rows.map((r) => {
            const f = INDICATOR_FIELD[r.key];
            const w = INDICATOR_WEIGHT[r.key];
            return (
              <g key={r.key}>
                <rect x={IN_X} y={r.y} width={IN_W} height={IN_H} rx={12}
                  fill="rgba(255,255,255,0.045)" stroke="var(--hair)" />
                <rect x={IN_X} y={r.y} width={3.5} height={IN_H} rx={2} fill={TONE[r.dim]} opacity={0.9} />
                <text x={IN_X + 16} y={r.y + 21} fontSize={12.5} fill="#fff" fontFamily="IBM Plex Sans, sans-serif">
                  {f.label}
                </text>
                <text x={IN_X + 16} y={r.y + 38} fontSize={13} fill={TONE[r.dim]}
                  fontFamily="IBM Plex Mono, monospace" fontWeight={700}>
                  {valueOf(r.key)}
                </text>
                {/* Inflation is the one figure that is not scored as it is
                    published: what counts is its distance from that market's
                    own target. Showing the target here is the difference
                    between a reader following the recipe and guessing at it. */}
                {r.key === "infGap" && (
                  <text x={IN_X + 78} y={r.y + 38} fontSize={10.5} fill="var(--slate)"
                    fontFamily="IBM Plex Mono, monospace">
                    vs {EXAMPLE_TARGET}% target → {Math.abs((EXAMPLE.raw.inflation as number) - EXAMPLE_TARGET).toFixed(2)} away
                  </text>
                )}
                {/* the weight rides on the connector, where it belongs */}
                {w !== 1 && (
                  <text x={IN_X + IN_W + 14} y={r.y + IN_H / 2 - 7} fontSize={10}
                    fill={TONE[r.dim]} fontFamily="IBM Plex Mono, monospace" opacity={0.95}>
                    {(w * 100).toFixed(0)}% of it
                  </text>
                )}
              </g>
            );
          })}

          {/* three dimensions */}
          {ORDER.map((d) => {
            const cy = band(d);
            const h = DIMENSION_INDICATORS[d].length > 1 ? 96 : 72;
            const { parts } = explainDimension(d, EXAMPLE.raw, EXAMPLE.code);
            return (
              <g key={d}>
                <rect x={DIM_X} y={cy - h / 2} width={DIM_W} height={h} rx={14}
                  fill={`${TONE[d]}12`} stroke={TONE[d]} strokeOpacity={0.5} />
                <text x={DIM_X + 18} y={cy - h / 2 + 26} fontSize={15} fontWeight={700} fill="#fff"
                  fontFamily="IBM Plex Sans, sans-serif">
                  {DIMENSION_NAMES[d]}
                </text>
                <text x={DIM_X + 18} y={cy - h / 2 + 45} fontSize={10.5} fill="var(--slate)"
                  fontFamily="IBM Plex Mono, monospace">
                  {parts.map((p) => p.label.toLowerCase()).join(" + ")}
                </text>
                <text x={DIM_X + 18} y={cy - h / 2 + h - 16} fontSize={12} fill={TONE[d]}
                  fontFamily="IBM Plex Mono, monospace" fontWeight={700}>
                  {dimPct[d].toFixed(0)} percentile
                </text>
                <text x={DIM_X + DIM_W - 18} y={cy - h / 2 + h - 16} fontSize={10.5} fill="var(--slate)"
                  fontFamily="IBM Plex Mono, monospace" textAnchor="end">
                  {std[d] >= 0 ? "+" : ""}{std[d].toFixed(2)} sd
                </text>
              </g>
            );
          })}

          {/* the result */}
          <rect x={OUT_X} y={centre - 62} width={OUT_W} height={124} rx={18}
            fill="rgba(139,92,246,0.14)" stroke={FINAL} strokeOpacity={0.65} filter="url(#soft)" />
          <text x={OUT_X + OUT_W / 2} y={centre - 34} fontSize={10.5} fill="var(--slate)"
            textAnchor="middle" fontFamily="IBM Plex Mono, monospace" letterSpacing={0.8}>
            AVERAGE THE THREE
          </text>
          <text x={OUT_X + OUT_W / 2} y={centre + 12} fontSize={42} fontWeight={700} fill={FINAL}
            textAnchor="middle" fontFamily="Space Grotesk, sans-serif">
            {result.percentile?.toFixed(1)}
          </text>
          <text x={OUT_X + OUT_W / 2} y={centre + 34} fontSize={11.5} fill="#fff"
            textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif">
            better than {result.percentile?.toFixed(0)}% of
          </text>
          <text x={OUT_X + OUT_W / 2} y={centre + 50} fontSize={11.5} fill="#fff"
            textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif">
            the last 26 years
          </text>
        </svg>
      </div>

      {/* the same thing in five sentences, for anyone who reads before they look */}
      <ol
        style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(158px, 1fr))",
          gap: 12, listStyle: "none", padding: 0, margin: "18px 0 0",
        }}
      >
        {[
          ["Start with what is published", "Five official figures, each from a named national source — plus each country’s own inflation target."],
          ["Compare with history", `Not "is 4.35% high?" but "where does it sit among ${N} readings from these six economies since 2000?"`],
          ["Group into three", "Prices and jobs. Which way it is moving. What is left in reserve."],
          ["Put the three level", "Each is divided by its own spread, so one cannot shout over the others."],
          ["Rank it", "The average becomes a place in the historical record. That is the score."],
        ].map(([head, body], i) => (
          <li key={head} style={{ border: "1px solid var(--hair)", borderRadius: 12, padding: "12px 14px", background: "rgba(255,255,255,0.025)" }}>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: FINAL, marginBottom: 5 }}>
              {String(i + 1).padStart(2, "0")}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 3 }}>{head}</div>
            <div style={{ fontSize: 12, color: "var(--slate)", lineHeight: 1.5 }}>{body}</div>
          </li>
        ))}
      </ol>

      <figcaption style={{ fontSize: 12, color: "var(--slate)", lineHeight: 1.65, marginTop: 14, maxWidth: "76ch" }}>
        <b style={{ color: "var(--ink-soft)" }}>Step four is the one that is easy to miss.</b> Conditions varies about
        a third less across history than Direction does. Without dividing each by its own spread, averaging them would
        hand Direction the loudest voice whatever the weights said — the difference between a weight on paper and a
        weight in effect.
      </figcaption>
    </figure>
  );
}
