// ============================================================
// A MODEST RATE LIMIT ON THE TWO PUBLIC WRITE ENDPOINTS
//
// /api/subscribe and /api/feedback accept writes from anyone. Both
// validate their input carefully and /api/feedback carries a honeypot,
// which stops naive bots. Neither had any limit on VOLUME.
//
// What that leaves open: a script posting 5,000-character messages into
// feedback_submissions until the database is full of them, or thousands
// of fake addresses into subscribers -- and the second is worse than
// noise, because those addresses get emailed. Bounces and spam
// complaints damage the sending domain's reputation, which is not
// something you repair by deleting rows.
//
// BE HONEST ABOUT WHAT THIS IS. It is an in-memory counter inside one
// serverless instance. Vercel runs several, and recycles them, so a
// determined attacker spreading requests across instances gets more
// through than the numbers below suggest, and a cold start forgets
// everything.
//
// It is still worth having: it costs nothing, adds no dependency, and
// turns "unlimited" into "awkward", which is the entire difference
// between a script that works and one that is not worth writing. If this
// project ever needs a real limit -- a paid tier, or actual abuse --
// that means a shared store (Upstash, or a Postgres table), and this
// file should be replaced rather than tuned.
//
// The limits are deliberately generous. A human filling in a contact
// form will never see them. That is the point: a limit that catches real
// users gets removed, and then there is no limit at all.
// ============================================================

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Stops the Map growing without bound on a long-lived instance. Cheap
 *  because it only runs when the map is already larger than any honest
 *  traffic would make it. */
function evictExpired(now: number): void {
  if (buckets.size < 500) return;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller may try again. Sent as Retry-After. */
  retryAfter: number;
}

/** Best-effort caller identity.
 *
 *  x-forwarded-for is set by Vercel's proxy and is the closest thing to
 *  a client IP available here. It CAN be spoofed upstream of a proxy, so
 *  this is not an identity check -- it is a way of separating one
 *  ordinary user from another, not a way of proving who anyone is. */
export function callerKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : "unknown";
  return ip || "unknown";
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  evictExpired(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfter: 0 };
}

/** Shared by both public write endpoints: 10 submissions per 10 minutes
 *  from one address. A person contacting the site once, or subscribing
 *  and then changing which markets they watch a few times, stays far
 *  below it. */
export function limitPublicWrite(request: Request): RateLimitResult {
  return rateLimit(callerKey(request), 10, 10 * 60 * 1000);
}
