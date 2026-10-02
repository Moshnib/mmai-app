import Link from "next/link";
import {
  latestWithChange, describeChange, formatPrice, formatPriceDay,
  type PricePoint,
} from "@/lib/commodityPrices";

// ============================================================
//  THE ONE PRICE ON THIS SITE THAT MOVES EVERY TRADING DAY
//
//  Everything else here is a statistic a government publishes monthly.
//  This is a market price, and it brings a rule the rest of the site
//  does not need: THE DATE IS PART OF THE FIGURE.
//
//  The EIA publishes Brent spot two to four days in arrears -- on 2
//  October 2026 the newest observation was 29 September. That is the
//  source's rhythm, not an outage. This project has twice shipped a
//  number that was correct and read as wrong (the Fed's target range
//  against the headline rate; a UTC timestamp read in the Gulf), and
//  both times the fix was to put the qualifier INSIDE the figure rather
//  than in grey underneath it. So the heading is "Brent crude, 29
//  September", never "Brent crude" with a date tucked below.
//
//  NO LIVE BAR AND NO BREATHING DOT. LiveBar means "the refresh ran",
//  and here that is a different fact from "this price is current" -- the
//  refresh can be perfectly healthy while the newest price is three days
//  old, because that is how the source works.
// ============================================================

/** Rendered on the server from the stored series. No points means the
 *  panel does not exist, rather than a panel reporting nothing. */
export default function OilPricePanel({ points }: { points: PricePoint[] }) {
  const reading = latestWithChange(points);
  if (!reading) return null;

  const change = describeChange(reading);
  const falling = (reading.absChange ?? 0) < 0;
  const recent = points.slice(-30);

  return (
    <section className="section" aria-labelledby="oil-heading">
      <div className="wrap">
        <p className="eyebrow">DAILY, UNLIKE EVERYTHING ELSE HERE</p>
        <h2 id="oil-heading">
          Brent crude, {formatPriceDay(reading.date, true)}
        </h2>

        <div className="oil-figure">
          <span className="oil-price">{formatPrice(reading.price)}</span>
          <span className="oil-unit">per barrel</span>
          {change && (
            <span className={`oil-change${falling ? " is-down" : " is-up"}`}>{change}</span>
          )}
        </div>

        {reading.stale ? (
          // The source has gone quiet for longer than its own lag. Say
          // that, rather than keep showing a price as though it were the
          // current one.
          <p className="oil-note">
            No new price has been published since {formatPriceDay(reading.date, true)}. The figure above is
            the last one the EIA released.
          </p>
        ) : (
          <p className="oil-note">
            The U.S. Energy Information Administration publishes this spot price about three days in
            arrears, so the most recent figure is never today&apos;s. It is the European benchmark —
            the one Gulf producers are priced against.
          </p>
        )}

        {recent.length > 2 && <OilChart points={recent} />}

        <p className="oil-source">
          Source: U.S. Energy Information Administration, Europe Brent Spot Price FOB (series RBRTE).
          Public domain. <Link href="/sources">All sources and licences</Link>.
        </p>
      </div>
    </section>
  );
}

/** A plain line of the last thirty trading days.
 *
 *  Hand-drawn SVG rather than the chart library: thirty points, one
 *  series, no axes and no interaction. The alternative pulls in Recharts
 *  on a page that would otherwise not need it.
 *
 *  aria-hidden, with the numbers that matter stated in the text above --
 *  a shape is not a figure, and a screen reader is owed the figure. */
function OilChart({ points }: { points: PricePoint[] }) {
  const W = 640, H = 120, PAD = 6;
  const prices = points.map((p) => p.price);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const span = hi - lo || 1;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - lo) / span) * (H - PAD * 2);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ");
  const falling = points[points.length - 1].price < points[0].price;

  return (
    // The colour comes from the class, not from an inline value: the same
    // two the ticker uses for a rise and a fall, so the site has one
    // vocabulary for direction (scripts/check-palette.ts enforces that
    // nothing new creeps in).
    <div className={`oil-chart${falling ? " is-down" : " is-up"}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2"
          vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="oil-chart-ends">
        <span>{formatPriceDay(points[0].date)} · {formatPrice(points[0].price)}</span>
        <span>{formatPriceDay(points[points.length - 1].date)} · {formatPrice(points[points.length - 1].price)}</span>
      </div>
    </div>
  );
}
