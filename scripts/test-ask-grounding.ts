// ============================================================
//  THE ASSISTANT CAN ONLY BE AS HONEST AS ITS FACTS BLOCK
//
//  app/api/ask/route.ts forbids the model from using any figure that is
//  not in the block lib/askContext.ts builds. That instruction is only
//  worth something if the block actually contains what a reader will ask
//  about -- otherwise the model is pushed toward either refusing
//  everything or filling the gap from memory, which is the failure the
//  whole design exists to prevent.
//
//  So this checks the block, not the model: every market present, every
//  figure carrying the period it refers to, every licence named, and the
//  known gaps stated. It needs Supabase credentials and so is NOT in CI
//  -- same reason scripts/check-sources-live.ts is not.
//
//    npx tsx --env-file=.env.local scripts/test-ask-grounding.ts
// ============================================================

import { buildFactsBlock } from "@/lib/askContext";
import { FALLBACK_MARKETS } from "@/lib/markets";

async function main() {
  let fails = 0;
  const ok = (label: string, cond: boolean, detail = "") => {
    if (!cond) fails++;
    console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}${detail ? `   (${detail})` : ""}`);
  };

  const facts = await buildFactsBlock();

  console.log("\nEVERY MARKET IS IN THE BLOCK\n");
  for (const m of FALLBACK_MARKETS) {
    const mentions = facts.split(m.name).length - 1;
    ok(`${m.name} appears`, mentions >= 3, `${mentions} mentions`);
  }

  console.log("\nTHE SHAPE A READER DEPENDS ON\n");
  for (const section of [
    "WHAT MMAI IS",
    "TODAY'S SCORES",
    "LATEST PUBLISHED INDICATORS",
    "TEN-YEAR GOVERNMENT BOND YIELDS",
    "TWELVE-MONTH CHANGE",
    "WHERE EACH FIGURE COMES FROM",
    "KNOWN GAPS",
  ]) {
    ok(`section: ${section}`, facts.includes(section));
  }

  // A figure without its period invites the reader to assume it is today's.
  ok("indicators carry their reporting period", (facts.match(/\(period \d{4}-\d{2}-\d{2}\)/g) ?? []).length >= 20);
  ok("licences are named", facts.includes("Licence:"));
  ok("the not-investment-advice line is present", /not investment advice/i.test(facts));

  console.log("\nNOTHING MALFORMED LEAKS IN\n");
  // Each of these has actually appeared in a draft of this block.
  ok("no 'not published%'", !facts.includes("not published%"));
  ok("no undefined", !facts.includes("undefined"));
  ok("no NaN", !facts.includes("NaN"));
  ok("no null rendered as text", !/: null/.test(facts));

  console.log("\nTHE TRAPS ARE EXPLAINED, NOT LEFT FOR THE MODEL TO GUESS\n");
  ok("the US CPI/PCE split is stated", facts.includes("US INFLATION APPEARS TWICE"));
  ok("Sweden's missing bond yield is explained", /Sweden[\s\S]{0,200}Riksbank/.test(facts));
  ok("Japan's missing inflation history is explained", /Japan has no monthly inflation history/.test(facts));
  ok("the engine change is flagged", facts.includes("5 September 2026"));

  console.log("");
  if (fails > 0) {
    console.error(`${fails} check(s) failed.\n`);
    process.exit(1);
  }
  console.log(`The facts block is complete: ${facts.split("\n").length} lines, ${facts.length} characters.\n`);
}

main();
export {};
