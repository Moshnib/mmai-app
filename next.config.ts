import type { NextConfig } from "next";

/**
 * SECURITY HEADERS
 *
 * The site was serving none of these. That was survivable on a vercel.app
 * address nobody links to; it is not what you want on a public domain that
 * publishes financial figures, because the whole claim of the project is
 * that the numbers you read are the numbers MMAI published.
 *
 * Each one is here for a stated reason, not because a checklist named it.
 */
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

  // The modern equivalent, plus the two directives worth setting even
  // without a full CSP: block plugin content, and stop the page being
  // framed. A complete script-src policy is deliberately NOT set here --
  // Next.js injects inline bootstrap scripts, so it needs per-request
  // nonces via middleware to avoid breaking hydration. Doing that badly is
  // worse than not doing it, so it is left as a separate, tested change.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },

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
