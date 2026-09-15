// ============================================================
//  CAN THE PAGE BE READ, NAMED AND OPERATED?
//
//  Written after a sweep of all nine pages turned up defects that every
//  other check walked straight past:
//
//    - the two year pickers on /compare were unnamed <select> elements
//      with a bare "to" between them, so a screen reader announced two
//      identical combo boxes and no way to tell which end was which;
//    - Compare's "What stands out now" card sat at h3 directly under the
//      page's only h1, so the outline skipped a level.
//
//  Neither breaks a build, overflows a box or throws. They are only
//  visible if something asks the questions a reader's software asks.
//
//  CONTRAST IS MEASURED HERE RATHER THAN ASSERTED. The design audit said
//  contrast was clean and it was right -- but nothing re-checked it, and
//  a colour token changes in one commit while a claim like that goes
//  stale in the next.
//
//    npm run build && npx next start -p 3123 &
//    npx tsx scripts/check-accessibility.ts
// ============================================================

import { chromium } from "playwright";
import { SITE_PATHS } from "@/lib/routes";

const BASE = process.env.LAYOUT_TEST_URL ?? "http://localhost:3123";

/** WCAG AA: 4.5:1 for body text, 3:1 for large text. */
const NEEDS_NORMAL = 4.5;
const NEEDS_LARGE = 3;

// Passed to page.evaluate as a STRING so esbuild never transforms it.
// Named helpers inside a transformed evaluate body acquire a __name
// wrapper that does not exist in the browser, and the resulting error
// points at the evaluate call rather than at the helper. check-layout.ts
// avoids this by banning inner functions; a string body allows them,
// which is worth it for the luminance maths.
const PROBE = `(() => {
  var issues = [];

  var L = function (c) {
    var m = String(c).match(/[0-9.]+/g);
    if (!m || m.length < 3) return null;
    var v = [Number(m[0]), Number(m[1]), Number(m[2])].map(function (n) {
      var s = n / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };

  // ---- headings ----
  var hs = document.querySelectorAll("h1,h2,h3,h4,h5,h6");
  var h1 = 0, prev = 0;
  for (var i = 0; i < hs.length; i++) {
    var lvl = Number(hs[i].tagName[1]);
    if (lvl === 1) h1++;
    var label = (hs[i].textContent || "").trim().replace(/[ \\t\\n\\r]+/g, " ").slice(0, 34);
    if (!label) issues.push("heading: an empty heading element");
    if (prev && lvl > prev + 1) issues.push("heading: h" + prev + " jumps to h" + lvl + " at " + label);
    prev = lvl;
  }
  if (h1 !== 1) issues.push("heading: " + h1 + " h1 elements, want exactly 1");

  // ---- names on things you can operate ----
  document.querySelectorAll("button, a[href]").forEach(function (el) {
    if (el.getAttribute("aria-hidden") === "true") return;
    var n = (el.textContent || "").trim() || el.getAttribute("aria-label") || el.getAttribute("title") || "";
    if (!n) issues.push(el.tagName.toLowerCase() + ": no accessible name");
  });
  document.querySelectorAll("input, select, textarea").forEach(function (el) {
    // A honeypot is deliberately hidden from assistive tech and needs no name.
    if (el.getAttribute("aria-hidden") === "true") return;
    var id = el.getAttribute("id");
    var ok = (id && document.querySelector("label[for=" + JSON.stringify(id) + "]")) ||
      el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") ||
      el.closest("label") || el.getAttribute("placeholder");
    if (!ok) issues.push(el.tagName.toLowerCase() + ": no label, aria-label or placeholder");
  });

  // ---- images ----
  document.querySelectorAll("img").forEach(function (im) {
    if (!im.hasAttribute("alt")) issues.push("img: no alt attribute");
  });

  // ---- structure ----
  var mains = document.querySelectorAll("main").length;
  if (mains !== 1) issues.push("landmark: " + mains + " main elements, want exactly 1");
  if (!document.documentElement.lang) issues.push("html: no lang attribute");
  var seen = {};
  document.querySelectorAll("[id]").forEach(function (e) {
    seen[e.id] = (seen[e.id] || 0) + 1;
    if (seen[e.id] === 2) issues.push("id: " + e.id + " appears more than once");
  });

  // ---- contrast ----
  var els = document.querySelectorAll("p,span,li,a,button,h1,h2,h3,h4,td,th,dd,dt,strong,b,em,i");
  for (var k = 0; k < els.length; k++) {
    var el = els[k];
    if (el.children.length) continue;
    var t = (el.textContent || "").trim();
    if (!t || t.length < 2) continue;
    var cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.5) continue;
    var fgm = String(cs.color).match(/[0-9.]+/g);
    if (fgm && fgm.length > 3 && Number(fgm[3]) < 0.5) continue;

    // The nearest ancestor that actually paints something.
    var bg = "rgb(16, 24, 38)", e = el;
    while (e) {
      var c = getComputedStyle(e).backgroundColor;
      var mm = String(c).match(/[0-9.]+/g);
      if (mm && (mm.length < 4 || Number(mm[3]) > 0.85)) { bg = c; break; }
      e = e.parentElement;
    }

    var f = L(cs.color), g = L(bg);
    if (f === null || g === null) continue;
    var ratio = (Math.max(f, g) + 0.05) / (Math.min(f, g) + 0.05);
    var px = parseFloat(cs.fontSize);
    var large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    var need = large ? __LARGE__ : __NORMAL__;
    if (ratio < need) {
      issues.push("contrast " + ratio.toFixed(2) + ":1 needs " + need + " at " + Math.round(px) + "px on: " + t.slice(0, 28));
    }
  }

  // ---- focus ----
  // Disabled controls are correctly out of the tab order; the "Show all"
  // button on Gulf Watch is one, and flagging it is a false positive.
  var focusables = Array.prototype.slice.call(
    document.querySelectorAll("a[href],button,input,select,textarea,[tabindex]")
  ).filter(function (x) {
    return x.offsetParent !== null && !x.disabled && x.getAttribute("tabindex") !== "-1";
  }).slice(0, 25);
  focusables.forEach(function (x) {
    x.focus();
    if (document.activeElement !== x) { issues.push("focus: cannot focus " + x.tagName); return; }
    var s = getComputedStyle(x);
    var ring = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
    if (!ring && (s.boxShadow === "none" || !s.boxShadow)) {
      issues.push("focus: no visible indicator on " + x.tagName + "." + (String(x.className || "").split(" ")[0] || "-"));
    }
  });

  return issues.filter(function (v, i, a) { return a.indexOf(v) === i; });
})()`
  .replace("__LARGE__", String(NEEDS_LARGE))
  .replace("__NORMAL__", String(NEEDS_NORMAL));

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const findings: { page: string; detail: string }[] = [];

  console.log(`\nChecking ${SITE_PATHS.length} pages for naming, structure, contrast and focus\n`);

  for (const path of SITE_PATHS) {
    const page = await context.newPage();
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45_000 }).catch(() => {});
    // Client components render their own content after fetching; checking
    // before that measures a page no reader ever sees.
    await page.waitForTimeout(2_500);
    const issues = (await page.evaluate(PROBE)) as string[];
    console.log(`  ${issues.length === 0 ? "ok  " : "FAIL"}  ${path}`);
    for (const d of issues.slice(0, 8)) {
      console.log("          " + d);
      findings.push({ page: path, detail: d });
    }
    await page.close();
  }

  await context.close();
  await browser.close();

  console.log("");
  if (findings.length > 0) {
    console.error(`${findings.length} accessibility problem(s):\n`);
    for (const f of findings) console.error(`  ${f.page.padEnd(14)} ${f.detail}`);
    console.error("\nNone of these break a build or overflow a box. They are what a reader's");
    console.error("software runs into: an unnamed control, an outline with a level missing,");
    console.error("text too faint to read, or a focus ring that never appears.\n");
    process.exit(1);
  }

  console.log("Every page names its controls, keeps its outline, and meets WCAG AA contrast.\n");
}

main();
export {};
