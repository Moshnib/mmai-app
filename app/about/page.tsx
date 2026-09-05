import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "@/components/ContactForm";
import { REFERENCE_SET } from "@/lib/referenceSet";
import { DIMENSION_NAMES, DIMENSION_QUESTIONS, type DimensionKey } from "@/lib/composite";

export const metadata: Metadata = {
  title: "About",
  description:
    "What MMAI is, what it deliberately does not claim, how it is built, and how to check it yourself — plus how to get in touch.",
};

// Counted, never typed. The same discipline as everywhere else on the
// site: a number written into prose by hand is the first thing to go
// stale, and this page's whole argument is that its numbers are checkable.
const REF_N = REFERENCE_SET.length;
const YEARS = REFERENCE_SET.map((r) => r.y);
const SPAN = `${Math.min(...YEARS)}–${Math.max(...YEARS)}`;
const MARKETS = new Set(REFERENCE_SET.map((r) => r.m)).size;

const ORDER: DimensionKey[] = ["C", "D", "K"];
const TONE: Record<DimensionKey, string> = { C: "#E14B4B", D: "#F0975B", K: "#22D3EE" };

/** What the index does and does not claim, side by side. The pairing is
 *  the point: an index that only lists its strengths is marketing. */
const IS = [
  "A measurement of macroeconomic conditions, made comparable across countries",
  "A translation layer between official statistics and ordinary language",
  "Fully auditable — every formula, source and change is published",
  `Deliberately narrow: five indicators, three dimensions, ${MARKETS} economies, done properly`,
];

const IS_NOT = [
  "A forecast of anything",
  "A market or trading signal",
  "Investment advice",
  "Proprietary or exclusive data — every input is public",
  "A replacement for an economist",
];

export default function AboutPage() {
  return (
    <>
      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">ABOUT</p>
          <h1 className="headline" style={{ maxWidth: "22ch" }}>
            An index built to be <span className="hl-cyan">checked</span>, not trusted
          </h1>
          <p className="sub" style={{ maxWidth: "64ch" }}>
            Most published indices hand you a number and ask you to trust the brand. MMAI takes the opposite bet:
            every formula is published, every figure names its source, and any reader can reproduce a score by
            hand. One already has, working only from the published files and without being told the answer.
          </p>
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">WHAT IT MEASURES</p>
            <h2>Five official figures, three questions, one rank</h2>
            <p>
              Governments publish the data. MMAI makes it comparable — which is most of the work, and the part
              almost everyone gets wrong — then ranks today against {REF_N} market-years of the same {MARKETS}
              economies, {SPAN}. A score of 85 means better than 85% of that record. It is not a mark out of 100.
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
            The three are weighted equally — a stated convention, not a measured truth, and one of several judgment
            calls set out in full on the{" "}
            <Link href="/learn#topic-mmai" style={{ color: "var(--accent-2)" }}>Learn page</Link>.
          </p>
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">SCOPE</p>
            <h2>What it is, and what it is not</h2>
            <p>
              The second list matters more than the first. An index that names only its strengths is marketing, and
              the fastest way to lose a reader is to claim something it cannot show.
            </p>
          </div>

          <div className="signal-grid" style={{ marginTop: 18 }}>
            <div className="mmai-card">
              <div className="meta-label" style={{ color: "var(--status-live)" }}>What MMAI is</div>
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: "var(--t-small)", color: "var(--ink-soft)", lineHeight: 1.75 }}>
                {IS.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
            <div className="mmai-card">
              <div className="meta-label" style={{ color: "#F0975B" }}>What it is not</div>
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: "var(--t-small)", color: "var(--ink-soft)", lineHeight: 1.75 }}>
                {IS_NOT.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">HOW TO CHECK IT</p>
            <h2>Everything needed to disagree with it</h2>
          </div>

          <div className="signal-grid" style={{ marginTop: 18 }}>
            <div className="mmai-card">
              <div className="meta-label">The formulas</div>
              <p style={{ fontSize: "var(--t-small)", color: "var(--ink-soft)", margin: "8px 0 0", lineHeight: 1.7 }}>
                Published as equations, not described in prose, on the{" "}
                <Link href="/learn" style={{ color: "var(--accent-2)" }}>Learn page</Link>. Automated tests assert
                that what the site publishes still reproduces what the engine computes, so the page cannot drift
                from the arithmetic without the build failing.
              </p>
            </div>
            <div className="mmai-card">
              <div className="meta-label">The sources</div>
              <p style={{ fontSize: "var(--t-small)", color: "var(--ink-soft)", margin: "8px 0 0", lineHeight: 1.7 }}>
                Every input traces to a central bank or a national statistics agency, each with its licence terms
                recorded and reviewed. Listed on the{" "}
                <Link href="/sources" style={{ color: "var(--accent-2)" }}>Sources page</Link> with the date each
                figure refers to, so you can see exactly how fresh it is.
              </p>
            </div>
            <div className="mmai-card">
              <div className="meta-label">The changes</div>
              <p style={{ fontSize: "var(--t-small)", color: "var(--ink-soft)", margin: "8px 0 0", lineHeight: 1.7 }}>
                Every method change is logged with the old rule, the new rule, the reason, the evidence, the effect
                on every score, and how to roll it back. Including the ones that were embarrassing.
              </p>
            </div>
            <div className="mmai-card">
              <div className="meta-label">The judgment calls</div>
              <p style={{ fontSize: "var(--t-small)", color: "var(--ink-soft)", margin: "8px 0 0", lineHeight: 1.7 }}>
                Every index of this kind rests on choices no experiment settles — what inflation is worth against
                unemployment, above all. MMAI states its five, and measures what they actually do to the ranking.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="wrap" style={{ maxWidth: 720 }}>
          <div className="section-head">
            <p className="eyebrow">GET IN TOUCH</p>
            <h2>Every message is read personally</h2>
            <p>
              Requests, partnership enquiries, a correction, or a thought worth sharing. If you think something
              here is wrong, that is the most useful message you can send — the whole point of publishing the
              working is that someone can check it.
            </p>
          </div>
          <ContactForm />
        </div>
      </div>
    </>
  );
}
