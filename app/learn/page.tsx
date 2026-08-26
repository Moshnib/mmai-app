import type { Metadata } from "next";
import { PILLAR_NAMES, formatWeightPct, type PillarKey } from "@/lib/scoring";

export const metadata: Metadata = {
  title: "Learn More",
  description:
    "Inflation, GDP growth, unemployment, policy rates, and oil — plus Gulf Watch's cost-of-living, investment-confidence, and currency-stability figures — what each one actually means for you, in plain language.",
};

const ORDER: PillarKey[] = ["PS", "GM", "LM", "MC", "EC"];

const TOPICS = [
  {
    id: "cpi",
    title: "Inflation & CPI — the price of everything you buy",
    def: "The Consumer Price Index (CPI) tracks the price of a representative basket of everyday goods and services. Inflation is how fast that basket's total cost is rising year over year.",
    formula: "Price Stability Score = clamp(100 − 15 × |inflation − 2%|, 0, 100)",
    impact: "When CPI rises faster than your income, your money buys less. This is why inflation directly shapes wage negotiations and why central banks raise interest rates specifically to slow it down.",
  },
  {
    id: "gdp",
    title: "GDP Growth — is the economy actually expanding?",
    def: "Gross Domestic Product (GDP) is the total value of everything a country produces. GDP growth measures whether that total is expanding or shrinking.",
    formula: "Growth Momentum Score = clamp(50 + 10 × (GDP growth %), 0, 100)",
    impact: "When growth is strong, businesses hire more and wages tend to rise. When it shrinks for two consecutive quarters, that's a recession.",
  },
  {
    id: "unemployment",
    title: "Unemployment Rate — how easy is it to find or keep work?",
    def: "The share of people actively looking for work who can't find it, as a percentage of the labour force.",
    formula: "Labour Market Score = clamp(100 − 10 × (unemployment% − 2%), 0, 100)",
    impact: "Low unemployment means workers have leverage — more job offers, easier to negotiate a raise. High unemployment flips that.",
  },
  {
    id: "rate",
    title: "Policy Interest Rate — the cost of borrowing money",
    def: "The benchmark rate set by a central bank. It ripples out to set the tone for every other interest rate in the economy.",
    formula: "Monetary Conditions Score = clamp(100 − 12 × |policy rate − 2.5%|, 0, 100)",
    impact: "This number sets the floor for mortgage rates, car loans, and credit card APRs — when it rises, borrowing gets more expensive.",
  },
  {
    id: "oil",
    title: "Brent Crude Oil — the hidden cost inside everything",
    def: "The global benchmark oil price. Even if you never buy gasoline directly, oil is embedded in shipping, manufacturing, and heating costs.",
    formula: "External & Commodities Score = clamp(100 − 1.2 × |Brent YoY % change|, 0, 100)",
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
