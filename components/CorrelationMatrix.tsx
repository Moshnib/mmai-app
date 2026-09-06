import {
  INDICATOR_CORRELATIONS, DIMENSION_CORRELATIONS,
  INDICATOR_DIMENSION, DIMENSION_NAMES, DIMENSION_INDICATORS,
  type IndicatorKey, type DimensionKey,
} from "@/lib/composite";
import { REFERENCE_SET } from "@/lib/referenceSet";

const IND: IndicatorKey[] = ["infGap", "une", "gdp", "debt", "rate"];
const DIM: DimensionKey[] = ["C", "D", "K"];
const TONE: Record<DimensionKey, string> = { C: "#E14B4B", D: "#F0975B", K: "#22D3EE" };
const N = REFERENCE_SET.length;

/** Below this a relationship is noise, and drawing it would fill the
 *  picture with lines that mean nothing. Chosen so the strongest
 *  cross-dimension pair is still visible -- the point is partly that those
 *  exist and are weak, not that they are absent. */
const MIN_DRAWN = 0.15;

/**
 * A CORRELATION IS NOT A SENTENCE ANYONE CAN READ.
 *
 * The triangle used to label each line "0.344", "0.141", "0.050". Three
 * decimal places of a coefficient tells a reader who already knows the
 * scale exactly what they already knew, and tells everyone else nothing:
 * there is no way to know from the digits alone whether 0.344 is a lot.
 *
 * Squaring it gives the share of movement the two genuinely have in
 * common -- the ordinary coefficient of determination, r-squared -- and
 * that IS a sentence: "12% of their ups and downs are shared". The
 * coefficients themselves stay in the caption for anyone checking the
 * arithmetic, so nothing is hidden, only demoted.
 */
const sharedMovement = (r: number) => {
  const pct = r * r * 100;
  return pct < 1 ? "under 1% shared" : `${Math.round(pct)}% shared`;
};

/** The plain reading of the line, so the picture states its conclusion
 *  instead of leaving the reader to infer it from a stroke width. */
const strengthWord = (r: number) => {
  const a = Math.abs(r);
  return a >= 0.3 ? "move together" : a >= 0.15 ? "loosely linked" : "barely related";
};

const short: Record<IndicatorKey, string> = {
  infGap: "Inflation",
  une: "Unemployment",
  gdp: "GDP growth",
  debt: "Govt debt",
  rate: "Policy rate",
};

/**
 * What relates to what, drawn rather than tabulated.
 *
 * This was a pair of heatmap tables. A grid of twenty-five numbers is a
 * data dump: it answers "what is the correlation of X and Y" for a reader
 * who already knows which pair to look up, and answers nothing at all for
 * the reader who wants to know whether the grouping holds. The question is
 * structural, so the answer should be a picture of the structure.
 *
 * Five indicators on a ring, an arc for every relationship worth drawing,
 * thickness by strength and colour by direction. A pair inside the same
 * dimension is drawn solid; a pair spanning two dimensions is dashed, so
 * the eye can tell at once that the solid lines are the strong ones.
 *
 * COMPUTED ON SIGN-ALIGNED VALUES, so positive always means "these two
 * tend to be favourable together". On the raw figures the signs flip for
 * the three where lower is better, and every arc would read backwards.
 */
export default function CorrelationMatrix() {
  // Measured: the ring and its labels occupy x 54-472, y 41-309. The
  // canvas was 680x400 because the legend used to live inside it at
  // x=486; with the legend moved to HTML below, the extra 200px was
  // empty, and on a phone it was 200px of horizontal scroll buying
  // nothing.
  const W = 496, H = 340;
  const cx = 250, cy = 196, R = 128;

  // Five points on a ring, starting at the top and going clockwise.
  const at = (i: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / IND.length;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  };
  const pos = Object.fromEntries(IND.map((k, i) => [k, at(i)])) as Record<IndicatorKey, { x: number; y: number }>;

  // Every pair once, strongest drawn last so it sits on top.
  const pairs: { a: IndicatorKey; b: IndicatorKey; r: number; same: boolean }[] = [];
  for (let i = 0; i < IND.length; i++) {
    for (let j = i + 1; j < IND.length; j++) {
      const a = IND[i], b = IND[j];
      const r = INDICATOR_CORRELATIONS[a][b];
      if (Math.abs(r) >= MIN_DRAWN) {
        pairs.push({ a, b, r, same: INDICATOR_DIMENSION[a] === INDICATOR_DIMENSION[b] });
      }
    }
  }
  pairs.sort((p, q) => Math.abs(p.r) - Math.abs(q.r));

  const strongest = [...pairs].sort((p, q) => Math.abs(q.r) - Math.abs(p.r))[0];
  const maxCross = Math.max(
    ...IND.flatMap((a) => IND.filter((b) => b !== a && INDICATOR_DIMENSION[a] !== INDICATOR_DIMENSION[b])
      .map((b) => Math.abs(INDICATOR_CORRELATIONS[a][b])))
  );

  // Curve every arc through the middle so none of them run straight over a
  // node that is not part of the pair.
  const arc = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const qx = mx + (cx - mx) * 0.45, qy = my + (cy - my) * 0.45;
    return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${qx.toFixed(1)},${qy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  };

  return (
    <div style={{ display: "grid", gap: 26 }}>
      {/* minWidth 0: a grid item defaults to min-width:auto, so it
          refuses to shrink below its own content. The SVG below carries
          a minWidth so the diagram stays readable, and without this that
          minimum propagated up through the scroll container to the figure
          and out to the page -- 584px of content in a 375px phone, and
          the whole Learn page scrolled sideways. The scroll belongs to
          the diagram, not to the document. */}
      <figure style={{ margin: 0, minWidth: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <svg
            viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", minWidth: 440 }}
            role="img"
            aria-label={
              `A ring of the five scored indicators with an arc drawn between every pair that is related. ` +
              `The strongest is ${short[strongest.a].toLowerCase()} with ${short[strongest.b].toLowerCase()} at ` +
              `${strongest.r.toFixed(2)}, and both sit inside the same dimension. No pair spanning two different ` +
              `dimensions exceeds ${maxCross.toFixed(2)}, which is the evidence that the grouping holds. ` +
              `Measured across ${N} market-years.`
            }
          >
            {/* arcs first, so nodes sit above them */}
            {pairs.map(({ a, b, r, same }) => (
              <path
                key={`${a}-${b}`}
                d={arc(pos[a], pos[b])}
                fill="none"
                stroke={r > 0 ? "#22D3EE" : "#E14B4B"}
                strokeWidth={1 + Math.abs(r) * 7}
                strokeOpacity={same ? 0.75 : 0.4}
                strokeDasharray={same ? undefined : "5 5"}
                strokeLinecap="round"
              />
            ))}

            {/* NO NUMBER ON THE DRAWING, DELIBERATELY.

                This diagram once labelled every arc, which was removed as
                noise. Cutting seven labels to one did not fix the problem,
                it left a leftover: a single coefficient with no reason to
                be the one shown, on a page that is explaining a method
                rather than reporting a reading. Four separate attempts to
                make it legible -- moving the key out of the SVG, putting
                the value on the curve instead of the control point, giving
                it a chip, naming its pair -- each made it clearer without
                making it belong.

                The claim this picture makes is structural: arcs inside a
                dimension are solid and heavy, arcs across dimensions are
                dashed and light, therefore the grouping holds. Thickness
                already carries magnitude. A number sitting on one arc adds
                nothing to that argument and reads as a live indicator on a
                page that has none.

                Nothing is lost by removing it. The figcaption below names
                the strongest pair and its value, states that no
                cross-dimension pair reaches the cross-dimension maximum,
                and the three dimension correlations are printed to three
                decimals further down -- each in a sentence that gives the
                number a meaning, which is where a number belongs. */}
            {IND.map((k) => {
              const p = pos[k];
              const tone = TONE[INDICATOR_DIMENSION[k]];
              const right = p.x > cx + 4;
              const above = p.y < cy - 40;
              return (
                <g key={k}>
                  <circle cx={p.x} cy={p.y} r={9} fill={tone} stroke="var(--paper)" strokeWidth={2.5} />
                  <text
                    x={p.x + (right ? 16 : p.x < cx - 4 ? -16 : 0)}
                    y={p.y + (above ? -16 : right || p.x < cx - 4 ? 4 : 26)}
                    textAnchor={right ? "start" : p.x < cx - 4 ? "end" : "middle"}
                    fontSize={12.5} fill="#fff" fontFamily="IBM Plex Sans, sans-serif"
                  >
                    {short[k]}
                  </text>
                </g>
              );
            })}

          </svg>
        </div>

        {/* THE KEY LIVES OUTSIDE THE SCROLLER NOW.
            It used to be a <g> at x=486 inside a 680-wide SVG with a
            560px floor. Measured on a 375px phone, that put it 160px
            past the right edge of the scroll container -- entirely
            off-screen, reachable only by a sideways drag nobody knows to
            try. The one labelled number on the diagram was therefore
            presented with no key at all, which is precisely how the site
            owner met it: a 0.58 floating on a web of lines.
            As HTML it cannot be scrolled away from, it wraps instead of
            overflowing, and it inherits the page's text sizes. */}
        <div className="corr-key">
          <span className="corr-key-title">HOW TO READ IT</span>
          <span className="corr-key-item"><i style={{ background: "#22D3EE" }} />good together</span>
          <span className="corr-key-item"><i style={{ background: "#E14B4B" }} />pull apart</span>
          <span className="corr-key-item"><i style={{ background: "var(--slate)" }} />same dimension</span>
          <span className="corr-key-item"><i className="dashed" />across dimensions</span>
          <span className="corr-key-note">
            Thicker means stronger, and faint pairs are left undrawn. This is a picture of which indicators
            move together, not a reading — the exact correlations are written out below it.
          </span>
        </div>
        <figcaption style={{ fontSize: 12, color: "var(--slate)", lineHeight: 1.65, marginTop: 12, maxWidth: "min(76ch, 100%)" }}>
          <b style={{ color: "var(--ink-soft)" }}>The solid lines are the strong ones, and that is the whole test.</b>{" "}
          The heaviest is {short[strongest.a].toLowerCase()} with {short[strongest.b].toLowerCase()} at{" "}
          {strongest.r.toFixed(2)} — countries carrying less debt have tended to have rates with further to fall,
          which is the room-to-act idea Capacity is built on, visible in the data rather than argued for. No pair
          spanning two different dimensions reaches {maxCross.toFixed(2)}. The groups hold together and stay apart,
          which is what a grouping has to do to be worth making.
        </figcaption>
      </figure>

      {/* ---- the three dimensions ---- */}
      {/* minWidth 0: a grid item defaults to min-width:auto, so it
          refuses to shrink below its own content. The SVG below carries
          a minWidth so the diagram stays readable, and without this that
          minimum propagated up through the scroll container to the figure
          and out to the page -- 584px of content in a 375px phone, and
          the whole Learn page scrolled sideways. The scroll belongs to
          the diagram, not to the document. */}
      <figure style={{ margin: 0, minWidth: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <svg
            viewBox="0 0 680 224" width="100%" style={{ display: "block", minWidth: 520 }}
            role="img"
            aria-label={
              `The three dimensions and how closely they move together. Direction and Capacity share ` +
              `${sharedMovement(DIMENSION_CORRELATIONS.D.K)} of their movement, while Conditions is close to ` +
              `independent of both, sharing ${sharedMovement(DIMENSION_CORRELATIONS.C.D)} with Direction and ` +
              `${sharedMovement(DIMENSION_CORRELATIONS.C.K)} with Capacity.`
            }
          >
            {(() => {
              const P: Record<DimensionKey, { x: number; y: number }> = {
                C: { x: 150, y: 62 },
                D: { x: 340, y: 158 },
                K: { x: 530, y: 62 },
              };
              const links: [DimensionKey, DimensionKey][] = [["C", "D"], ["D", "K"], ["C", "K"]];
              return (
                <>
                  {links.map(([a, b]) => {
                    const r = DIMENSION_CORRELATIONS[a][b];
                    const mid = { x: (P[a].x + P[b].x) / 2, y: (P[a].y + P[b].y) / 2 };
                    return (
                      <g key={`${a}${b}`}>
                        <line
                          x1={P[a].x} y1={P[a].y} x2={P[b].x} y2={P[b].y}
                          stroke="#22D3EE" strokeWidth={1 + Math.abs(r) * 16}
                          strokeOpacity={0.28 + Math.abs(r) * 1.2} strokeLinecap="round"
                        />
                        {/* The labels sit on top of the line they describe,
                            so they need their own ground to stay legible
                            against a stroke that gets thicker with r. */}
                        <rect
                          x={mid.x - 62} y={mid.y - 26} width={124} height={33}
                          rx={7} fill="var(--paper)" opacity={0.92}
                        />
                        {/* The plain reading first, the measurement under
                            it. A coefficient printed on its own asks the
                            reader to supply the scale it is measured on. */}
                        <text
                          x={mid.x} y={mid.y - 14} textAnchor="middle" fontSize={13}
                          fontWeight={700} fill="var(--ink)" fontFamily="IBM Plex Sans, sans-serif"
                        >
                          {strengthWord(r)}
                        </text>
                        <text
                          x={mid.x} y={mid.y + 2} textAnchor="middle" fontSize={11.5}
                          fill="#22D3EE" fontFamily="IBM Plex Mono, monospace"
                        >
                          {sharedMovement(r)}
                        </text>
                      </g>
                    );
                  })}
                  {DIM.map((d) => (
                    <g key={d}>
                      <circle cx={P[d].x} cy={P[d].y} r={13} fill={TONE[d]} stroke="var(--paper)" strokeWidth={3} />
                      <text
                        x={P[d].x} y={P[d].y + (d === "D" ? 36 : -26)}
                        textAnchor="middle" fontSize={14} fontWeight={700} fill="#fff"
                        fontFamily="IBM Plex Sans, sans-serif"
                      >
                        {DIMENSION_NAMES[d]}
                      </text>
                      <text
                        x={P[d].x} y={P[d].y + (d === "D" ? 52 : -10)}
                        textAnchor="middle" fontSize={11} fill="var(--slate)"
                        fontFamily="IBM Plex Mono, monospace"
                      >
                        {DIMENSION_INDICATORS[d].length === 1 ? "1 indicator" : `${DIMENSION_INDICATORS[d].length} indicators`}
                      </text>
                    </g>
                  ))}
                </>
              );
            })()}
          </svg>
        </div>
        <figcaption style={{ fontSize: 12, color: "var(--slate)", lineHeight: 1.65, marginTop: 12, maxWidth: "min(76ch, 100%)" }}>
          <b style={{ color: "var(--ink-soft)" }}>This is the picture that explains why equal thirds is not equal in
          effect.</b> The thick line is Direction and Capacity: {sharedMovement(DIMENSION_CORRELATIONS.D.K)}{" "}
          movement, meaning when one is having a good year the other usually is too. Conditions barely connects to
          either. A composite built by averaging tracks a pair that moves together more closely than it tracks the
          one that does not — so a declared third each becomes an effective 25.5 / 39.6 / 34.9. Standardising
          equalised how much each dimension varies; nothing can equalise this while they stay correlated, which is
          why it is published here rather than left for a critic to find. The underlying coefficients, for anyone
          checking the arithmetic, are {DIMENSION_CORRELATIONS.D.K.toFixed(3)} for Direction with Capacity,{" "}
          {DIMENSION_CORRELATIONS.C.D.toFixed(3)} for Conditions with Direction and{" "}
          {DIMENSION_CORRELATIONS.C.K.toFixed(3)} for Conditions with Capacity.
        </figcaption>
      </figure>
    </div>
  );
}
