import Link from "next/link";

const TOPICS = [
  {
    id: "cpi",
    title: "Inflation & CPI — the price of everything you buy",
    def: "The Consumer Price Index (CPI) tracks the price of a representative basket of everyday goods and services. Inflation is how fast that basket's total cost is rising year over year.",
    formula: "Price Stability Score = 100 − 15 × |inflation − 2%|",
    impact: "When CPI rises faster than your income, your money buys less. This is why inflation directly shapes wage negotiations and why central banks raise interest rates specifically to slow it down.",
  },
  {
    id: "gdp",
    title: "GDP Growth — is the economy actually expanding?",
    def: "Gross Domestic Product (GDP) is the total value of everything a country produces. GDP growth measures whether that total is expanding or shrinking.",
    formula: "Growth Momentum Score = 50 + 10 × (GDP growth %)",
    impact: "When growth is strong, businesses hire more and wages tend to rise. When it shrinks for two consecutive quarters, that's a recession.",
  },
  {
    id: "unemployment",
    title: "Unemployment Rate — how easy is it to find or keep work?",
    def: "The share of people actively looking for work who can't find it, as a percentage of the labour force.",
    formula: "Labour Market Score = 100 − 10 × (unemployment% − 2%)",
    impact: "Low unemployment means workers have leverage — more job offers, easier to negotiate a raise. High unemployment flips that.",
  },
  {
    id: "rate",
    title: "Policy Interest Rate — the cost of borrowing money",
    def: "The benchmark rate set by a central bank. It ripples out to set the tone for every other interest rate in the economy.",
    formula: "Monetary Conditions Score = 100 − 12 × |policy rate − 2.5%|",
    impact: "This number sets the floor for mortgage rates, car loans, and credit card APRs — when it rises, borrowing gets more expensive.",
  },
  {
    id: "oil",
    title: "Brent Crude Oil — the hidden cost inside everything",
    def: "The global benchmark oil price. Even if you never buy gasoline directly, oil is embedded in shipping, manufacturing, and heating costs.",
    formula: "External & Commodities Score = 100 − 1.2 × |Brent YoY % change|",
    impact: "Oil spikes show up weeks later as higher prices at the pump, higher heating bills, and higher shipping costs baked into everything you buy.",
  },
  {
    id: "mmai",
    title: "How MMAI Combines All of This Into One Score",
    def: "Each indicator becomes a 0–100 pillar score. MMAI combines them using fixed weights — the same formula for every market, every time.",
    formula: "MMAI = (Σ weight × pillar score) ÷ (Σ active weights)",
    impact: "You can take the raw numbers for any market, run them through the formulas shown here, and get the exact score shown on the Overview page — no hidden adjustments.",
  },
];

export default function LearnPage() {
  return (
    <>
      <nav>
        <div className="navrow">
          <Link href="/" className="brand"><span className="dot" />MMAI</Link>
          <div className="navlinks">
            <Link href="/" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Overview</Link>
            <button className="navlink active">Learn</button>
          </div>
        </div>
      </nav>

      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">LEARN</p>
          <h1 className="headline" style={{ maxWidth: "20ch" }}>
            What these numbers actually mean — and why they affect you
          </h1>
          <p className="sub">Every indicator behind the MMAI score, explained in plain language, with the exact formula used.</p>
        </div>
      </div>

      <div className="section" style={{ paddingTop: 10 }}>
        <div className="wrap">
          {TOPICS.map((t) => (
            <div
              key={t.id}
              id={`topic-${t.id}`}
              style={{
                background: "#fff",
                border: "1px solid var(--hair)",
                borderRadius: 18,
                padding: "28px 32px",
                marginBottom: 18,
                scrollMarginTop: 90,
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

      <footer>
        <div className="wrap">
          © 2026 MMAI — Moshnib Market Analysis Index. An analytical communication tool, not investment advice.
        </div>
      </footer>
    </>
  );
}
