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
