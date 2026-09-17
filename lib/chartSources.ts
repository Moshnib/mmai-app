import { SITE_URL } from "@/lib/siteUrl";

// ============================================================
//  CREDIT LINES FOR DOWNLOADED CHARTS
//
//  Written into the footer of a downloaded image and the end of a
//  downloaded CSV (components/ChartDownload.tsx). Each says who published
//  the numbers, in the form their terms ask for. None of them claims a
//  licence for the downloaded file itself.
// ============================================================

/** Scores are MMAI's own arithmetic on official figures; the figures'
 *  institutions and terms are listed per source on /sources. */
export const SCORE_SOURCE = [
  `MMAI scores, calculated by MMAI from official statistics. Each underlying source and its terms: ${SITE_URL}/sources`,
];

/** Raw indicators as published by each institution. */
export const INDICATOR_SOURCE = [
  `Official statistics as published by each national institution and collected by MMAI. Each source and its terms: ${SITE_URL}/sources`,
];

/** The six daily ten-year curves. Their institutions are NOT listed on
 *  /sources (that page carries only the Eurostat monthly yields), so the
 *  credit lines are spelled out here, with the set statement the Open
 *  Government Licence requires and the "processed" note CC BY 4.0 and
 *  Japan's Public Data License 1.0 ask for. Licences verified in the
 *  header of lib/fetchers/bondYields.ts. */
export const BOND_SOURCE = [
  "US Treasury, Daily Treasury Par Yield Curve Rates",
  "Bank of England. Contains public sector information licensed under the Open Government Licence v3.0",
  "European Central Bank, euro area AAA government bond yield curve (ECB Data Portal)",
  "Bank of Canada, Valet API",
  "Reserve Bank of Australia, statistical table F2, licensed under CC BY 4.0; data processed by MMAI",
  "Ministry of Finance Japan, JGB interest rates, Public Data License 1.0; data processed by MMAI",
];

/** Token supply is read by MMAI straight from the Ethereum ledger. */
export const STABLECOIN_SOURCE = ["Token supply read directly from the Ethereum blockchain by MMAI"];

/** Gulf Watch figures; every source and its terms are on /sources. */
export const GULF_SOURCE = [
  `Gulf Watch figures as published by each institution and collected by MMAI. Each source and its terms: ${SITE_URL}/sources`,
];
