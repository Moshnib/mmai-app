import { fetchGovernmentDebt } from "@/lib/fetchers/bis";
import { FALLBACK_MARKETS } from "@/lib/markets";
import Flag from "@/components/Flag";

// ============================================================
// Government debt as a share of GDP, six markets side by side.
//
// A SERVER component, read live from BIS and cached by the page's
// revalidate window. No database table: this is ONE call to ONE
// international institution that publishes QUARTERLY, so the argument
// that justified storing bond yields (six government websites, daily,
// history irrecoverable if a source dies) is far weaker here. Storing
// it would have cost a schema change for a figure that moves four times
// a year.
//
// NOT part of the MMAI score. Adding it would be a methodology change,
// and a genuinely difficult one -- see the note rendered at the foot of
// this component about Japan.
// ============================================================

export const revalidate = 21600; // six hours; the source updates quarterly

const MARKET_NAMES = Object.fromEntries(FALLBACK_MARKETS.map((m) => [m.code, m.name]));

/** Bar colour by debt level. Deliberately NOT the score gradient: this
 *  is not a 0-100 score and must not look like one. A single hue at
 *  varying strength reads as "more/less", not "good/bad" -- which is
 *  the honest signal, since whether a given debt level is dangerous
 *  depends on who owes it and in what currency. */
function barColor(pct: number): string {
  if (pct >= 150) return "rgba(139, 92, 246, 0.95)";
  if (pct >= 100) return "rgba(139, 92, 246, 0.75)";
  if (pct >= 70) return "rgba(139, 92, 246, 0.55)";
  return "rgba(139, 92, 246, 0.38)";
}

export default async function GovernmentDebtRow() {
  let rows: Array<{ market: string; debtPctGdp: number; period: string }> = [];
  try {
    rows = await fetchGovernmentDebt();
  } catch {
    // Silent: this is a supplementary indicator, and a BIS outage should
    // not put an error block on a page whose main content is fine.
    return null;
  }
  if (rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => b.debtPctGdp - a.debtPctGdp);
  const max = sorted[0].debtPctGdp;
  const period = sorted[0].period;

  return (
    <div className="section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="section-head" style={{ marginBottom: 16 }}>
          <p className="eyebrow">4. GOVERNMENT DEBT</p>
          <h2>What each government owes, against the size of its economy</h2>
          <p>
            Debt is easier to carry when the economy behind it is larger, so it is shown as a share of GDP rather
            than in currency. Quarterly, and not part of the MMAI score.
          </p>
        </div>

        <div className="chart-card">
          <div className="chart-card-label">
            <span>Credit to general government, % of GDP</span>
            <span
              className="meta-label"
              style={{ marginLeft: "auto", border: "1px solid var(--hair)", borderRadius: 999, padding: "3px 9px" }}
            >
              {period}
            </span>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
            {sorted.map((d) => (
              <div
                key={d.market}
                style={{ display: "grid", gridTemplateColumns: "minmax(120px, 150px) 1fr auto", gap: 12, alignItems: "center" }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-soft)" }}>
                  <Flag code={d.market} size={17} />
                  {MARKET_NAMES[d.market] ?? d.market}
                </span>
                {/* Bar width is relative to the highest market, not to
                    100% -- Japan is well above 100 and a 100-anchored
                    bar would clip it. */}
                <span style={{ height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${(d.debtPctGdp / max) * 100}%`,
                      background: barColor(d.debtPctGdp),
                      borderRadius: 999,
                    }}
                  />
                </span>
                <b
                  style={{
                    fontFamily: "Space Grotesk, sans-serif",
                    fontSize: 15,
                    color: "#fff",
                    fontVariantNumeric: "tabular-nums",
                    minWidth: 62,
                    textAlign: "right",
                  }}
                >
                  {d.debtPctGdp.toFixed(1)}%
                </b>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: "var(--slate)", margin: "16px 0 0", paddingTop: 12, borderTop: "1px dashed var(--hair)", lineHeight: 1.7 }}>
            <b style={{ color: "var(--ink-soft)" }}>A high number is not automatically a bad one.</b> Japan owes the
            most here by a wide margin and borrows at some of the lowest interest rates in the world, because it owes
            almost all of it in its own currency to its own savers. What matters is who the lender is and what the
            debt costs to service — which is why this figure sits beside the MMAI score rather than inside it.
          </p>
          <p style={{ fontSize: 12, color: "var(--slate)", margin: "8px 0 0", lineHeight: 1.7 }}>
            Source: Bank for International Settlements, credit to general government from all sectors at market
            value, adjusted for breaks. BIS publishes no equivalent series for the Gulf states.
          </p>
        </div>
      </div>
    </div>
  );
}
