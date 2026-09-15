import type { NextConfig } from "next";

const IS_DEV = process.env.NODE_ENV === "development";

/** Derived rather than hardcoded, so that changing Supabase projects cannot
 *  leave the policy naming the old one -- which would block every data
 *  fetch and leave the site rendering with no numbers and no visible error.
 *  The anon URL is already public: it ships inside the client bundle, so
 *  naming it in a header discloses nothing that isn't already served. */
const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

/**
 * THE CONTENT SECURITY POLICY.
 *
 * Every origin below was MEASURED, not assumed. Loading each page on the
 * live site and recording what the browser actually requested gives four
 * destinations and no others:
 *
 *   self                     the pages, their scripts and stylesheets
 *   fonts.googleapis.com     the stylesheet for Source Serif 4 / IBM Plex
 *   fonts.gstatic.com        the font files it pulls in
 *   <project>.supabase.co    the live indicator data, fetched client-side
 *
 * No analytics, no ad network, no third-party script of any kind. The
 * blockchain and statistics APIs are called from the SERVER, so a browser
 * never contacts them and they must not be listed here.
 *
 * ── WHY script-src ALLOWS 'unsafe-inline', WHICH LOOKS WRONG ──
 *
 * The stronger policy is a per-request nonce with 'strict-dynamic'. It was
 * built, and then measured against a real production build of THIS site,
 * and it broke every page:
 *
 *   "Loading the script /_next/static/chunks/310vm2bl3xxpt.js violates the
 *    following Content Security Policy directive... The action has been
 *    blocked."
 *
 * The cause is structural, not a mistake in the policy. A nonce has to be
 * generated per request and stamped into the HTML, so it requires DYNAMIC
 * rendering -- Next's own guide says so. Seven of this site's nine routes
 * are statically prerendered at build time, so their cached HTML carries
 * no nonce and never can. The pages still rendered their text, because
 * that is server-rendered, but nothing hydrated: no score, no daily feed,
 * no Gulf cards, no charts. A site that looks fine and does nothing.
 *
 * Forcing every route dynamic would fix the nonce and break something
 * else. /stablecoins caches for ten minutes precisely so that visitor
 * traffic never reaches the public blockchain endpoints -- rendering it
 * per request would call them on every page view, which the page itself
 * documents as staying inside fair use.
 *
 * So: no nonce, and 'unsafe-inline' stated openly rather than disguised.
 * What that costs is narrow -- an injected INLINE script would run. What
 * it still buys is most of the real protection:
 *
 *   - no script can be loaded from any other origin
 *   - connect-src blocks exfiltration to anywhere but Supabase
 *   - base-uri stops a <base> tag redirecting every relative URL
 *   - form-action stops a form being repointed at an attacker
 *   - frame-ancestors stops the site being framed and passed off as someone else's
 *
 * And the inline vector needs an attacker to inject HTML in the first
 * place. This site renders no user-generated content, has no accounts, no
 * sessions and no cookies. Someone able to inject inline script here
 * already has the server.
 *
 * IF THIS IS EVER TIGHTENED: check the build output first. The moment
 * every route reports as dynamic, the nonce becomes available -- and
 * anyone reaching for it before then will white-screen the site exactly
 * as described above.
 */
const CSP = [
  "default-src 'self'",
  // 'unsafe-eval' IS DEVELOPMENT ONLY, and never reaches production.
  //
  // React uses eval() in development for debugging features -- most
  // usefully, reconstructing a server-side error's callstack in the
  // browser. Without it the dev server still runs, but React reports
  // "eval() is not supported in this environment" and those features go
  // quiet, which is a miserable thing to debug precisely because the site
  // otherwise looks fine.
  //
  // Caught by opening the local site after adding this policy and reading
  // the console, rather than by testing production alone. React never uses
  // eval in production, so the deployed policy stays strict.
  `script-src 'self' 'unsafe-inline'${IS_DEV ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // blob: for the CSV export buttons, which build the file in the browser
  // and hand it over as an object URL. data: for the generated favicon.
  "img-src 'self' data: blob:",
  `connect-src 'self'${SUPABASE_ORIGIN ? ` ${SUPABASE_ORIGIN}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  // Tells browsers to reach this site over HTTPS only, for two years, and
  // to apply the same rule to subdomains. Without it the very first visit
  // to "mmai.com" typed without a scheme is an HTTP request that can be
  // intercepted before the redirect to HTTPS happens.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },

  // Stops a browser second-guessing a Content-Type. Relevant here because
  // the site serves CSV exports: without this, a browser can decide a CSV
  // "looks like" HTML and run it.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Send the full URL to ourselves, only the origin to other sites. Keeps
  // any future query parameter out of third-party referer logs.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Clickjacking. Nobody should be able to load MMAI in an invisible frame
  // over their own page and pass its scores off as theirs -- which for an
  // index whose value is its provenance is the attack that actually matters.
  { key: "X-Frame-Options", value: "DENY" },

  // Content-Security-Policy — see the note above CSP below.
  { key: "Content-Security-Policy", value: CSP },

  // The site asks for none of these, so deny them outright rather than
  // leaving the defaults to whatever a browser decides next year.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // stops advertising the framework version

  async headers() {
    return [
      // Everything, including the API routes and the CSV exports.
      { source: "/:path*", headers: SECURITY_HEADERS },
    ];
  },
};

export default nextConfig;
