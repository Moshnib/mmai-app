// ============================================================
//  WHICH GROUPS THE SOURCES PAGE SHOWS, IN ONE PLACE
//
//  app/sources/page.tsx renders these groups, and scripts/verify-sources.ts
//  checks against the SAME lists that every row in lib/sources.ts belongs
//  to one of them. Found on 19 September: the page grouped only "All
//  markets" and the scored markets, so Denmark's and Finland's source rows
//  sat in the registry for five days and never appeared on a page that
//  promises every source. A check with its own copy of the grouping
//  would only have tested the copy.
// ============================================================

import { FALLBACK_MARKETS } from "@/lib/markets";
import { OBSERVATORY } from "@/lib/observatory";

/** The scored table: shared rows first, then each scored market. */
export const SCORED_SOURCE_GROUPS: string[] = ["All markets", ...FALLBACK_MARKETS.map((m) => m.name)];

/** The Observatory table: tracked, not scored. */
export const OBSERVATORY_SOURCE_GROUPS: string[] = OBSERVATORY.map((c) => c.name);

export const OBSERVATORY_NAME_TO_CODE: Record<string, string> = Object.fromEntries(OBSERVATORY.map((c) => [c.name, c.code]));

/** Every `market` value lib/sources.ts may use and still be shown. */
export const RENDERED_SOURCE_MARKETS = new Set([...SCORED_SOURCE_GROUPS, ...OBSERVATORY_SOURCE_GROUPS]);
