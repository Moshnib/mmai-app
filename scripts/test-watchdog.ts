// ============================================================
//  THE WATCHDOG BARKS WHEN, AND ONLY WHEN, THE DATA HAS STOPPED
//
//  16–19 September 2026: nothing written for three days, nobody told.
//  app/api/watchdog now emails the owner. Two ways it can fail, and
//  neither throws:
//
//    silent when it should bark   one dead market hidden behind live ones,
//                                 or a market with no reading at all
//    barking when it should not   a normal overnight gap read as an outage,
//                                 which trains the owner to ignore it
//
//  Fixtures, pinned clock, no network.
//
//    npx tsx scripts/test-watchdog.ts
// ============================================================

import { assess, message, ACTIONS_URL, WATCHDOG_OVERDUE_MS } from "@/lib/watchdog";

let failed = false;
const fail = (m: string) => { failed = true; console.error("  FAIL  " + m); };
const ok = (m: string) => console.log("  ok    " + m);

const NOW = Date.parse("2026-09-19T15:30:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const w = (name: string, h: number | null, group = "scored") => ({ name, group, newest: h == null ? null : hoursAgo(h) });
const LIMIT_H = WATCHDOG_OVERDUE_MS / 3_600_000;

// ---------- a normal day ----------
{
  // At the 15:30 check, the 12:00 run landed 3.5 h ago; if it was slow,
  // the 06:10 one 9 h ago. Either is a normal day.
  const v = assess([w("United States", 3.5), w("Japan", 9), w("Oman", 9, "Gulf Watch")], NOW);
  if (v.overdue.length !== 0) fail(`a normal day raised an alarm: ${v.overdue.map((o) => o.name).join(", ")}`);
  else ok("readings from this morning are not an outage");
}

// ---------- the September outage ----------
{
  const v = assess(["United States", "Euro Area", "Japan"].map((n) => w(n, 69)), NOW);
  if (v.overdue.length !== 3) fail(`three markets 69 h old, ${v.overdue.length} reported`);
  else ok("every market three days old is reported, each by name");
}

// ---------- one dead market among live ones ----------
// A table's newest row stays fresh while any market still writes. This
// is why the check is per market.
{
  const v = assess([w("United States", 5), w("Euro Area", LIMIT_H + 10), w("Japan", 5)], NOW);
  if (v.overdue.length !== 1 || v.overdue[0].name !== "Euro Area") fail(`one dead market among live ones: ${JSON.stringify(v.overdue)}`);
  else ok("one market that stopped is caught even while the others keep writing");
}

// ---------- no reading at all ----------
{
  const v = assess([w("Denmark", null, "Observatory"), w("Finland", 3, "Observatory")], NOW);
  if (v.overdue.length !== 1 || v.overdue[0].hours !== null) fail("a country with no reading at all was not reported");
  else ok("a country with no reading at all is the worst case, not a skip");
}

// ---------- the edge ----------
{
  const inside = assess([w("Sweden", LIMIT_H - 1)], NOW).overdue.length;
  const outside = assess([w("Sweden", LIMIT_H + 1)], NOW).overdue.length;
  if (inside !== 0 || outside !== 1) fail(`the ${LIMIT_H}-hour line is not where it should be: ${inside}/${outside}`);
  else ok(`${LIMIT_H - 1} hours is fine, ${LIMIT_H + 1} hours is late`);
}

// ---------- the message is something a person can act on ----------
{
  const v = assess([w("United States", 69), w("Oman", null, "Gulf Watch"), w("Japan", 5)], NOW);
  const m = message(v, NOW);
  const need = ["United States", "69 hours", "Oman", "no reading at all", ACTIONS_URL];
  const missing = need.filter((s) => !m.text.includes(s));
  if (missing.length) fail(`the alert leaves out: ${missing.join(", ")}`);
  else if (m.text.includes("Japan")) fail("the alert names a market that is fine");
  else if (!/2 of 3/.test(m.subject)) fail(`the subject does not say how many: "${m.subject}"`);
  else ok(`the alert names what is late, how late, and where to look: "${m.subject}"`);
}
{
  const m = message(assess([w("Japan", 5)], NOW), NOW);
  if (!/test/i.test(m.subject) || !/current/i.test(m.subject)) fail(`the all-clear test message reads like an alarm: "${m.subject}"`);
  else ok("the test message says all is well, and says it is a test");
}

console.log("");
if (failed) {
  console.error("The watchdog would stay quiet through an outage, or bark at nothing.\n");
  process.exit(1);
}
console.log("Late markets are named; a normal day is quiet.\n");
