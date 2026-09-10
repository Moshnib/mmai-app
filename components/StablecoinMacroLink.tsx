import type { MacroLink } from "@/lib/stablecoinMacro";
import { SIGNIFICANCE_T } from "@/lib/stablecoinMacro";

const pct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(0)}%`;
const bn = (n: number) => `$${(n / 1e9).toFixed(0)}B`;
const monthYear = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

/**
 * WHAT THIS NUMBER HAS TO DO WITH THE MACRO ECONOMY — measured, and the
 * answer published either way.
 *
 * The page carried a total, three chain cards and a supply line, none of
 * which connected to anything the rest of MMAI measures. The hero copy
 * calls the total "a read on demand for dollars outside the banking
 * system", which IMPLIES a macro relationship without ever testing one.
 *
 * So this tests it, against the longest macro series the project holds
 * over the same window — the US 10-year yield, from the same
 * bond_yields table the rest of the site uses — and prints the result
 * whichever way it comes out. Today it comes out null, and saying so is
 * more useful to a reader than the implication was: whatever moves
 * stablecoin supply, it is not the US rate cycle.
 *
 * Nothing here is written down. The verdict, the numbers and the
 * significance all come from the measurement, so a relationship that
 * appears later will appear on the page by itself.
 */
export default function StablecoinMacroLink({ link }: { link: MacroLink | null }) {
  if (!link) {
    // "Not enough overlap to measure" and "measured, found nothing" are
    // different claims and must never render as the same sentence.
    return (
      <div className="mmai-card" style={{ marginTop: 12 }}>
        <div className="meta-label">Against the macro cycle</div>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "8px 0 0", lineHeight: 1.7 }}>
          There is not yet enough overlapping history to test this against the US 10-year yield. That is a
          missing measurement, not a finding.
        </p>
      </div>
    );
  }

  const supplyChange = (link.supplyEnd / link.supplyStart - 1) * 100;
  const strongest = [...link.lags, link.level].reduce((a, b) => (Math.abs(b.t) > Math.abs(a.t) ? b : a));

  return (
    <div className="mmai-card" style={{ marginTop: 12 }}>
      <div className="meta-label">Against the macro cycle</div>

      <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, margin: "8px 0 10px", color: "var(--ink)" }}>
        {link.anySignificant
          ? "This does move with US interest rates"
          : "This does not move with US interest rates"}
      </h3>

      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 14px", lineHeight: 1.7, maxWidth: "72ch" }}>
        Between {monthYear(link.firstDate)} and {monthYear(link.lastDate)} the supply above went from{" "}
        <b style={{ color: "var(--ink)" }}>{bn(link.supplyStart)}</b> to{" "}
        <b style={{ color: "var(--ink)" }}>{bn(link.supplyEnd)}</b> ({pct(supplyChange)}), while the US 10-year
        yield went from <b style={{ color: "var(--ink)" }}>{link.yieldStart.toFixed(2)}%</b> to{" "}
        <b style={{ color: "var(--ink)" }}>{link.yieldEnd.toFixed(2)}%</b>. Month-on-month growth was tested
        against the yield at every lag from none to three months, and against the level of the yield itself.
        {link.anySignificant
          ? " At least one of those clears the usual significance bar — the table below says which."
          : " None of them clears the usual significance bar."}
      </p>

      {/* The working, because the site's whole claim is that you can
          check it. A verdict without the numbers under it is an opinion. */}
      {/* ITS OWN CLASS, NOT .breakdown-row.
          This borrowed the dimension arithmetic's row, which stacks to a
          single column below 640px. That works there: a label and a few
          values that read as a sentence. Here it destroyed the table —
          the header became four orphaned words down the page and every
          row four orphaned numbers, with nothing tying a value to its
          column. Reported from a phone as a broken page, and it was.
          A four-column table keeps its four columns and scrolls if it
          must. */}
      <div className="corr-table">
      <div className="corr-table-row corr-table-head">
        <span>Test</span><span>r</span><span>t</span><span>reading</span>
      </div>
      {link.lags.map((l) => (
        <div key={`lag-${l.lagMonths}`} className="corr-table-row">
          <span>{l.lagMonths === 0 ? "Same month" : `Yield leads by ${l.lagMonths}mo`}</span>
          <span>{l.r.toFixed(3)}</span>
          <span>{l.t.toFixed(2)}</span>
          <span style={{ color: l.significant ? "var(--accent)" : "var(--slate)" }}>
            {l.significant ? "significant" : "no signal"}
          </span>
        </div>
      ))}
      <div className="corr-table-row">
        <span>Growth vs yield level</span>
        <span>{link.level.r.toFixed(3)}</span>
        <span>{link.level.t.toFixed(2)}</span>
        <span style={{ color: link.level.significant ? "var(--accent)" : "var(--slate)" }}>
          {link.level.significant ? "significant" : "no signal"}
        </span>
      </div>
      </div>

      <p style={{ fontSize: 12, color: "var(--slate)", margin: "14px 0 0", lineHeight: 1.7, maxWidth: "72ch" }}>
        {/* The limit of the test, stated with it. A null result from a
            small sample is not proof of no relationship, and a reader who
            is not told the sample size cannot judge that for themselves. */}
        r is correlation, from −1 to +1; t above about {SIGNIFICANCE_T} is the usual bar for calling a
        relationship real. The strongest of these is {strongest.r.toFixed(3)}, at t = {strongest.t.toFixed(2)}.
        This rests on {link.months} monthly observations, which is enough to detect a strong relationship and not
        enough to rule out a weak one — so this says the rate cycle does not explain the supply, not that nothing
        does. Ethereum only, for the reason given above the chart.
      </p>
    </div>
  );
}
