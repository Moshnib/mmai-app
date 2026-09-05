"use client";

// ============================================================
// Shared time-range control for every chart on the site.
//
// Built as one component rather than three because the site owner asked
// for range controls on ALL charts, and three hand-rolled versions would
// drift in behaviour and appearance the first time one was edited.
//
// It renders the same chips as the existing country filters
// (.country-chip), so a reader sees one interaction pattern: chips to
// narrow WHAT is shown, chips to narrow WHEN.
//
// Deliberately unopinionated about the data. It reports a chosen span in
// DAYS (or null for "all"), and the caller filters. A chart of daily bond
// yields and a chart of annual scores need very different presets, and
// baking either set in here would make it wrong for the other.
// ============================================================

export interface TimeRangeOption {
  /** Chip text, e.g. "3M" or "5Y". */
  label: string;
  /** Span in days, or null for the full history. */
  days: number | null;
}

/** Presets for a DAILY series -- the bond panel. */
export const DAILY_RANGES: TimeRangeOption[] = [
  { label: "1M", days: 31 },
  { label: "3M", days: 92 },
  { label: "6M", days: 183 },
  { label: "1Y", days: 366 },
  { label: "All", days: null },
];

/** Presets for an ANNUAL series -- Trends and the score charts. */
export const ANNUAL_RANGES: TimeRangeOption[] = [
  { label: "3Y", days: 3 * 366 },
  { label: "5Y", days: 5 * 366 },
  { label: "All", days: null },
];

export default function TimeRangeFilter({
  options,
  selected,
  onChange,
  label = "RANGE",
}: {
  options: TimeRangeOption[];
  /** The currently chosen span, matched on `days`. */
  selected: number | null;
  onChange: (days: number | null) => void;
  label?: string;
}) {
  return (
    <div className="country-filter" style={{ alignItems: "center" }}>
      <span
        style={{
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: 11,
          letterSpacing: "0.1em",
          color: "var(--slate)",
          marginRight: 2,
        }}
      >
        {label}
      </span>
      {options.map((o) => {
        const on = o.days === selected;
        return (
          <button
            key={o.label}
            type="button"
            className={`country-chip${on ? " on" : ""}`}
            aria-pressed={on}
            onClick={() => onChange(o.days)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Keeps only the points inside the chosen span.
 *
 *  Measured back from the NEWEST date present, not from today: a source
 *  that stopped publishing a fortnight ago should still fill a "1M" view
 *  rather than render an empty chart, which would read as breakage
 *  instead of staleness. */
export function withinRange<T>(
  rows: T[],
  isoDateOf: (row: T) => string,
  days: number | null
): T[] {
  if (days == null || rows.length === 0) return rows;
  const newest = rows.reduce((max, r) => (isoDateOf(r) > max ? isoDateOf(r) : max), isoDateOf(rows[0]));
  const cutoff = new Date(Date.parse(newest) - days * 86_400_000).toISOString().slice(0, 10);
  return rows.filter((r) => isoDateOf(r) >= cutoff);
}
