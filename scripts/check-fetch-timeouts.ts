// ============================================================
//  EVERY CALL TO AN OUTSIDE SOURCE MUST BE ABLE TO GIVE UP
//
//  Node's fetch has NO default timeout. A source that accepts the
//  connection and then stops talking is not a slow request — it is a
//  request that never ends, and `await` on it never returns.
//
//  WHAT THAT COSTS HERE, measured rather than imagined. On 2026-09-10
//  Statistics Canada was answering intermittently: three identical
//  curls returned 200 in 10.7s, nothing at all in 45s, and 502 in 35s.
//  Against that, our own fetchers timed as:
//
//      CA inflation      27,327ms   eventually succeeded
//      CA unemployment    8,016ms   gave up — it HAD a timeout
//      CA GDP           148,919ms   two and a half minutes, then 500
//
//  /api/refresh runs the four fetches for a market together and then
//  walks the markets one after another, inside a function capped at 60
//  seconds. The 149-second call cannot finish inside that budget, so the
//  function is killed part-way and every market after Canada is never
//  written at all. The one call that behaved was the one with a timeout.
//
//  Twenty-five call sites across sixteen files had none. The convention
//  was adopted partway through the project and never backfilled, which
//  is precisely the kind of gap nothing notices: a fetcher without a
//  timeout looks identical to one with a timeout on every day the source
//  is healthy.
//
//  Runs in CI. Needs no network and no keys — it reads the source.
//
//    npx tsx scripts/check-fetch-timeouts.ts
// ============================================================

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "lib", "fetchers");

/** Where the call's own options object ends, starting from the `(` of
 *  `fetch(`. Brace-counted rather than regexed, because these calls
 *  carry nested objects (`next: { revalidate: 0 }`), JSON bodies, and
 *  arrays — a non-greedy match to the first `}` stops in the wrong
 *  place and a greedy one runs off the end of the function. */
function callEnd(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return src.length;
}

const offenders: string[] = [];
let checked = 0;

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".ts"))) {
  const src = readFileSync(join(DIR, file), "utf8");
  const marker = "fetch(";

  for (let at = src.indexOf(marker); at !== -1; at = src.indexOf(marker, at + 1)) {
    // Skip identifiers that merely END in "fetch(" — fetchJson(,
    // prefetch(, etc. Only a bare `fetch(` is the global.
    const prev = src[at - 1];
    if (prev && /[A-Za-z0-9_$.]/.test(prev)) continue;

    const open = at + marker.length - 1;
    const body = src.slice(open, callEnd(src, open) + 1);
    checked++;

    if (!body.includes("AbortSignal.timeout") && !body.includes("signal:")) {
      const line = src.slice(0, at).split("\n").length;
      offenders.push(`lib/fetchers/${file}:${line}`);
    }
  }
}

console.log(`\nChecked ${checked} fetch call(s) across lib/fetchers\n`);

if (offenders.length > 0) {
  console.error(`${offenders.length} call(s) to an outside source with no timeout:\n`);
  for (const o of offenders) console.error(`  ${o}`);
  console.error("\nNode's fetch waits forever by default. The refresh runs inside a");
  console.error("60-second function, so one source that accepts a connection and then");
  console.error("goes quiet kills the run and every market after it goes unwritten.");
  console.error("\nAdd `signal: AbortSignal.timeout(8000)` to the options object —");
  console.error("8000 on the scored-market path, 15000 for the slower Gulf sources.\n");
  process.exit(1);
}

console.log("Every fetcher can give up on a source that stops answering.\n");
export {};
