import type { Metadata } from "next";
import Link from "next/link";
import { REFERENCE_SET } from "@/lib/referenceSet";
import { DIMENSION_NAMES, DIMENSION_QUESTIONS, type DimensionKey } from "@/lib/composite";
import { MARKET_COUNT_WORD_CAP } from "@/lib/markets";
import { pageMetadata } from "@/lib/pageMetadata";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "Everyone watches the market. Almost nobody watches the conditions underneath it. MMAI reads the macro picture — prices, jobs, growth, debt and the cost of money — as one comparable score per country.",
  path: "/about",
});

// Counted, never typed. A number written into prose by hand is the first
// thing to go stale, and this page's whole argument is that its numbers
// hold up.
const REF_N = REFERENCE_SET.length;
const YEARS = REFERENCE_SET.map((r) => r.y);
const SPAN = `${Math.min(...YEARS)}–${Math.max(...YEARS)}`;
const MARKETS = new Set(REFERENCE_SET.map((r) => r.m)).size;

const ORDER: DimensionKey[] = ["C", "D", "K"];
const TONE: Record<DimensionKey, string> = { C: "#E14B4B", D: "#F0975B", K: "#22D3EE" };

/**
 * WHAT A READER CAN ACTUALLY DO WITH IT.
 *
 * This page opened with "an index built to be checked, not trusted" and
 * led its sections with "what it is not" and "everything needed to
 * disagree with it". Every one of those sentences was true, and together
 * they made a page that argued with itself -- a reader met four
 * disclaimers before being given one reason to care, and the headline
 * literally instructed them not to trust the thing.
 *
 * The honesty stays. It moves further down and into proportion, because
 * it is a REASON to trust the index, not the pitch itself.
 */
const USES = [
  {
    q: "Is borrowing unusually expensive right now, or does it just feel that way?",
    a: "The policy rate set against its own history, not against your memory of it.",
  },
  {
    q: "Is my country's job market genuinely stronger than its neighbours'?",
    a: `${MARKET_COUNT_WORD_CAP} economies on one scale, rebuilt so the comparison actually holds.`,
  },
  {
    q: "Are conditions improving, or getting worse?",
    a: "A rank against 26 years, so you can see where today sits in the record.",
  },
  {
    q: "Is inflation easing against the target my central bank actually uses?",
    a: "Each bank's own objective — five aim at 2%, Australia at 2.5%.",
  },
];

export default function AboutPage() {
  return (
    <>
      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">ABOUT</p>
          <h1 className="headline" style={{ maxWidth: "24ch" }}>
            Everyone watches the market. Almost nobody watches{" "}
            <span className="hl-cyan">what it is standing on</span>.
          </h1>
          <p className="sub" style={{ maxWidth: "66ch" }}>
            Prices, jobs, growth, government debt and the cost of money decide the ground everything else is priced
            on. They are published constantly, by governments, for free — and in a form almost nobody can actually
            compare. MMAI reads them and turns them into one score per country, rechecked every day.
          </p>
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">THE VIEW</p>
            <h2>Three questions, asked of every economy the same way</h2>
            <p>
              A market chart tells you what price something reached. It does not tell you whether the economy
              underneath was helping or fighting it. These are the three things MMAI asks instead — identically of{" "}
              {MARKETS} economies, which is harder than it sounds and is most of the work.
            </p>
          </div>

          <div className="ind-groups" style={{ marginTop: 20 }}>
            {ORDER.map((d) => (
              <section key={d} className="ind-group">
                <header className="ind-group-head">
                  <span className="ind-group-name" style={{ color: TONE[d] }}>
                    <i style={{ background: TONE[d] }} />
                    {DIMENSION_NAMES[d]}
                  </span>
                  <span className="ind-group-q">{DIMENSION_QUESTIONS[d]}</span>
                </header>
              </section>
            ))}
          </div>

          <p style={{ fontSize: "var(--t-small)", color: "var(--slate)", lineHeight: 1.7, marginTop: 16, maxWidth: "72ch" }}>
            The answers are ranked against {REF_N} market-years of those same economies, {SPAN}. A score of 85 means
            better than 85% of that record — a position in history, not a mark out of 100.
          </p>
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">WHAT IT IS FOR</p>
            <h2>Questions it can answer today</h2>
            <p>
              Most people already feel the economy — rent is up, the job market feels tight or loose, a mortgage
              costs more than it did. What is hard to tell is whether that is <em>your</em> situation or{" "}
              <em>the</em> situation.
            </p>
          </div>

          <div className="signal-grid" style={{ marginTop: 18 }}>
            {USES.map((u) => (
              <div key={u.q} className="mmai-card">
                <div style={{ fontSize: "var(--t-small)", fontWeight: 600, color: "var(--ink)", lineHeight: 1.5 }}>
                  {u.q}
                </div>
                <p style={{ fontSize: "var(--t-caption)", color: "var(--slate)", margin: "7px 0 0", lineHeight: 1.6 }}>
                  {u.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">HOW IT IS BUILT</p>
            <h2>Public data, made genuinely comparable</h2>
            <p>
              The inputs are free and public. Making them mean the same thing across six countries is the part that
              takes the work — and the part almost everyone gets wrong.
            </p>
          </div>

          <div className="signal-grid" style={{ marginTop: 18 }}>
            <div className="mmai-card">
              <div className="meta-label">Rebuilt on one basis</div>
              <p style={{ fontSize: "var(--t-small)", color: "var(--ink-soft)", margin: "8px 0 0", lineHeight: 1.7 }}>
                Every country headlines a different growth figure — some annualised from a single quarter, one
                compared against the previous quarter, one not adjusted for inflation at all. MMAI rejects all of
                them and rebuilds each on the same footing.
              </p>
            </div>
            <div className="mmai-card">
              <div className="meta-label">Named sources</div>
              <p style={{ fontSize: "var(--t-small)", color: "var(--ink-soft)", margin: "8px 0 0", lineHeight: 1.7 }}>
                Every figure traces to a central bank or a national statistics agency, with its licence terms
                recorded and its own observation date shown, so you can see how fresh it is. Listed on the{" "}
                <Link href="/sources" style={{ color: "var(--accent-2)" }}>Sources page</Link>.
              </p>
            </div>
            <div className="mmai-card">
              <div className="meta-label">Published arithmetic</div>
              <p style={{ fontSize: "var(--t-small)", color: "var(--ink-soft)", margin: "8px 0 0", lineHeight: 1.7 }}>
                The formulas sit on the{" "}
                <Link href="/learn" style={{ color: "var(--accent-2)" }}>Learn page</Link> as equations. Someone
                working only from the published files has reproduced a score independently — to nine decimal
                places, without being told the answer.
              </p>
            </div>
            <div className="mmai-card">
              <div className="meta-label">Nothing quiet when it changes</div>
              <p style={{ fontSize: "var(--t-small)", color: "var(--ink-soft)", margin: "8px 0 0", lineHeight: 1.7 }}>
                Every method change is logged with the old rule, the new rule, the reason, the evidence and the
                effect on every score — including the changes that were embarrassing.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="wrap" style={{ maxWidth: 760 }}>
          {/* Kept, and kept SMALL. A reader deserves to know the edges, and
              an index that oversells itself loses the argument the first
              time somebody checks. But this is a footnote to the offer --
              which is not how the page was reading before. */}
          <div className="mmai-card">
            <div className="meta-label">Where the line is</div>
            <p style={{ fontSize: "var(--t-small)", color: "var(--ink-soft)", margin: "8px 0 0", lineHeight: 1.75 }}>
              MMAI measures the economic environment. It is <b>not a forecast</b>, not a trading signal and not
              investment advice — it has never been tested against market returns and makes no claim about them.
              It is context for a decision, not the decision. The judgment calls behind the method, and what each
              one does to the ranking, are set out in full on the{" "}
              <Link href="/learn#topic-mmai" style={{ color: "var(--accent-2)" }}>Learn page</Link>.
            </p>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="wrap" style={{ maxWidth: 720 }}>
          <div className="section-head">
            <p className="eyebrow">GET IN TOUCH</p>
            <h2>Every message is read personally</h2>
            <p>
              Requests, partnership enquiries, or a thought worth sharing. If you think something here is wrong,
              that is the most useful message you can send.
            </p>
          </div>
          <Link className="tap" href="/contact" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 999, background: "linear-gradient(135deg, var(--accent-2), #6D28D9)", color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
            Send a message →
          </Link>
        </div>
      </div>
    </>
  );
}
