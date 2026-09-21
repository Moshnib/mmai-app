// ============================================================
//  EVERY PAGE SHARES WITH ITS PICTURE
//
//  Until 21 September 2026 only the homepage's link preview carried the
//  MMAI card. Every other page set its own openGraph through
//  lib/pageMetadata.ts, which replaces the root's whole, picture included
//  (lib/ogImage.ts). Nothing on the site looked wrong; a shared /trends link
//  just arrived as bare text.
//
//  Two things are pinned: the helper names the picture for both card kinds,
//  and no page builds its metadata some other way that would skip it.
//
//  Run: npx tsx scripts/test-page-metadata.ts
// ============================================================

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pageMetadata } from "../lib/pageMetadata";
import { OG_IMAGE_PATH, OG_SIZE } from "../lib/ogImage";

let failures = 0;
function check(ok: boolean, label: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures++;
}

type Img = { url?: unknown; width?: unknown; height?: unknown; alt?: unknown };
function firstImage(images: unknown): Img | undefined {
  return Array.isArray(images) ? (images[0] as Img) : undefined;
}

const meta = pageMetadata({ title: "Trends", description: "A page.", path: "/trends" });
for (const [kind, block] of [["openGraph", meta.openGraph], ["twitter", meta.twitter]] as const) {
  const img = firstImage((block as { images?: unknown } | undefined)?.images);
  check(img?.url === OG_IMAGE_PATH, `${kind} names the card at ${OG_IMAGE_PATH}`);
  check(img?.width === OG_SIZE.width && img?.height === OG_SIZE.height, `${kind} gives the card's size`);
  check(typeof img?.alt === "string" && img.alt.length > 0, `${kind} describes the card for screen readers`);
}

// Every page under app/ that declares metadata goes through pageMetadata.
// The root layout sets the site-wide defaults and the homepage inherits
// them with the file-based image attached; not-found sets only a title and
// sets no openGraph, so it keeps the root's picture too.
const EXEMPT = new Set(["app/layout.tsx", "app/page.tsx", "app/not-found.tsx"]);
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "api" ? [] : walk(p);
    return /\.(tsx|ts)$/.test(name) ? [p] : [];
  });
}
const root = join(__dirname, "..");
let pages = 0;
for (const file of walk(join(root, "app"))) {
  const rel = relative(root, file).split("\\").join("/");
  const src = readFileSync(file, "utf8");
  const declares = /export\s+(const\s+metadata|(async\s+)?function\s+generateMetadata)/.test(src);
  if (!declares) continue;
  pages++;
  if (EXEMPT.has(rel)) {
    check(!/openGraph/.test(src) || rel === "app/layout.tsx", `${rel} is exempt and sets no page openGraph of its own`);
    continue;
  }
  check(/pageMetadata\(/.test(src) && !/openGraph/.test(src), `${rel} builds its metadata through pageMetadata`);
}
check(pages >= 10, `found the site's pages (${pages} declare metadata)`);

console.log(failures === 0 ? "\nAll page-metadata checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
