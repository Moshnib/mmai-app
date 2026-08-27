"use client";

import Link from "next/link";
import { useGulfIndicators } from "@/lib/useGulfIndicators";
import GulfCard from "@/components/GulfCard";
import GulfTrends from "@/components/GulfTrends";

export default function GulfWatchPageInner() {
  const { countries, loaded } = useGulfIndicators();

  return (
    <>
      <div className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">SIX MORE COUNTRIES, SHOWN HONESTLY</p>
            <h1>Gulf Watch</h1>
            <p style={{ maxWidth: "68ch" }}>
              UAE, Bahrain, Qatar, Saudi Arabia, Kuwait, and Oman — real, live data on cost of living, investment
              confidence, and currency stability. None of these six get an MMAI composite score: a usable policy-rate
              source doesn&apos;t exist for any of them yet, and MMAI would rather show &quot;N/A&quot; than a score
              built on a gap. Every figure below is fetched daily and traced back to its source on the{" "}
              <Link href="/sources" style={{ color: "var(--gold-deep)" }}>Sources</Link> page, same as everywhere
              else on the site.
            </p>
          </div>

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
