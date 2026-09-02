import type { Metadata } from "next";
import {
  PILLAR_NAMES,
  formatWeightPct,
  formatInfluencePct,
  PILLAR_INFLUENCE_MEASURED,
  INFLATION_TARGET,
  NEUTRAL_RATE,
  type PillarKey,
} from "@/lib/scoring";
import { FALLBACK_MARKETS } from "@/lib/markets";
import { formulaLine } from "@/lib/publishedFormulas";

// Rendered FROM INFLATION_TARGET rather than typed out as prose.
//
// On 2026-08-31 Australia's target moved to 2.5% and this page still read
// "|inflation - 2%|" for every market, which silently broke the promise at
// the bottom of this page that a reader can reproduce any published score
// by hand. A formula written out by hand WILL drift from the engine; one
// generated from the engine cannot.
const TARGET_LIST = FALLBACK_MARKETS
  .map((m) => `${m.name} ${INFLATION_TARGET[m.code] ?? 2}%`)
  .join("  ·  ");

// Same discipline as TARGET_LIST: rendered FROM the engine, so the
// published neutral rate cannot drift from the one that scores.
const NEUTRAL_LIST = FALLBACK_MARKETS
  .map((m) => `${m.name} ${NEUTRAL_RATE[m.code] ?? 2.5}%`)
  .join("  ·  ");

export const metadata: Metadata = {
  title: "Learn More",
  description:
    "Inflation, GDP growth, unemployment, policy rates, and government debt — plus Gulf Watch's cost-of-living, investment-confidence, and currency-stability figures — what each one actually means for you, in plain language.",
};

const ORDER: PillarKey[] = ["PS", "GM", "LM", "MC", "FR"];

const TOPICS = [
  {
    id: "cpi",
    title: "Inflation & CPI — the price of everything you buy",
    def: "The Consumer Price Index (CPI) tracks the price of a representative basket of everyday goods and services. Inflation is how fast that basket's total cost is rising year over year.",
    formula: formulaLine("PS"),
    targets: TARGET_LIST,
    targetNote:
      "The target is each central bank's own published objective, not one number applied to everyone. Five of the six aim at 2%. Australia is the exception: the Reserve Bank targets a 2–3% range and sets policy so inflation returns to the midpoint, so MMAI scores Australia against 2.5%. The United States is measured on the PCE price index rather than CPI, because that is the index the Federal Reserve defines its 2% target on.",
    impact: "When CPI rises faster than your income, your money buys less. This is why inflation directly shapes wage negotiations and why central banks raise interest rates specifically to slow it down.",
  },
  {
    id: "gdp",
    title: "GDP Growth — is the economy actually expanding?",
    def: "Gross Domestic Product (GDP) is the total value of everything a country produces. GDP growth measures whether that total is expanding or shrinking.",
    formula: formulaLine("GM"),
    impact: "When growth is strong, businesses hire more and wages tend to rise. When it shrinks for two consecutive quarters, that's a recession.",
  },
  {
    id: "unemployment",
    title: "Unemployment Rate — how easy is it to find or keep work?",
    def: "The share of people actively looking for work who can't find it, as a percentage of the labour force.",
    formula: formulaLine("LM"),
    impact: "Low unemployment means workers have leverage — more job offers, easier to negotiate a raise. High unemployment flips that.",
  },
  {
    id: "rate",
    title: "Policy Interest Rate — the cost of borrowing money",
    def: "The benchmark rate set by a central bank. It ripples out to set the tone for every other interest rate in the economy.",
    formula: formulaLine("MC"),
    targets: NEUTRAL_LIST,
    targetNote:
      "The neutral rate is the interest rate that neither speeds up nor slows down an economy, and it differs by country. Until 1 September 2026 MMAI used a single 2.5% for all six, which was the least defensible number in the method. Each market now uses a published estimate: the New York Federal Reserve for the US, Canada and the euro area; the Bank of Japan for Japan; the Bank of England for the UK. Australia is the weakest of the six -- its figure comes from a 2017 Reserve Bank study, because the RBA publishes its current estimates in charts rather than text.",
    impact: "This number sets the floor for mortgage rates, car loans, and credit card APRs — when it rises, borrowing gets more expensive.",
  },
  {
    id: "debt",
    title: "Government Debt — how much room a country has left",
    def: "What a government owes, measured against the size of its economy. A country with low debt can borrow to cushion a recession; a country with high debt has less room to act and spends more of its budget on interest instead of services.",
    formula: formulaLine("FR"),
    targetNote:
      "The 60% mark is not our invention: it is the reference value written into the European Union's treaties, which is why it already applies to the euro area. It is a reference point, not a danger line — no such universal line exists. Debt at or below 60% scores full marks, and the penalty above it is deliberately gentle. Japan is the clearest reason why: its debt is the highest of the six by a wide margin, but it is owed almost entirely to its own citizens, in its own currency, at near-zero interest rates. That is a genuinely different situation from the same number elsewhere, and a harsh penalty would pretend otherwise.",
    impact: "High government debt tends to show up in your life slowly — as higher taxes, tighter public spending, or less help from the state when the next downturn arrives.",
  },
  {
    id: "oil",
    title: "Brent Crude Oil — shown, but no longer scored",
    def: "The global benchmark oil price. Even if you never buy gasoline directly, oil is embedded in shipping, manufacturing, and heating costs.",
    targetNote:
      "Oil used to be MMAI's fifth pillar and stopped being one on 1 September 2026. The reason is simple: there is only one oil price in the world, so every country received exactly the same score for it. It moved all six scores up and down together and could never make one country look better or worse than another — while taking 12.5% of the weight. Government debt replaced it because every country has its own. Oil is still shown in the weekly feed, where a single global price is exactly what it claims to be.",
    impact: "Oil spikes show up weeks later as higher prices at the pump, higher heating bills, and higher shipping costs baked into everything you buy.",
  },
  {
    id: "mmai",
    title: "How MMAI Combines All of This Into One Score",
    def: "Each indicator becomes a 0–100 pillar score, capped to that range. MMAI combines them using fixed weights — the same formula for every market, every time. If a market is missing an indicator, that pillar drops out and the remaining weights are rescaled to still total 100% (that's the \"÷ Σ active weights\" part). Below 70% coverage — fewer than 4 of the 5 pillars — no score is published at all.",
    formula: "MMAI = (Σ weight × pillar score) ÷ (Σ active weights)",
    // Weights are read from PILLAR_WEIGHTS rather than typed as a string, so
    // the published numbers can never drift out of sync with the engine.
    weights: ORDER.map((k) => `${PILLAR_NAMES[k]} ${formatWeightPct(k)}`).join("  ·  "),
    // What those weights actually DO, measured rather than asserted, by
    // scripts/measure-pillar-influence.ts -- which runs in CI and fails if
    // these published figures drift from the panel.
    influence: ORDER.map((k) => `${PILLAR_NAMES[k]} ${formatInfluencePct(k)}`).join("  ·  "),
    influenceNote:
      `A pillar's real influence is its weight multiplied by how much it actually moves. Measured across all six markets since 2019 (as of ${PILLAR_INFLUENCE_MEASURED}), Monetary Conditions is weighted 18.75% but does 11% of the work, because policy rates change only a few times a year. Fiscal Resilience is weighted 12.5% and does 9%, because government debt moves slowly.`,
    ecNote:
      "A caveat worth knowing when comparing countries, and it has changed. Until 1 September 2026 the fifth pillar was the global oil price, which gave every country an identical score and so could not separate them at all. It is now each country's own government debt, which does. But the same question is worth asking of every pillar, so here is the honest answer for the current six: unemployment separates the countries most, then debt, then inflation. Growth separates them least — it carries the joint-largest weight, 25%, and on today's readings the six are close enough on growth that it does little to distinguish them. That will change when the cycle diverges, but it is true right now and you should know it.",
    // Audit findings H-1, H-2 and M-1. Stated on the page a reader
    // actually reads, not only in an internal document.
    limitations: [
      {
        head: "A strong pillar can hide a weak one",
        body:
          "MMAI averages its five pillars, so a very low score in one can be offset by high scores in the others. In 2013 the Euro Area's Labour Market pillar fell to zero — unemployment above 12% — and the composite still read 59.9, \"Balanced\". Where that is happening now, the site says so beside the score. It is a property of averaging, disclosed rather than hidden.",
      },
      {
        head: "Australia's neutral rate is nine years old",
        body:
          "Every market is now measured against a neutral interest rate published for its own economy, which was not true before 1 September 2026 — until then a single 2.5% was applied to all six. Five of the six figures are current. Australia's is not: it derives from a 2017 Reserve Bank study, because the RBA publishes its current estimates in charts rather than in text. Neutral rates have generally risen since 2017, so Australia's is more likely too low than too high — which makes Australia look further from neutral than it probably is, scoring it conservatively rather than flatteringly.",
      },
      {
        head: "The five pillars are less independent than they look",
        body:
          "MMAI's pillars correlate weakly with each other, which is usually read as evidence they measure different things. Part of that is a measurement choice: Growth is a rate of change while Labour is a level, and the well-established relationship between them only appears when both are expressed the same way. The pillars are distinct, but less so than the raw correlations suggest.",
      },
      {
        head: "Full employment is treated as the same number everywhere",
        body:
          "The Labour Market pillar scores unemployment against a single 2% benchmark for all six markets. Economies differ in what full employment actually means for them -- Japan and the euro area do not plausibly share one -- so a country with structurally higher unemployment scores lower for reasons that are not about current conditions. Using each country own estimate would be more accurate, but those estimates are themselves uncertain and revised often, which would trade one problem for another.",
      },
      {
        head: "Inflation above and below target are treated the same",
        body:
          "MMAI subtracts the same number of points whether inflation is one point above target or one point below. Central banks do not see it that way: the US framework is explicitly asymmetric, and when interest rates are near zero, inflation falling too low is harder to fix than inflation running slightly high. MMAI also penalises a large miss in a straight line, where the economic literature generally treats big misses as disproportionately worse than small ones.",
      },
      {
        head: "It measures conditions, it does not forecast",
        body:
          "Every figure describes what has already been published by an official source. MMAI contains no prediction, no model and no view about what happens next.",
      },
    ],
    impact: "You can take the raw numbers for any market, run them through the formulas shown here, and get the exact score shown on the Overview page — no hidden adjustments. \"Supportive\" and \"Challenging\" describe conditions for an average household and business in that economy — manageable inflation, available jobs, reasonable borrowing costs — not investment returns, and not a government's policy performance. MMAI is not investment advice.",
  },
];

const GULF_TOPICS = [
  {
    id: "gulf-cost-of-living",
    title: "Cost of Living — inflation across the Gulf",
    def: "The same measure used everywhere else on MMAI: year-over-year change in the price of a representative basket of everyday goods and services, tracked separately for UAE, Bahrain, Qatar, Saudi Arabia, Kuwait, and Oman.",
    impact: "A rising CPI in a Gulf market squeezes salaries, expat remittances, and local business costs the same way it does anywhere else — even though most of these currencies are pegged to the US dollar and largely import their monetary policy from the US Federal Reserve rather than setting it independently.",
  },
  {
    id: "gulf-investment-confidence",
    title: "Investment Confidence — where property markets are heating up or cooling down",
    def: "Property transaction volumes and values, tracked differently in each country depending on what its land authority or statistics office actually publishes — from Dubai's raw transaction registry to Qatar's real estate trading index. Every Gulf Watch card labels its exact metric rather than showing a generic \"price\" number.",
    impact: "Gulf economies lean heavily on real estate and foreign investment as part of their push to diversify away from oil. Rising transaction volumes tend to signal investor confidence in a country's direction; a slowdown often shows up here well before it reaches slower-moving indicators like GDP.",
  },
  {
    id: "gulf-currency-stability",
    title: "Currency Stability — FX reserves and the current account",
    def: "FX reserves, measured in months of import cover, show how long a country could sustain its current imports using only its foreign currency reserves — a standard IMF stability benchmark. The current account balance (as % of GDP) shows whether a country is a net earner or net spender of foreign currency overall.",
    impact: "Most Gulf currencies are pegged to the US dollar, so unlike a floating currency, strain on the peg doesn't show up as a falling exchange rate — it shows up here first, in shrinking reserves or a widening current account deficit, well before the peg itself would ever be tested.",
  },
  {
    id: "gulf-no-score",
    title: "Why Gulf Watch Has No Composite Score",
    def: "Gulf Watch deliberately does not combine these figures into one score the way MMAI does for its six scored markets. A usable, legally licensable, automatable policy interest rate feed doesn't exist yet for any of these six countries, and MMAI's own rule requires at least 70% pillar coverage before a market earns a published score — so instead of filling the gap with a stand-in number, Gulf Watch shows exactly what's real and marks the rest \"N/A.\"",
    impact: "Every figure on Gulf Watch traces back to its source on the Sources page, same as every scored market. The missing score here isn't a gap in the site — it's the same honesty rule that keeps every other number on MMAI trustworthy, applied consistently even when it means showing less rather than more.",
  },
];

export default function LearnPage() {
  return (
    <>
      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">LEARN MORE</p>
          <h1 className="headline" style={{ maxWidth: "22ch" }}>
            What these numbers actually mean — and why they affect you
          </h1>
          <p className="sub">Every indicator behind the MMAI score, plus Gulf Watch&apos;s cost-of-living, investment-confidence, and currency-stability figures — explained in plain language, with the exact formula used where a formula applies.</p>
        </div>
      </div>

      <div className="section" style={{ paddingTop: 10 }}>
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 16 }}>
            <p className="eyebrow">SCORED MARKETS</p>
            <h2>The five pillars behind every MMAI score</h2>
          </div>
          {TOPICS.map((t) => (
            <div
              key={t.id}
              id={`topic-${t.id}`}
              style={{
                background: "rgba(255,255,255,0.035)",
                border: "1px solid var(--hair)",
                borderRadius: 18,
                padding: "28px 32px",
                marginBottom: 18,
                scrollMarginTop: 90,
                backdropFilter: "blur(14px)",
              }}
            >
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 600, margin: "0 0 12px" }}>{t.title}</h3>
              <p style={{ fontSize: 14.5, color: "var(--ink-soft)", lineHeight: 1.7, margin: "0 0 16px" }}>{t.def}</p>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 14,
                  background: "var(--paper)",
                  border: "1px solid var(--hair)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginBottom: 14,
                }}
              >
                {t.formula}
              </div>
              {"weights" in t && t.weights && (
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12.5,
                    background: "var(--paper)",
                    border: "1px solid var(--hair)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginBottom: 14,
                    color: "var(--ink-soft)",
                    lineHeight: 1.8,
                  }}
                >
                  <span style={{ color: "var(--slate)" }}>where weight =</span> {t.weights}
                </div>
              )}

              {/* Per-market targets, rendered from INFLATION_TARGET so the
                  published formula cannot drift from the scoring engine.
                  targetNote is rendered by the SEPARATE block below, not
                  nested in here: a note nested inside this conditional
                  only appears for the two sections that also have a
                  per-market target table, so the Government Debt and
                  Brent Crude notes were written, compiled, linted, built
                  -- and shown to nobody. Same shape of bug as the
                  limitations block on 31 August, found the same way, by
                  opening the page. */}
              {"targets" in t && t.targets && (
                <div style={{ border: "1px dashed var(--hair)", borderRadius: 10, padding: "13px 16px", marginBottom: 14 }}>
                  <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--slate)", marginBottom: 8 }}>
                    Each market’s own target
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.8 }}>
                    {t.targets}
                  </div>
                </div>
              )}

              {"targetNote" in t && t.targetNote && (
                <div style={{ border: "1px dashed var(--hair)", borderRadius: 10, padding: "13px 16px", marginBottom: 14 }}>
                  <p style={{ fontSize: 13, color: "var(--slate)", margin: 0, lineHeight: 1.7 }}>{t.targetNote}</p>
                </div>
              )}

              {/* Known limitations, stated to the reader. Audit findings
                  H-1 (compensatory averaging), H-2 (one neutral rate for
                  six economies) and M-1 (independence overstated). */}
              {(() => { const lims = (t as { limitations?: Array<{ head: string; body: string }> }).limitations; return lims ? (
                <div style={{ border: "1px dashed var(--hair)", borderRadius: 10, padding: "13px 16px", marginBottom: 14 }}>
                  <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--slate)", marginBottom: 10 }}>
                    What this score does not tell you
                  </div>
                  {lims.map((lim: { head: string; body: string }) => (
                    <div key={lim.head} style={{ marginBottom: 11 }}>
                      <div style={{ fontSize: 13.5, color: "var(--ink-soft)", fontWeight: 600, marginBottom: 2 }}>{lim.head}</div>
                      <p style={{ fontSize: 13, color: "var(--slate)", margin: 0, lineHeight: 1.65 }}>{lim.body}</p>
                    </div>
                  ))}
                </div>
              ) : null; })()}

              {/* What those weights actually DO. A pillar's influence is its
                  weight times how much it moves, so the weight table above
                  describes intent and this describes behaviour. Measured, not
                  asserted -- see PILLAR_EFFECTIVE_INFLUENCE in lib/scoring.ts. */}
              {"influence" in t && t.influence && (
                <div
                  style={{
                    border: "1px dashed var(--hair)",
                    borderRadius: 10,
                    padding: "13px 16px",
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "IBM Plex Mono, monospace",
                      fontSize: 11,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--slate)",
                      marginBottom: 8,
                    }}
                  >
                    What the weights actually do
                  </div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 12.5,
                      color: "var(--ink-soft)",
                      lineHeight: 1.8,
                      marginBottom: 10,
                    }}
                  >
                    {t.influence}
                  </div>
                  {"influenceNote" in t && t.influenceNote && (
                    <p style={{ fontSize: 13, color: "var(--slate)", margin: 0, lineHeight: 1.7 }}>
                      {t.influenceNote}
                    </p>
                  )}
                  {"ecNote" in t && t.ecNote && (
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--slate)",
                        margin: "10px 0 0",
                        paddingTop: 10,
                        borderTop: "1px dashed var(--hair)",
                        lineHeight: 1.7,
                      }}
                    >
                      {t.ecNote}
                    </p>
                  )}
                </div>
              )}
              <div
                style={{
                  padding: "14px 16px",
                  borderLeft: "3px solid var(--teal)",
                  background: "var(--teal-bg)",
                  borderRadius: "0 10px 10px 0",
                }}
              >
                <div style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: "var(--teal)", letterSpacing: 1, marginBottom: 6 }}>
                  WHY THIS AFFECTS YOU
                </div>
                <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.65, margin: 0 }}>{t.impact}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 16 }}>
            <p className="eyebrow">GULF WATCH (NON-SCORED)</p>
            <h2>Six more countries, shown honestly without a score</h2>
          </div>
          {GULF_TOPICS.map((t) => (
            <div
              key={t.id}
              id={`topic-${t.id}`}
              style={{
                background: "rgba(255,255,255,0.035)",
                border: "1px solid var(--hair)",
                borderRadius: 18,
                padding: "28px 32px",
                marginBottom: 18,
                scrollMarginTop: 90,
                backdropFilter: "blur(14px)",
              }}
            >
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 600, margin: "0 0 12px" }}>{t.title}</h3>
              <p style={{ fontSize: 14.5, color: "var(--ink-soft)", lineHeight: 1.7, margin: "0 0 16px" }}>{t.def}</p>
              <div
                style={{
                  padding: "14px 16px",
                  borderLeft: "3px solid var(--teal)",
                  background: "var(--teal-bg)",
                  borderRadius: "0 10px 10px 0",
                }}
              >
                <div style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: "var(--teal)", letterSpacing: 1, marginBottom: 6 }}>
                  WHY THIS AFFECTS YOU
                </div>
                <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.65, margin: 0 }}>{t.impact}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
