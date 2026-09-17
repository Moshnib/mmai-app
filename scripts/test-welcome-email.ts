// ============================================================
//  THE WELCOME EMAIL SAYS TRUE THINGS
//
//  Offline: it renders the message, it does not send one. The send path
//  itself is exercised by subscribing on the live site.
//
//  What this pins is what a person actually reads, and the one link that
//  has to work for someone who never signed up in the first place:
//
//    every market they chose is named, by NAME and never by code
//    the unsubscribe link is present, absolute, and carries the token
//    a person who did not sign up is told what to do
//    nothing renders as undefined, NaN or [object Object]
//
//    npx tsx scripts/test-welcome-email.ts
// ============================================================

import { welcomeHtml } from "@/lib/notify";
import { ALERT_FROM, MAIL_DOMAIN, SITE_URL } from "@/lib/siteUrl";
import { FALLBACK_MARKETS } from "@/lib/markets";

const failures: string[] = [];
function check(ok: boolean, what: string) {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}`);
  if (!ok) failures.push(what);
}

const TOKEN = "11111111-2222-3333-4444-555555555555";
const url = `${SITE_URL}/api/unsubscribe?token=${TOKEN}`;

for (const [label, names, isUpdate] of [
  ["one market, new subscriber", ["Japan"], false],
  ["every market, new subscriber", FALLBACK_MARKETS.map((m) => m.name), false],
  ["one market, watchlist updated", ["United Kingdom", "Sweden"], true],
] as Array<[string, string[], boolean]>) {
  console.log(`\n${label}`);
  const html = welcomeHtml(names, url, isUpdate);
  for (const name of names) check(html.includes(name), `names ${name}`);
  check(!/\b[A-Z]{2}\b(?![^<]*<\/a>)/.test(html.replace(/MMAI|RFC/g, "")), "shows no bare market codes");
  check(html.includes(url), "carries the unsubscribe link, with the token");
  check(html.includes("didn't sign up"), "tells someone who never signed up what to do");
  check(html.includes(isUpdate ? "watchlist was updated" : "You're on the list"), "uses the right heading");
  for (const junk of ["undefined", "NaN", "[object Object]", "null"]) {
    check(!html.includes(junk), `no "${junk}" anywhere`);
  }
}

// The route looks each stored CODE up in a name map and falls back to the
// code itself. This is what stops that fallback ever reaching a reader:
// if a market ever ships without a name, "KR" lands in somebody's inbox.
console.log("\nevery market has a name to show");
for (const m of FALLBACK_MARKETS) {
  check(typeof m.name === "string" && m.name.length > 2 && m.name !== m.code, `${m.code} is shown as "${m.name}"`);
}

console.log("\nthe sender");
check(ALERT_FROM.includes(`@${MAIL_DOMAIN}`), `sends from the verified domain (${ALERT_FROM})`);
check(!ALERT_FROM.includes("@www."), "never sends from the www form, which is not verified");

console.log("");
if (failures.length) {
  console.error(`${failures.length} problem(s):\n  ${failures.join("\n  ")}\n`);
  process.exit(1);
}
console.log("The welcome email reads correctly and can always be unsubscribed from.");
export {};
