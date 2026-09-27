// A market/country whose last successful write is older than this is
// treated as currently broken, not "a bit behind" -- daily refresh cadence
// means anything past a couple of missed days is a real problem, not
// normal publication lag (that's a different, already-accepted thing:
// annual sources like World Bank GDP figures naturally carry old
// observation dates while still refreshing successfully every day).
//
// Previously defined separately in app/page.tsx and inline in
// components/GulfCard.tsx -- hoisted here so both scored markets and
// Gulf Watch countries use the exact same threshold from one place.
export const STALE_THRESHOLD_MS = 72 * 60 * 60 * 1000; // 72 hours

// WHEN THE SITE SAYS "LATE", as opposed to when it HIDES figures.
//
// STALE_THRESHOLD_MS above decides what gets blanked to N/A, and must stay
// generous: it is measured against the last COMPLETE reading, which is
// already a day old whenever one source fails for a day. This one only
// WARNS. The refresh runs up to six times a day, so nothing written for 30
// hours means a whole day of runs failed. From 16 to 19 September nothing
// was written at all, and the site, reading only the 72-hour value, kept
// saying LIVE for three days. Used by the homepage LIVE bar, the footer,
// the change feed and app/api/watchdog.
export const REFRESH_OVERDUE_MS = 30 * 60 * 60 * 1000; // 30 hours
