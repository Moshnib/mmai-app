import {
  INDICATOR_CORRELATIONS, DIMENSION_CORRELATIONS, INDICATOR_FIELD,
  INDICATOR_DIMENSION, DIMENSION_NAMES, DIMENSION_INDICATORS,
  type IndicatorKey, type DimensionKey,
} from "@/lib/composite";
import { REFERENCE_SET } from "@/lib/referenceSet";

const IND: IndicatorKey[] = ["infGap", "une", "gdp", "debt", "rate"];
const DIM: DimensionKey[] = ["C", "D", "K"];
const N = REFERENCE_SET.length;

/** Cyan for "these move together", red for "these move against each other",
 *  neutral in between. Never green -- the site's palette excludes it so a
 *  colour can never be mistaken for a pass/fail verdict. */
function cell(r: number): { bg: string; fg: string } {
  const a = Math.min(1, Math.abs(r));
  if (a < 0.08) return { bg: "rgba(255,255,255,0.04)", fg: "var(--slate)" };
  const hue = r > 0 ? "34,211,238" : "225,75,75";
  return { bg: `rgba(${hue},${(0.10 + a * 0.55).toFixed(2)})`, fg: a > 0.45 ? "#fff" : "var(--ink-soft)" };
}

const short: Record<IndicatorKey, string> = {
  infGap: "Inflation",
  une: "Unemploy.",
  gdp: "Growth",
  debt: "Debt",
  rate: "Rate",
};

/**
 * How the five indicators actually relate to one another, and then the
 * three dimensions.
 *
 * WHY IT IS HERE. An index that groups five numbers into three buckets is
 * making a claim -- that the things in a bucket belong together and the
 * buckets are measuring different things. Until now the site asserted that
 * grouping and never showed whether the data supported it. This is the
 * evidence, and it is not uniformly flattering.
 *
 * COMPUTED ON THE SIGN-ALIGNED VALUES, so positive always means "these two
 * tend to be good together". On the raw figures the signs would flip for
 * the three where lower is better and the whole matrix would read
 * backwards -- a table that looks authoritative and says the opposite of
 * the truth is worse than no table.
 */
export default function CorrelationMatrix() {
  return (
    <div style={{ display: "grid", gap: 22 }}>
      {/* ---- the five indicators ---- */}
      <div>
        <div className="meta-label" style={{ marginBottom: 8 }}>
          The five indicators, against each other
        </div>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              borderCollapse: "separate", borderSpacing: 3, fontSize: 11.5,
              fontFamily: "IBM Plex Mono, monospace", minWidth: 460,
            }}
          >
            <caption className="sr-only">
              Correlation between each pair of the five scored indicators across {N} market-years, on
              sign-aligned values so a positive figure means the two tend to be favourable together.
            </caption>
            <thead>
              <tr>
                <th />
                {IND.map((k) => (
                  <th key={k} scope="col" style={{ fontWeight: 500, color: "var(--slate)", padding: "0 4px", textAlign: "center" }}>
                    {short[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {IND.map((a) => (
                <tr key={a}>
                  <th scope="row" style={{ fontWeight: 500, color: "var(--ink-soft)", textAlign: "right", paddingRight: 8, whiteSpace: "nowrap" }}>
                    {INDICATOR_FIELD[a].label}
                  </th>
                  {IND.map((b) => {
                    const r = INDICATOR_CORRELATIONS[a][b];
                    const same = a !== b && INDICATOR_DIMENSION[a] === INDICATOR_DIMENSION[b];
                    const c = cell(a === b ? 0 : r);
                    return (
                      <td
                        key={b}
                        title={
                          a === b
                            ? "An indicator against itself."
                            : same
                              ? `${INDICATOR_FIELD[a].label} and ${INDICATOR_FIELD[b].label} are both inside ${DIMENSION_NAMES[INDICATOR_DIMENSION[a]]}, so a relationship here is expected.`
                              : `${INDICATOR_FIELD[a].label} and ${INDICATOR_FIELD[b].label} sit in different dimensions.`
                        }
                        style={{
                          background: a === b ? "rgba(255,255,255,0.07)" : c.bg,
                          color: a === b ? "var(--slate)" : c.fg,
                          padding: "8px 10px", textAlign: "center", borderRadius: 6,
                          minWidth: 60, fontVariantNumeric: "tabular-nums",
                          outline: same ? "1px dashed rgba(255,255,255,0.35)" : undefined,
                        }}
                      >
                        {a === b ? "—" : r.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: "var(--slate)", lineHeight: 1.65, margin: "10px 0 0", maxWidth: "74ch" }}>
          <span style={{ outline: "1px dashed rgba(255,255,255,0.35)", padding: "1px 5px", borderRadius: 4 }}>Dashed</span>{" "}
          pairs sit inside the same dimension, where a relationship is expected and is part of why they were grouped.
          The strongest is <b style={{ color: "var(--ink-soft)" }}>government debt and the policy rate at{" "}
          {INDICATOR_CORRELATIONS.debt.rate.toFixed(2)}</b> — countries carrying less debt have tended to have rates
          with further to fall, which is exactly the room-to-act idea Capacity is built on. Everything outside a dashed
          box is a pair the index treats as measuring different things, and none of those exceeds{" "}
          {Math.max(...IND.flatMap((a) => IND.filter((b) => INDICATOR_DIMENSION[a] !== INDICATOR_DIMENSION[b]).map((b) => Math.abs(INDICATOR_CORRELATIONS[a][b])))).toFixed(2)}.
        </p>
      </div>

      {/* ---- the three dimensions ---- */}
      <div>
        <div className="meta-label" style={{ marginBottom: 8 }}>
          The three dimensions, against each other
        </div>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              borderCollapse: "separate", borderSpacing: 3, fontSize: 12,
              fontFamily: "IBM Plex Mono, monospace", minWidth: 380,
            }}
          >
            <caption className="sr-only">
              Correlation between each pair of the three dimensions across {N} market-years.
            </caption>
            <thead>
              <tr>
                <th />
                {DIM.map((d) => (
                  <th key={d} scope="col" style={{ fontWeight: 500, color: "var(--slate)", padding: "0 6px" }}>
                    {DIMENSION_NAMES[d]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DIM.map((a) => (
                <tr key={a}>
                  <th scope="row" style={{ fontWeight: 500, color: "var(--ink-soft)", textAlign: "right", paddingRight: 8, whiteSpace: "nowrap" }}>
                    {DIMENSION_NAMES[a]}
                    <span style={{ color: "var(--slate)", fontSize: 10, marginLeft: 6 }}>
                      {DIMENSION_INDICATORS[a].length === 1 ? "1 indicator" : `${DIMENSION_INDICATORS[a].length} indicators`}
                    </span>
                  </th>
                  {DIM.map((b) => {
                    const r = DIMENSION_CORRELATIONS[a][b];
                    const c = cell(a === b ? 0 : r);
                    return (
                      <td
                        key={b}
                        style={{
                          background: a === b ? "rgba(255,255,255,0.07)" : c.bg,
                          color: a === b ? "var(--slate)" : c.fg,
                          padding: "10px 14px", textAlign: "center", borderRadius: 6,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {a === b ? "—" : r.toFixed(3)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: "var(--slate)", lineHeight: 1.65, margin: "10px 0 0", maxWidth: "74ch" }}>
          <b style={{ color: "var(--ink-soft)" }}>This is the table that explains why equal thirds is not equal in
          effect.</b> Direction and Capacity move together at{" "}
          {DIMENSION_CORRELATIONS.D.K.toFixed(3)}, while Conditions is close to independent of both
          ({DIMENSION_CORRELATIONS.C.D.toFixed(3)} and {DIMENSION_CORRELATIONS.C.K.toFixed(3)}). A composite built by
          averaging tracks a pair that moves together more closely than it tracks the one that does not — so the
          declared third each becomes an effective 25.5 / 39.6 / 34.9. Standardising the dimensions equalised how much
          each varies. Nothing can equalise this while they remain correlated, which is why it is published rather than
          left for a reader to discover.
        </p>
      </div>
    </div>
  );
}
