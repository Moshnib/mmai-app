"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  latestWithChange, describeChange, formatPrice, formatPriceDay,
  type PricePoint,
} from "@/lib/commodityPrices";
import { readCommoditySeries, BRENT_SPOT_DAILY } from "@/lib/commodityPricesRead";

// ============================================================
//  ONE LINE ON THE HOMEPAGE: WHAT MOVED
//
//  The site's own owner, 2 October 2026: "oil price went insane, gold
//  dropped, everyone watching, nothing in this website is helpful." The
//  diagnosis was structural -- every figure here is published monthly by
//  a statistics office, so on a day the world moves the homepage has
//  nothing to say.
//
//  This is the smallest honest answer to that: one row saying what the
//  oil price is and what it moved from. The full panel with its chart
//  lives on /trends, which is already where the daily series live (the
//  bond yields are there under "unlike every other figure on this page,
//  it moves every trading day"). Putting a second card on the homepage
//  would push the market picker further down a page whose owner has
//  complained twice about scrolling.
//
//  WHERE IT SITS matters: directly below the market picker, ABOVE the
//  gate where the page starts depending on a chosen market. Oil is
//  global -- it is not a fact about the United States -- so it must not
//  sit inside a section that only exists once a country is chosen.
//
//  THE HEIGHT IS RESERVED IN CSS. The price arrives from a query after
//  first paint, and without a fixed height everything below it would
//  jump the moment it lands.
// ============================================================

export default function OilLine() {
  const [points, setPoints] = useState<PricePoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    readCommoditySeries(BRENT_SPOT_DAILY, 45).then((p) => {
      if (!cancelled) setPoints(p);
    });
    return () => { cancelled = true; };
  }, []);

  const reading = points ? latestWithChange(points) : null;

  // THREE STATES, NOT TWO, and the difference between the last two is
  // the one worth having.
  //
  //  still asking   hold the space the row is about to need, so nothing
  //                 below it jumps when the price lands a moment later
  //  nothing to show  take no space at all. The table is created by a
  //                 hand-run migration, so "no price" is the state this
  //                 ships in until that SQL is pasted -- and a permanent
  //                 blank gap under the market picker is exactly the
  //                 homepage furniture this site's owner keeps asking to
  //                 be rid of. Better a one-off collapse on a page that
  //                 has no price than a hole on every page for ever.
  //  a price        the row, with its rules.
  if (points === null) return <div className="oil-line-slot" aria-hidden="true" />;
  if (!reading) return null;

  const change = describeChange(reading);
  const direction = reading.absChange == null || reading.absChange === 0 ? "" : reading.absChange < 0 ? " is-down" : " is-up";

  return (
    <div className="oil-line-slot">
      <div className="oil-line">
        <span>Brent crude</span>
        <span aria-hidden="true">·</span>
        {/* THE DATE IS PART OF THE FIGURE, not a caption under it. The EIA
            publishes two to four days late, so a price shown without its
            day will be read as today's and be wrong by three. */}
        <span>{formatPriceDay(reading.date)}</span>
        <span aria-hidden="true">·</span>
        <b>{formatPrice(reading.price)}</b>
        {change && <span className={direction.trim()}>{change}</span>}
        {/* SHORT ON PURPOSE: the stale line has to fit the same reserved
            slot as the normal one, and "no newer price published" pushed
            it to a fourth line on a phone -- a shift in the degraded
            state, which is where an unexplained jump is least welcome. */}
        {reading.stale && <span>· none newer</span>}
        {/* THE CREDIT TRAVELS WITH THE FIGURE. The EIA's terms are public
            domain with citation requested, and this project's own
            migration comment says attribution belongs wherever the price
            is shown -- a rule it would otherwise assert and then break on
            the most-read page of the site. */}
        <span className="oil-line-src">EIA</span>
        <Link href="/trends#oil-heading">the month →</Link>
      </div>
    </div>
  );
}
