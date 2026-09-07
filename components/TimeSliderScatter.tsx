"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface TimeSlicePoint {
  x: number;
  y: number;
}

export interface TimeSliderSeriesData {
  key: string;
  name: string;
  color: string;
  byYear: Map<string, TimeSlicePoint>;
}

const PLAY_INTERVAL_MS = 900;

function scaleLinear(v: number, domainMin: number, domainMax: number, rangeMin: number, rangeMax: number): number {
  if (domainMax === domainMin) return (rangeMin + rangeMax) / 2;
  return rangeMin + ((v - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin);
}

/** Replaces the earlier trail-line scatter (RelationshipScatter): a site
 *  owner review found the connecting lines genuinely unclear ("what are
 *  the line charts on the scatter plots??") and asked for exactly this
 *  instead -- a slider that scrubs through years, one dot per series per
 *  year, no lines. Confirmed against real Gulf Watch data before this was
 *  built: the axis domain is fixed across ALL years (not just the current
 *  one) so the chart doesn't jump around as you scrub, which also means a
 *  series with a much larger range (e.g. Saudi Arabia's FX reserves vs.
 *  Bahrain's) visibly dominates one axis -- an honest property of the
 *  real data, not something this component tries to hide. */
export default function TimeSliderScatter({
  series,
  years,
  xLabel,
  yLabel,
  height = 380,
}: {
  series: TimeSliderSeriesData[];
  years: string[];
  xLabel: string;
  yLabel: string;
  height?: number;
}) {
  // Default to the most recent year with the MOST series present, not
  // simply the chronologically last one -- series often end on different
  // real dates (confirmed live: Gulf Watch's last year, 2025, has only
  // half its countries; 2024 has all 6), and landing on a mostly-empty
  // frame is exactly the "looks broken" complaint this component exists
  // to fix. Ties go to the more recent year (>= keeps advancing bestIdx
  // forward through the ascending array). Only runs once at mount --
  // yearIndex is user-owned state after that, same as any slider.
  const [yearIndex, setYearIndex] = useState(() => {
    if (years.length === 0) return 0;
    let bestIdx = years.length - 1;
    let bestCount = -1;
    years.forEach((y, i) => {
      const count = series.filter((s) => s.byYear.has(y)).length;
      if (count >= bestCount) {
        bestCount = count;
        bestIdx = i;
      }
    });
    return bestIdx;
  });
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Measured so the SVG's viewBox can match its own rendered width --
  // see the note beside W below. null until the first measurement, so
  // the server render and the first client render agree.
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const read = () => setMeasuredWidth(Math.round(el.getBoundingClientRect().width));
    read();
    // Rotating a phone or opening a sidebar changes this, and a viewBox
    // left at the old width would start scaling again.
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Clamped at render time, not via a setState-in-effect -- `years` can
  // change size (e.g. data arrives after mount) and the raw yearIndex
  // state should never be corrected out from under a resize/scrub the
  // user is mid-interacting with, just read safely wherever it's used.
  const safeYearIndex = Math.min(yearIndex, Math.max(0, years.length - 1));

  useEffect(() => {
    if (!playing) return;
    intervalRef.current = setInterval(() => {
      setYearIndex((i) => (i >= years.length - 1 ? 0 : i + 1));
    }, PLAY_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, years.length]);

  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    const allX: number[] = [];
    const allY: number[] = [];
    series.forEach((s) => s.byYear.forEach((p) => { allX.push(p.x); allY.push(p.y); }));
    if (allX.length === 0) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
    const rawXMin = Math.min(...allX), rawXMax = Math.max(...allX);
    const rawYMin = Math.min(...allY), rawYMax = Math.max(...allY);
    const xPad = (rawXMax - rawXMin) * 0.1 || 1;
    const yPad = (rawYMax - rawYMin) * 0.1 || 1;
    // Only clamp the padded floor at 0 when the real data never goes
    // negative (e.g. FX reserves in months) -- a quantity that's
    // genuinely signed (policy rates: Japan's real minimum is -0.5) must
    // keep its padding, or a real negative value would render as if it
    // were zero.
    const paddedYMin = rawYMin - yPad;
    return { xMin: rawXMin - xPad, xMax: rawXMax + xPad, yMin: rawYMin >= 0 ? Math.max(0, paddedYMin) : paddedYMin, yMax: rawYMax + yPad };
  }, [series]);

  if (years.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--slate)" }}>Not enough overlapping years yet to compare.</p>;
  }

  const currentYear = years[safeYearIndex];

  // THE VIEWBOX IS THE RENDERED WIDTH, so the SVG never scales.
  //
  // This was a fixed `W = 900` on an SVG set to width:100%. Inside a
  // phone-width card that is a scale factor of 0.32, and an SVG scales
  // its TEXT along with everything else: the 10px axis labels came out
  // at 3.2px on a 390px screen. Measured, not estimated. Nothing on the
  // site is readable at 3.2px, and the layout check could not see it
  // because the chart fitted its box perfectly -- it was legible-looking
  // and unreadable.
  //
  // Matching the viewBox to the measured container width makes the
  // scale exactly 1 at every size, so a font-size in this file is the
  // font-size on screen. The layout maths is already parametric on W,
  // so nothing else has to change.
  //
  // 900 stays as the pre-measurement default so the server and the
  // first client render agree; the observer corrects it on mount.
  const W = Math.max(measuredWidth ?? 900, 300);
  const H = height;
  const PAD_L = 54;
  const PAD_R = 20;
  const PAD_T = 16;
  const PAD_B = 40;
  const px = (v: number) => scaleLinear(v, xMin, xMax, PAD_L, W - PAD_R);
  const py = (v: number) => scaleLinear(v, yMin, yMax, H - PAD_B, PAD_T);

  const xTicks = [Math.ceil(xMin * 10) / 10, (xMin + xMax) / 2, Math.floor(xMax * 10) / 10];
  // Printed to 1 decimal, matching xTicks -- rounding to a whole number
  // (toFixed(0)) drew a gridline at the real value (e.g. 2.4) labeled
  // with a different one ("2"), which is a wrong-by-0.4 reading on an
  // axis a visitor is meant to eyeball a dot's position against.
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  const missing: string[] = [];
  series.forEach((s) => { if (!s.byYear.has(currentYear)) missing.push(s.name); });

  function togglePlay() {
    setPlaying((p) => !p);
  }

  function handleSliderChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPlaying(false);
    setYearIndex(Number(e.target.value));
  }

  return (
    <div>
      {/* Wraps rather than overflowing. The play button, the track and
          the year need about 130px of fixed width between them, so on a
          very narrow phone the year was pushed past the card edge.
          Letting it drop to a second line costs one row of height and
          keeps every control reachable. */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <button
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          style={{
            width: 34, height: 34, borderRadius: "50%", border: "1px solid var(--hair)",
            background: "rgba(34,211,238,0.1)", color: "var(--accent)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontSize: 13,
          }}
        >
          {playing ? "❙❙" : "▶"}
        </button>
        {/* minWidth 0: a flex item keeps min-width:auto, and a range
            input has an intrinsic minimum width the browser will not go
            below. Without this the track refused to shrink on a phone and
            pushed the year label 3px past the viewport, which is small
            enough to look like nothing and still gives the whole page a
            horizontal scrollbar. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            type="range"
            min={0}
            max={years.length - 1}
            step={1}
            value={safeYearIndex}
            onChange={handleSliderChange}
            aria-label="Year"
            aria-valuetext={currentYear}
            style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer" }}
          />
          {/* One tick per year. Eight of them do not fit on a very narrow
              phone, and space-between cannot shrink text, so they spilled
              out of the card. Below 640 only the first and last survive --
              the year being scrubbed to is already displayed large beside
              the slider, so the ticks in between are orientation rather
              than information. */}
          <div className="scrub-years">
            {years.map((y, i) => (
              <span key={y} style={i === safeYearIndex ? { color: "var(--accent)", fontWeight: 700 } : undefined}>{y}</span>
            ))}
          </div>
        </div>
        <div style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 21, color: "var(--accent)", minWidth: 56, textAlign: "center", flex: "none" }}>
          {currentYear}
        </div>
      </div>

      <div ref={plotRef}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {xTicks.map((t) => (
          <g key={`x-${t}`}>
            <line x1={px(t)} y1={PAD_T} x2={px(t)} y2={H - PAD_B} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <text x={px(t)} y={H - PAD_B + 16} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={10} fill="var(--slate)">{t.toFixed(1)}</text>
          </g>
        ))}
        {yTicks.map((t) => (
          <g key={`y-${t}`}>
            <line x1={PAD_L} y1={py(t)} x2={W - PAD_R} y2={py(t)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <text x={PAD_L - 8} y={py(t) + 3} textAnchor="end" fontFamily="IBM Plex Mono, monospace" fontSize={10} fill="var(--slate)">{t.toFixed(1)}</text>
          </g>
        ))}
        <text x={(PAD_L + W - PAD_R) / 2} y={H - 6} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={11} fill="var(--slate)">{xLabel}</text>
        <text x={14} y={(PAD_T + H - PAD_B) / 2} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={11} fill="var(--slate)" transform={`rotate(-90, 14, ${(PAD_T + H - PAD_B) / 2})`}>{yLabel}</text>

        {series.map((s) => {
          const point = s.byYear.get(currentYear);
          if (!point) return null;
          const cx = px(point.x);
          const cy = py(point.y);
          return (
            <g key={s.key}>
              <circle cx={cx} cy={cy} r={10} fill="none" stroke={s.color} strokeWidth={1.3} opacity={0.45} style={{ transition: "cx 0.35s cubic-bezier(.2,.7,.3,1), cy 0.35s cubic-bezier(.2,.7,.3,1)" }} />
              <circle cx={cx} cy={cy} r={6.5} fill={s.color} stroke="#08080D" strokeWidth={2} style={{ transition: "cx 0.35s cubic-bezier(.2,.7,.3,1), cy 0.35s cubic-bezier(.2,.7,.3,1)" }}>
                <title>{`${s.name} — ${currentYear}: ${xLabel} ${point.x.toFixed(1)}, ${yLabel} ${point.y.toFixed(1)}`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
      </div>

      {/* The SVG circles are decorative (no role, no focusable target --
          177 country-path lesson from the map redesign doesn't apply
          here, but the same "does the number reach assistive tech" trap
          does). This legend is the one place the real x/y values for the
          current year are readable as text, not just visible as a dot
          position. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: 14, fontFamily: "IBM Plex Mono, monospace", fontSize: 12 }}>
        {series.map((s) => {
          const point = s.byYear.get(currentYear);
          return (
            <span key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, color: point ? "var(--ink)" : "var(--slate)" }}>
              <i style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, opacity: point ? 1 : 0.25, flex: "none" }} />
              {s.name}
              {point && <span style={{ color: "var(--slate)" }}>({point.x.toFixed(1)}, {point.y.toFixed(1)})</span>}
            </span>
          );
        })}
      </div>

      {missing.length > 0 && (
        <p style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "var(--slate)", marginTop: 10 }}>
          No {currentYear} reading yet for: {missing.join(", ")} — their dot is hidden rather than guessed at.
        </p>
      )}
    </div>
  );
}
