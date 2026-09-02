// ============================================================
// WHO IS ALLOWED TO TRIGGER A REFRESH
//
// Both refresh endpoints used to check:
//
//     if (process.env.CRON_SECRET && authHeader !== `Bearer ${...}`)
//
// which FAILS OPEN. The secret being absent was read as "no protection
// configured, let everyone through" rather than "misconfigured, let
// nobody through". A missing environment variable -- a typo, a deleted
// variable, a new Vercel environment created without it -- would have
// silently made both endpoints public.
//
// What that would cost, concretely: anyone could burn the BEA, BLS,
// e-Stat and EIA quotas on keys this project pays for in reputation,
// write rows into Supabase through the service role, and trigger
// subscriber emails. None of it noisy enough to notice quickly.
//
// It fails CLOSED now. No secret configured means nobody gets in.
//
// The one exception is local development, which is why the original was
// written the way it was: a developer running `next dev` with no
// .env.local should still be able to hit the endpoint. That exception is
// explicit, and it can never apply in production because NODE_ENV is
// "production" there.
// ============================================================

export type CronAuthResult = { ok: true } | { ok: false; reason: string };

export function checkCronAuth(request: Request): CronAuthResult {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret) {
    // Development only, and stated out loud so it cannot pass unnoticed
    // in a log someone is skimming.
    if (process.env.NODE_ENV !== "production") {
      console.warn("CRON_SECRET is not set — allowing this request because NODE_ENV is not production.");
      return { ok: true };
    }
    console.error("CRON_SECRET is not set in production. Refusing every refresh request until it is.");
    return { ok: false, reason: "Refresh is not configured" };
  }

  if (authHeader !== `Bearer ${secret}`) {
    return { ok: false, reason: "Unauthorized" };
  }
  return { ok: true };
}
