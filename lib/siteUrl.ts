// ============================================================
//  WHERE THIS SITE LIVES — ONE PLACE
//
//  The address used to be typed into eight separate files: the canonical
//  URL and Open Graph tags in app/layout.tsx, the sitemap in robots.ts and
//  sitemap.ts, the "Back to MMAI" link on the unsubscribe page, three
//  links inside alert emails, and the endpoints the daily refresh job
//  calls from GitHub Actions.
//
//  That was fine while the address never changed. Moving to a real domain
//  means changing every one of them and missing none -- and the ones that
//  fail are the quietest: a wrong canonical URL tells Google the site is a
//  duplicate of somewhere else, and a wrong unsubscribe link is a legal
//  problem, not a cosmetic one. Neither shows up on the page.
//
//  Set NEXT_PUBLIC_SITE_URL in Vercel once and the whole site follows.
//  Everything falls back to the vercel.app address so nothing breaks
//  before that variable exists.
// ============================================================

/** No trailing slash, ever -- callers build paths as `${SITE_URL}/thing`,
 *  and a stored "https://x.com/" would produce "https://x.com//thing". */
function normalise(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

// The site's own address, bought 17 September 2026. Cloudflare holds the
// DNS (its registrar requires that) and points at Vercel with the proxy
// OFF; www is the canonical host and the bare domain redirects to it.
// NEXT_PUBLIC_SITE_URL still wins -- a preview deployment sets its own --
// and this is what a build without that variable falls back to.
const FALLBACK = "https://www.mmai.markets";

export const SITE_URL = normalise(process.env.NEXT_PUBLIC_SITE_URL || FALLBACK);

/** True while the site is still on its Vercel address. Used to explain the
 *  alert-email sending failure precisely: a vercel.app domain cannot be
 *  verified with an email provider, so alerts cannot send from one however
 *  the rest of the configuration looks. */
export const IS_VERCEL_DOMAIN = /\.vercel\.app$/.test(new URL(SITE_URL).hostname);

/** The address alerts are sent FROM. Separate from SITE_URL because the
 *  sending domain has to be verified with Resend independently -- pointing
 *  the site at a new domain does not by itself make email work from it. */
export const ALERT_FROM = process.env.ALERT_FROM_ADDRESS || `MMAI Alerts <alerts@${new URL(SITE_URL).hostname}>`;
