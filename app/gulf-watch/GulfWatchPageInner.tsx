"use client";

import Link from "next/link";
import { useGulfIndicators } from "@/lib/useGulfIndicators";
import GulfCard from "@/components/GulfCard";
import GulfTrends from "@/components/GulfTrends";

export default function GulfWatchPageInner() {
  const { countries, loaded } = useGulfIndicators();

  // Counts of what's actually covered, read off the same rows the cards
  // render -- not a hardcoded claim that can drift out of date the way
  // this page's old "no policy-rate source exists for any of them"
  // intro did once BIS was wired in for Saudi Arabia and Kuwait.
  const glance = {
    withInflation: countries.filter((c) => c.cpiYoy != null).length,
    withPolicyRate: countries.filter((c) => c.policyRate != null).length,
  };

  return (
    <>
      <div className="section">
        <div className="wrap">
          <div className="page-head-row" style={{ marginBottom: 24 }}>
            <div className="section-head">
              <p className="eyebrow">GCC MACRO MONITOR</p>
              <h1>The Gulf, in the same detail as everywhere else</h1>
              <p style={{ maxWidth: "68ch" }}>
                Six economies that rarely appear side by side, with the figures their own governments publish —
                cost of living, investment activity, currency stability. Fetched daily and traced to their source on the{" "}
                <Link href="/sources" style={{ color: "var(--accent-2)" }}>Sources</Link> page, same as everywhere
                else on the site.
              </p>
            </div>

            {/* "The Gulf at a glance" (brief §16). Strictly a count of
                what is and isn't covered -- no regional commentary. */}
            <div className="insight-card">
              <h2>
                <span aria-hidden="true" style={{ color: "var(--accent-2)" }}>◈</span>
                The Gulf at a glance
              </h2>
              <ul>
                <li>
                  <i style={{ background: "var(--slate)" }} />
                  <span>{glance.withInflation} of {countries.length} report an inflation figure.</span>
                </li>
                <li>
                  <i style={{ background: "var(--accent-2)" }} />
                  <span>
                    {glance.withPolicyRate === 0
                      ? "No policy rate is currently available."
                      : `${glance.withPolicyRate} publish a central bank policy rate (Saudi Arabia and Kuwait via BIS, Qatar via the IMF).`}
                  </span>
                </li>
                <li>
                  <i style={{ background: "var(--slate)" }} />
                  <span>None carry an MMAI composite score — Gulf Watch shows raw indicators only.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Indicators come from different sources on different
              schedules, so each card carries its own per-figure period
              rather than one shared "as of" for the whole page. */}
          <p className="meta-label" style={{ marginBottom: 12 }}>
            GCC snapshot · each value shown with its own reporting period
          </p>

          <div className="compare-grid" style={{ opacity: loaded ? 1 : 0.5, transition: "opacity 0.3s ease" }}>
            {countries.map((c) => (
              <GulfCard key={c.code} country={c} />
            ))}
          </div>
        </div>
      </div>

      <GulfTrends />
    </>
  );
}
