import type { Metadata } from "next";
import { INFLATION_TARGET } from "@/lib/indicators";
import {
  DIMENSION_NAMES,
  DIMENSION_EFFECTIVE_INFLUENCE,
  DIMENSION_CROSS_MARKET_SD,
  DIMENSION_INFLUENCE_MEASURED,
  W_INFLATION,
  W_UNEMPLOYMENT,
  COND_WEIGHT_FRACTION,
  W_DEBT,
  W_RATE,
  SOURCE_BREAK_UNCERTAINTY_PTS,
  type DimensionKey,
} from "@/lib/composite";
import { REFERENCE_SET } from "@/lib/referenceSet";
import { percentileOf, compositeZ, standardiseDimensions, rawDimensions } from "@/lib/composite";
import ScoreDiagram from "@/components/ScoreDiagram";
import CorrelationMatrix from "@/components/CorrelationMatrix";
import { FALLBACK_MARKETS } from "@/lib/markets";
import { indicatorFormula, INDICATOR_READING } from "@/lib/composite";

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

// The reference window, read from the data rather than typed. Every score
// on the site is a rank against these rows, so the count and the years are
// load-bearing facts, not decoration.
const REF_YEARS = REFERENCE_SET.map((r) => r.y);
const REF_SPAN = `${Math.min(...REF_YEARS)}–${Math.max(...REF_YEARS)}`;
const REF_N = REFERENCE_SET.length;
// Japan carries fewer rows than the others, and a reader comparing Japan
// is owed that fact. Counted, not asserted.
const REF_BY_MARKET = FALLBACK_MARKETS
  .map((m) => ({ name: m.name, n: REFERENCE_SET.filter((r) => r.m === m.code).length }))
  .sort((a, b) => a.n - b.n);
const REF_SHORTEST = REF_BY_MARKET[0];

// Which dimensions actually separate one country from another, ranked.
//
// GENERATED, NOT WRITTEN, and that is the whole point. On 1 September this
// page stated in prose which pillar separated the markets least. It had it
// backwards, because the measurement behind the sentence had gone stale. A
// hand-written ranking is a claim nobody re-checks when the numbers move;
// a generated one cannot disagree with them.
const DIM_ORDER: DimensionKey[] = ["C", "D", "K"];

const SEPARATION_RANKED = [...DIM_ORDER]
  .sort((a, b) => DIMENSION_CROSS_MARKET_SD[b] - DIMENSION_CROSS_MARKET_SD[a]);

const SEPARATION_LIST = SEPARATION_RANKED
  .map((k) => `${DIMENSION_NAMES[k]} ${DIMENSION_CROSS_MARKET_SD[k].toFixed(1)}`)
  .join("  ·  ");

const MOST_SEPARATING = DIMENSION_NAMES[SEPARATION_RANKED[0]];
const LEAST_SEPARATING = DIMENSION_NAMES[SEPARATION_RANKED[SEPARATION_RANKED.length - 1]];

// Declared weight against measured influence. Both generated, because the
// entire point of the pair is that they DISAGREE -- and a hand-typed
// version of that claim would be the first thing to go stale.
const INFLUENCE_LIST = DIM_ORDER
  .map((k) => `${DIMENSION_NAMES[k]} ${DIMENSION_EFFECTIVE_INFLUENCE[k].toFixed(1)}%`)
  .join("  ·  ");
const INFLUENCE_SPREAD = (
  Math.max(...DIM_ORDER.map((k) => DIMENSION_EFFECTIVE_INFLUENCE[k])) -
  Math.min(...DIM_ORDER.map((k) => DIMENSION_EFFECTIVE_INFLUENCE[k]))
).toFixed(1);
const MOST_INFLUENTIAL = DIMENSION_NAMES[
  [...DIM_ORDER].sort((a, b) => DIMENSION_EFFECTIVE_INFLUENCE[b] - DIMENSION_EFFECTIVE_INFLUENCE[a])[0]
];

// The Conditions split, from the engine's own fraction rather than a
// rounded copy of it.
// The percentage is what a reader reads; the fraction is what a reader
// REPRODUCES with. Printing only the rounded percentage left the page
// promising an exact reproduction it did not supply the numbers for --
// rounding at one decimal moves the composite fifteen times further than
// the tightest rung of the ladder.
const COND_SPLIT = `inflation ${(W_INFLATION * 100).toFixed(1)}% (exactly ${COND_WEIGHT_FRACTION.inflation})  ·  unemployment ${(W_UNEMPLOYMENT * 100).toFixed(1)}% (exactly ${COND_WEIGHT_FRACTION.unemployment})`;
const CAP_SPLIT = `debt ${(W_DEBT * 100).toFixed(0)}%  ·  policy rate ${(W_RATE * 100).toFixed(0)}%`;

export const metadata: Metadata = {
  title: "Learn More",
  description:
    "What inflation, growth, unemployment, interest rates and government debt actually mean for you — and the exact arithmetic that turns them into one comparable score.",
};

/**
 * Which dimension each indicator feeds, so the reader meets that fact on
 * the card itself.
 *
 * The three dimensions are the whole structure of the score, and this
 * page explained five indicators one after another without ever saying,
 * on the card, which of the three each one belongs to. A reader could
 * finish "Government Debt" without learning it is half of Capacity.
 *
 * Keyed by topic id and checked against the engine below, so adding an
 * indicator without placing it here fails the build rather than shipping
 * an untagged card.
 */
const TOPIC_DIMENSION: Record<string, DimensionKey | "none" | "all"> = {
  cpi: "C",
  unemployment: "C",
  gdp: "D",
  debt: "K",
  rate: "K",
  oil: "none",
  mmai: "all",
};

const DIM_TONE: Record<DimensionKey, string> = { C: "#E14B4B", D: "#F0975B", K: "#22D3EE" };

/** WHICH TOPICS ARE ACTUALLY THE SCORE, derived rather than counted by
 *  hand. The heading used to say "five indicators" beside a list that
 *  rendered all seven topics -- the five scored ones, plus Brent, which
 *  is on the page precisely BECAUSE it is no longer scored, plus the
 *  method section. A reader counting the chips found seven under a
 *  heading promising five, which is the kind of small contradiction that
 *  makes someone doubt the arithmetic further down the page.
 *
 *  It drifted because "five" was typed once and the list grew past it.
 *  Deriving the number from the same record the list is built from means
 *  it cannot drift again: add a sixth scored indicator and the heading
 *  says six by itself. */
const SCORED_TOPIC_IDS = Object.keys(TOPIC_DIMENSION).filter(
  (id) => TOPIC_DIMENSION[id] !== "none" && TOPIC_DIMENSION[id] !== "all",
);

const COUNT_WORD: Record<number, string> = {
  3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight",
};

/** Spelled out when there is a word for it, digits beyond that rather
 *  than an invented one. */
const SCORED_COUNT_WORD = COUNT_WORD[SCORED_TOPIC_IDS.length] ?? String(SCORED_TOPIC_IDS.length);

/** The pill that carries it: colour and name, matching the colours the
 *  dimensions already use in the diagram above and on the front page. */
function DimensionTag({ topicId }: { topicId: string }) {
  const d = TOPIC_DIMENSION[topicId];
  if (!d) return null;

  const [label, tone] =
    d === "all"
      ? ["All three dimensions", "var(--accent-2)"]
      : d === "none"
        ? ["Shown, not scored", "var(--slate)"]
        : [`Part of ${DIMENSION_NAMES[d]}`, DIM_TONE[d]];

  return (
    <span className="learn-tag" style={{ color: tone, borderColor: tone }}>
      <i style={{ background: tone }} />
      {label}
    </span>
  );
}

const TOPICS = [
  {
    id: "cpi",
    title: "Inflation & CPI — the price of everything you buy",
    def: "The Consumer Price Index (CPI) tracks the price of a representative basket of everyday goods and services. Inflation is how fast that basket's total cost is rising year over year.",
    formula: indicatorFormula("infGap"),
    formulaNote: INDICATOR_READING.infGap,
    targets: TARGET_LIST,
    targetNote:
      "The target is each central bank's own published objective, not one number applied to everyone. Five of the six aim at 2%. Australia is the exception: the Reserve Bank targets a 2–3% range and sets policy so inflation returns to the midpoint, so MMAI scores Australia against 2.5%. The United States is measured on the PCE price index rather than CPI, because that is the index the Federal Reserve defines its 2% target on.",
    impact: "When CPI rises faster than your income, your money buys less. This is why inflation directly shapes wage negotiations and why central banks raise interest rates specifically to slow it down.",
  },
  {
    id: "gdp",
    title: "GDP Growth — is the economy actually expanding?",
    def: "Gross Domestic Product (GDP) is the total value of everything a country produces. GDP growth measures whether that total is expanding or shrinking.",
    formula: indicatorFormula("gdp"),
    formulaNote: INDICATOR_READING.gdp,
    impact: "When growth is strong, businesses hire more and wages tend to rise. When it shrinks for two consecutive quarters, that's a recession.",
  },
  {
    id: "unemployment",
    title: "Unemployment Rate — how easy is it to find or keep work?",
    def: "The share of people actively looking for work who can't find it, as a percentage of the labour force.",
    formula: indicatorFormula("une"),
    formulaNote: INDICATOR_READING.une,
    impact: "Low unemployment means workers have leverage — more job offers, easier to negotiate a raise. High unemployment flips that.",
  },
  {
    id: "rate",
    title: "Policy Interest Rate — the cost of money, and the room to move it",
    def: "The benchmark rate set by a central bank. It ripples out to set the tone for every other interest rate in the economy.",
    formula: indicatorFormula("rate"),
    formulaNote: INDICATOR_READING.rate,
    targetNote:
      "The policy rate is no longer measured against an estimated neutral rate. It is scored against its own history across the six economies, inside Capacity, where the question is how much room a central bank has to cut if trouble arrives. That removed the least defensible number in the old method: a neutral-rate estimate for Australia dating from a 2017 study, because the Reserve Bank publishes its current figures only in charts. Nothing in the score now depends on anyone’s estimate of neutral.",
    impact:
      "This number sets the floor for mortgage rates, car loans and credit card rates, so a rise makes borrowing more expensive for you. Inside the score it reads the other way round: a central bank at 4% can cut if trouble arrives, and one at 0.5% has almost nothing left to give. Both are true at once — one is what a high rate costs you today, the other is what it buys the economy later.",
  },
  {
    id: "debt",
    title: "Government Debt — how much room a country has left",
    def: "What a government owes, measured against the size of its economy. A country with low debt can borrow to cushion a recession; a country with high debt has less room to act and spends more of its budget on interest instead of services.",
    formula: indicatorFormula("debt"),
    formulaNote: INDICATOR_READING.debt,
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
    def:
      "Every indicator is first expressed as how unusual it is against one historical record — how far from average, in standard deviations, across " +
      `${REF_N} market-years from these same six economies, ${REF_SPAN}. The signs are aligned so that positive always means better. Those five numbers form three dimensions: Conditions (inflation and unemployment), Direction (GDP growth), and Capacity (government debt and room to cut rates). Each dimension is standardised against the same history, the three are averaged equally, and the result is published as a percentile — a rank, not a mark out of 100. A score of 85 means better than 85% of that record.`,
    formula: "MMAI = percentile of ( C′ + D′ + K′ ) ÷ 3",
    weights: `Conditions: ${COND_SPLIT}  ·  Direction: GDP growth 100%  ·  Capacity: ${CAP_SPLIT}  ·  across the three: equal thirds`,
    influence: INFLUENCE_LIST,
    influenceNote:
      `Equal thirds is what the method DECLARES. Measured across the reference history (as of ${DIMENSION_INFLUENCE_MEASURED}), the effective influence is ${INFLUENCE_LIST} — a spread of ${INFLUENCE_SPREAD} points where the declared spread is zero, with ${MOST_INFLUENTIAL} doing the most work. The dimensions move together to different degrees, so the composite tracks some more closely than others. Standardising them equalised how much each VARIES, which is what it was for; it does not equalise how much each MATTERS, and nothing can while they stay correlated.`,
    ecNote:
      `A measure every country scores alike cannot tell them apart, whatever weight it carries — the reason the global oil price stopped being scored. Asked of the three dimensions, for the current six, highest first: ${SEPARATION_LIST}. ${MOST_SEPARATING} does the most to distinguish one country from another; ${LEAST_SEPARATING} does the least. Re-measured rather than assumed, and it will shift as cycles diverge.`,
    limitations: [
      {
        kind: "read",
        head: "It measures conditions, it does not forecast",
        body:
          "Every figure describes what has already been published by an official source. MMAI contains no prediction, no model and no view about what happens next. It is also why the yield curve is not scored despite the data being collected: its standing in economics is almost entirely as a predictor of future recessions, and an index that disclaims forecasting cannot lean on one.",
      },
      {
        kind: "read",
        head: "Read the three dimensions, not just the headline",
        body:
          "Averaging three numbers means a collapse in one can be offset without limit by the other two. Japan is the live case: its Conditions score is the highest of every market-year in the record — inflation on target, unemployment near 2% — while its Capacity is close to the lowest, with debt near 180% of GDP and almost no room to cut rates. Those genuinely offset, and a headline near the middle describes neither. Where that is happening the site says so beside the score, and all three dimensions are always shown.",
      },
      {
        kind: "read",
        head: "A high interest rate is scored as a good thing here",
        body:
          "Inside Capacity a higher policy rate scores better, which is the opposite of how a rate is usually read. That is deliberate, and it only makes sense alongside the question Capacity asks: how much room is there to respond to trouble. A central bank at 4% can cut; one at 0.5% cannot. Read without that framing the sign looks simply wrong, which is why the question appears beside the number everywhere it is shown.",
      },
      {
        kind: "measured",
        head: "The score carries a measured margin of error",
        body:
          `The historical record changes data source partway through: figures to 2018 come from the World Bank’s annual series, and from 2019 onward from each country’s own statistics office. Rebuilding the entire history on a single source moves any published score by up to ${SOURCE_BREAK_UNCERTAINTY_PTS} percentile points, though it does not change the order. Countries closer together than that are reported as level rather than ranked, so the site never claims a lead it cannot support. GDP growth is where the two sources disagree most, by about a quarter of a point on average — later revisions, not a mistake by either.`,
      },
      {
        kind: "judgment",
        head: "The weights are stated judgments, not measurements",
        body:
          "No index of this kind can measure what inflation is worth against unemployment, because there is no experiment that would settle it — so every one of them declares a weighting instead. MMAI does too, and says which is which. The inflation-to-unemployment split follows published research on the wellbeing cost of each, though that research measures the cost of a higher inflation RATE while MMAI applies it to distance from a target; those are not the same quantity, so the split is described as informed by that evidence rather than measured for this use. The two weights inside Capacity are declared outright. Nothing was fitted to MMAI’s own data, which is what would make a score circular.",
      },
      {
        kind: "judgment",
        head: "Equal thirds is a convention, and it is not equal in effect",
        body:
          "Weighting the three dimensions equally is the most common approach for an index like this and the default in the OECD’s handbook. That is a reason to adopt it, not evidence the three matter equally. Testing shows it is also the choice the ranking is most sensitive to: vary the other weights by half and the order never changes, but vary these and it does. And as measured above, equal weighting does not produce equal influence, because the three dimensions move together to different degrees. All three are published beside the score so a reader who disagrees can weigh them differently.",
      },
      {
        kind: "judgment",
        head: "Inflation above and below target are treated the same",
        body:
          "MMAI penalises inflation one point above target exactly as much as one point below. The evidence does not support that, and does not agree on the alternative either: estimates of what central banks actually do find overshoots penalised about three times as heavily, while work on what happens when interest rates are near zero implies the opposite. Adopting either would mean picking a side of a live argument. Symmetry is kept because the European Central Bank states it in its own published strategy — negative and positive deviations equally undesirable — a citation to a stated objective rather than a measurement. Choosing differently would move scores by around six percentile points.",
      },
      {
        kind: "judgment",
        head: "Full employment is treated as the same number everywhere",
        body:
          "Unemployment is scored against one historical distribution for all six markets, so a country with structurally higher unemployment scores lower for reasons that are not about current conditions. Japan and the euro area do not plausibly share a single definition of full employment. Using each country’s own estimate would be more accurate, but those estimates are themselves uncertain and revised often, which would trade one problem for another.",
      },
      {
        kind: "judgment",
        head: `${REF_SHORTEST.name} is under-represented in the record`,
        body:
          `The reference distribution holds ${REF_N} market-years rather than a clean 26 for each of the six. ${REF_SHORTEST.name} contributes ${REF_SHORTEST.n}, because for eight of those years its central bank targeted the quantity of money rather than an interest rate, so no policy rate exists to record. Those years are absent at source, not dropped for convenience — but it does mean ${REF_SHORTEST.name} shapes the historical average slightly less than the others, and the years missing are its most unusual ones.`,
      },
    ],
    impact:
      `You can take the raw numbers for any market, run them through the formulas shown here, and get the exact score shown on the Overview page — no hidden adjustments. The full ${REF_N}-row reference table is published too, so the averages themselves can be checked rather than taken on trust. A percentile describes conditions for an average household and business in that economy against the last ${REF_SPAN} — manageable inflation, available jobs, reasonable borrowing costs — not investment returns, and not a government’s policy performance. MMAI is not investment advice.`,
  },
];

/**
 * THE 2008 TEST, COMPUTED RATHER THAN TYPED.
 *
 * These figures were written by hand in a briefing document and were
 * already wrong by the time the three dimensions replaced the five
 * pillars -- the old falls were 31, 30, 29 points; the real ones under
 * this method are two to three times larger, because a percentile rank
 * moves differently from a 0-100 score. Generating them from the same
 * reference set the engine uses means the page cannot disagree with the
 * arithmetic behind it.
 */
const CRISIS = FALLBACK_MARKETS.map((m) => {
  const at = (y: number) => REFERENCE_SET.find((r) => r.m === m.code && r.y === y);
  const score = (row: (typeof REFERENCE_SET)[number] | undefined) =>
    row ? percentileOf(compositeZ(standardiseDimensions(rawDimensions(row)))) : null;
  const before = score(at(2007));
  const trough = score(at(2009));
  return { name: m.name, before, trough, fall: before != null && trough != null ? trough - before : null };
})
  .filter((r) => r.fall != null)
  .sort((a, b) => (a.fall as number) - (b.fall as number));

/**
 * THE QUESTIONS A SCEPTICAL READER ARRIVES WITH.
 *
 * Answers drawn from the project's own briefing notes, which existed only
 * as a private document. The two that matter most are the ones where the
 * honest answer is partly no -- whether this is just public data in one
 * place, and whether it predicts markets. Publishing those is worth more
 * than any claim the site could make about itself.
 */
const FAQ: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "Isn't this just public data collected in one place?",
    a: (
      <>
        <p>
          The data is public and there is no point pretending otherwise. But putting it in one place is the one
          thing you must <b>not</b> do, because these numbers do not mean the same thing.
        </p>
        <p>
          Every country headlines a different growth figure. The United States and Canada take a quarterly number
          and multiply it up as if the year continued at that pace. The United Kingdom&apos;s headline compares
          against the previous three months, not the same period last year. Australia&apos;s is not adjusted for
          inflation at all. Collect those four, display them side by side, and you have built a comparison that
          looks entirely reasonable and is wrong.
        </p>
        <p>
          MMAI rejects all four headlines and rebuilds each one on the same basis. Central banks also aim at
          different targets — five at 2%, Australia at 2.5% — so inflation is scored against each bank&apos;s own
          objective rather than one number applied to everybody. <b>Collection is the raw material, not the
          product.</b> The judgment that makes {FALLBACK_MARKETS.length} countries genuinely comparable is the work.
        </p>
      </>
    ),
  },
  {
    q: "Does it predict the market?",
    a: (
      <>
        <p>
          <b>No.</b> It has never been tested against market returns, and no claim is made that it forecasts them.
          Anyone who tells you otherwise is overselling it.
        </p>
        <p>
          MMAI measures the economic environment, not asset prices. Those are related but they are not the same
          thing, and they routinely move in opposite directions — markets often rise while conditions are still
          deteriorating. Whether the score leads or lags market returns is a legitimate research question. It has
          not been done, so it cannot be claimed.
        </p>
      </>
    ),
  },
  {
    q: "What is it actually worth to someone who is not an economist?",
    a: (
      <>
        <p>
          It tells you what kind of environment you are making decisions in, before you make them. Most people
          already feel the economy — rent is up, the job market feels tight or loose, a mortgage costs more than it
          did. What is hard to tell is whether that is <em>your</em> situation or <em>the</em> situation, and
          whether it is getting better or worse.
        </p>
        <p>
          It can answer: is borrowing unusually expensive right now, or does it just feel that way? Is my
          country&apos;s job market genuinely stronger than its neighbours&apos;? Are conditions improving over the
          last few years? It cannot answer: should I buy a house, what will rates do next, where should I put my
          savings, is my job safe. It is <b>context, not a signal</b>.
        </p>
      </>
    ),
  },
  {
    q: "Has it been tested?",
    a: (
      <>
        <p>
          Run across the {REF_N} market-years behind every score, the index falls hard through the 2008 crisis for
          every country that had a recession — and not for the one that did not. Ranks, so the change is in
          percentile points:
        </p>
        <div className="scroll-x" style={{ margin: "12px 0" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Market</th>
                <th scope="col" style={{ textAlign: "right" }}>2007</th>
                <th scope="col" style={{ textAlign: "right" }}>2009</th>
                <th scope="col" style={{ textAlign: "right" }}>Change</th>
              </tr>
            </thead>
            <tbody>
              {CRISIS.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td style={{ textAlign: "right", fontFamily: "IBM Plex Mono, monospace" }}>{r.before!.toFixed(0)}</td>
                  <td style={{ textAlign: "right", fontFamily: "IBM Plex Mono, monospace" }}>{r.trough!.toFixed(0)}</td>
                  <td style={{ textAlign: "right", fontFamily: "IBM Plex Mono, monospace", color: "var(--ink)" }}>
                    {r.fall!.toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <b>Australia is the important row.</b> An index that simply reacted to global bad news would have dropped
          Australia with everyone else. It stayed high, because Australia&apos;s own conditions held — it did not
          have a recession. That is evidence the index reads each country rather than following the headlines.
        </p>
        <p>
          <b>And the limit of that test, before you ask.</b> 2007, 2008 and 2009 sit <em>inside</em> the {REF_N}-row
          reference window the score is ranked against. So this is a consistency check — the index reproduces the
          crisis and separates the country that avoided it — not an out-of-sample forecast test. A genuine
          out-of-sample test has not been run.
        </p>
      </>
    ),
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
          <p className="sub">Every figure behind the score, in plain language, with the exact arithmetic beside it — so you can follow how five published numbers become one rank, or check it yourself.</p>
        </div>
      </div>

      {/* The whole method on one screen, before any of the detail. A
          reader who takes in only this should still know what a score is
          and where it came from. */}
      <div className="section">
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 18 }}>
            <p className="eyebrow">THE METHOD AT A GLANCE</p>
            <h2>How five published figures become one rank</h2>
            <p>
              Nothing here is hidden and nothing is estimated by us. Each step is shown below, and every
              constant it uses is published further down this page.
            </p>
          </div>
          <ScoreDiagram />
        </div>
      </div>

      {/* Grouping five numbers into three buckets is a CLAIM -- that the
          things in a bucket belong together and the buckets measure
          different things. This is the evidence for it, including the part
          that is not flattering. */}
      <div className="section">
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 18 }}>
            <p className="eyebrow">WHY THESE THREE GROUPS</p>
            <h2>The indicators that move together, and the ones that do not</h2>
            <p>
              Putting five figures into three dimensions asserts that each group belongs together and that the
              groups measure different things. Measured across the whole reference record, here is whether that
              is true.
            </p>
          </div>
          <CorrelationMatrix />
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 16 }}>
            <p className="eyebrow">SCORED MARKETS</p>
            <h2>The {SCORED_COUNT_WORD} indicators behind every MMAI score</h2>
            <p>
              One card each, under the dimension it feeds. Oil and the method section are on this
              page too, listed separately because neither is one of the {SCORED_COUNT_WORD}.
            </p>
          </div>

          {/* A CONTENTS LINE, because this is a long page, and GROUPED,
              because it said it was.

              It used to render TOPICS in source order into one wrapping
              row: Conditions, Direction, Conditions, Capacity, Capacity,
              unscored, method. The copy above promised "grouped by the
              dimension it feeds" and the coloured dot on each chip made
              the failure to do so unmissable -- red, orange, red, cyan,
              cyan, grey, purple, with the two Conditions indicators split
              apart by GDP growth. A reader who trusted the dots read the
              grouping as broken, which it was.

              Now each dimension is a labelled row of its own, so the dots
              are a second reading of the heading rather than the only
              clue, and the two topics that are NOT among the scored
              indicators sit visibly outside them. */}
          <nav className="learn-index" aria-label="Jump to an indicator">
            {DIM_ORDER.map((d) => (
              <div key={d} className="learn-index-group">
                <span className="learn-index-group-name" style={{ color: DIM_TONE[d] }}>
                  {DIMENSION_NAMES[d]}
                </span>
                <div className="learn-index-chips">
                  {TOPICS.filter((t) => TOPIC_DIMENSION[t.id] === d).map((t) => (
                    <a key={t.id} href={`#topic-${t.id}`} className="learn-index-link">
                      <i style={{ background: DIM_TONE[d] }} />
                      {t.title.split(" — ")[0]}
                    </a>
                  ))}
                </div>
              </div>
            ))}

            {/* Kept apart on purpose. Brent is on this page BECAUSE it is
                no longer scored, and folding it in beside the five would
                undo the point the page spends a card making. */}
            <div className="learn-index-group learn-index-group--aside">
              <span className="learn-index-group-name">Also on this page</span>
              <div className="learn-index-chips">
                {TOPICS.filter((t) => {
                  const d = TOPIC_DIMENSION[t.id];
                  return d === "none" || d === "all";
                }).map((t) => (
                  <a key={t.id} href={`#topic-${t.id}`} className="learn-index-link">
                    <i style={{ background: TOPIC_DIMENSION[t.id] === "all" ? "var(--accent-2)" : "var(--slate)" }} />
                    {/* One title has no dash to cut at and needs naming outright. */}
                    {t.id === "mmai" ? "Putting it together" : t.title.split(" — ")[0]}
                  </a>
                ))}
              </div>
            </div>
          </nav>
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
              <DimensionTag topicId={t.id} />
              <h3 className="learn-h3">{t.title}</h3>
              <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.7, margin: "0 0 16px" }}>{t.def}</p>
              {/* ONLY IF THERE IS A FORMULA TO SHOW.
                  This box rendered unconditionally, and Brent Crude has no
                  formula -- it is on this page precisely BECAUSE it is no
                  longer scored, so there is no transform to print. The
                  result was an empty black rectangle sitting under the oil
                  card's description, which reads as something that failed
                  to load rather than something that does not exist.
                  The formulaNote directly below was already guarded the
                  same way, so the pattern was known here and this box was
                  simply missed. */}
              {"formula" in t && t.formula && (
                <div
                  style={{
                    fontFamily: "IBM Plex Mono, monospace",
                    fontSize: 15,
                    background: "var(--paper)",
                    border: "1px solid var(--hair)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginBottom: 14,
                  }}
                >
                  {t.formula}
                </div>
              )}
              {/* A z-score is not self-explanatory the way a 0-100 pillar score
                  pretended to be, so every transform gets a line saying what
                  zero means and which way is better. */}
              {"formulaNote" in t && t.formulaNote && (
                <p style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.6, margin: "-6px 0 14px" }}>
                  {t.formulaNote as string}
                </p>
              )}
              {"weights" in t && t.weights && (
                <div
                  style={{
                    fontFamily: "IBM Plex Mono, monospace",
                    fontSize: 13,
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
                  <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8 }}>
                    {t.targets}
                  </div>
                </div>
              )}

              {"targetNote" in t && t.targetNote && (
                <div style={{ border: "1px dashed var(--hair)", borderRadius: 10, padding: "13px 16px", marginBottom: 14 }}>
                  <p style={{ fontSize: 13, color: "var(--slate)", margin: 0, lineHeight: 1.7 }}>{t.targetNote}</p>
                </div>
              )}

              {/* NINE NOTES, THREE DIFFERENT KINDS.
                  These used to render as one flat list under one heading,
                  and that framing was doing real damage: three of them are
                  guidance on how to read the score, one is a margin of
                  error most indices never publish at all, and only five are
                  genuine judgment calls. Presented at equal weight in a
                  single grey box, nine paragraphs read as nine defects --
                  a reader could not tell an ordinary methodological
                  convention from a real weakness, so the whole score looked
                  shakier than it is.

                  Nothing is removed. The guidance leads, because it helps.
                  The measurement is named as the rigour it is. The five
                  real choices sit behind a disclosure that states how many
                  there are, so the honesty is advertised rather than either
                  buried or dumped on someone who just wanted to know what
                  the number means. Audit findings H-1, H-2 and M-1 are all
                  still here in full.  */}
              {(() => {
                const lims = (t as { limitations?: Array<{ kind: string; head: string; body: string }> }).limitations;
                if (!lims) return null;
                const of = (k: string) => lims.filter((l) => l.kind === k);
                const note = (lim: { head: string; body: string }) => (
                  <div key={lim.head} style={{ marginBottom: 11 }}>
                    <div style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 600, marginBottom: 2 }}>{lim.head}</div>
                    <p style={{ fontSize: 13, color: "var(--slate)", margin: 0, lineHeight: 1.65 }}>{lim.body}</p>
                  </div>
                );
                const calls = of("judgment");
                return (
                  <>
                    <div className="learn-note">
                      <div className="learn-note-label">How to read the score</div>
                      {of("read").map(note)}
                    </div>

                    <div className="learn-note">
                      <div className="learn-note-label">What we measured about our own method</div>
                      <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, margin: "0 0 12px" }}>
                        Most published indices give you a number and ask you to trust the brand. These are the
                        checks MMAI ran on itself, and it publishes the answers whether or not they flatter it.
                      </p>
                      {of("measured").map(note)}
                    </div>

                    {calls.length > 0 && (
                      <details className="learn-calls">
                        <summary>
                          <span className="learn-calls-title">The {calls.length} judgment calls, stated in full</span>
                          <span className="learn-calls-sub">
                            Every index of this kind rests on choices like these. Open to read each one.
                          </span>
                        </summary>
                        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, margin: "12px 0 14px" }}>
                          <b>The data and the arithmetic are checkable.</b> Every figure comes from a named official
                          source, the {REF_N}-row reference table is published in full, and any reader can reproduce a
                          score by hand — one already has, working only from the published files and without being told
                          the answer. What follows is the layer above that: the choices about how those figures are
                          combined. <b>No experiment settles what inflation is worth against unemployment</b>, so every
                          index declares an answer instead. What is unusual here is stating them, and measuring what
                          they actually do.
                        </p>
                        {calls.map(note)}
                      </details>
                    )}
                  </>
                );
              })()}

              {/* What those weights actually DO. A pillar's influence is its
                  weight times how much it moves, so the weight table above
                  describes intent and this describes behaviour. Measured, not
                  asserted -- see DIMENSION_EFFECTIVE_INFLUENCE in lib/composite.ts. */}
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
                      fontFamily: "IBM Plex Mono, monospace",
                      fontSize: 13,
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
                  borderLeft: "3px solid var(--status-live)",
                  background: "var(--status-live-bg)",
                  borderRadius: "0 10px 10px 0",
                }}
              >
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, fontWeight: 700, color: "var(--status-live)", letterSpacing: 1, marginBottom: 6 }}>
                  WHY THIS AFFECTS YOU
                </div>
                <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.65, margin: 0 }}>{t.impact}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* THE QUESTIONS PEOPLE ACTUALLY ARRIVE WITH.
          These answers existed only in a private briefing document. Two of
          them are ones where the honest answer is partly no, and those are
          the two most worth publishing -- a reader who finds "does it
          predict markets? No" on the page itself has been told something
          the site gains nothing by admitting, which is the only reason to
          believe the rest of it. */}
      <div className="section">
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 16 }}>
            <p className="eyebrow">COMMON QUESTIONS</p>
            <h2>Common questions</h2>
            <p>
              What the score is for, what it can tell you, and how it holds up against a year everybody
              remembers.
            </p>
          </div>

          {FAQ.map((item) => (
            <details key={item.q} className="learn-calls faq-item">
              <summary>
                <span className="learn-calls-title">{item.q}</span>
              </summary>
              <div className="faq-answer">{item.a}</div>
            </details>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 16 }}>
            <p className="eyebrow">GULF WATCH (NON-SCORED)</p>
            <h2>Six more countries, tracked but deliberately unscored</h2>
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
              <h3 className="learn-h3">{t.title}</h3>
              <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.7, margin: "0 0 16px" }}>{t.def}</p>
              <div
                style={{
                  padding: "14px 16px",
                  borderLeft: "3px solid var(--status-live)",
                  background: "var(--status-live-bg)",
                  borderRadius: "0 10px 10px 0",
                }}
              >
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, fontWeight: 700, color: "var(--status-live)", letterSpacing: 1, marginBottom: 6 }}>
                  WHY THIS AFFECTS YOU
                </div>
                <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.65, margin: 0 }}>{t.impact}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
