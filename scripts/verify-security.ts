// ============================================================
// THE TWO THINGS THAT KEEP STRANGERS OUT
//
// Both were found by audit on 2026-09-02, and both are the kind of
// defect that is invisible until it is exploited.
//
// 1. THE REFRESH ENDPOINTS FAILED OPEN. The check was
//
//        if (process.env.CRON_SECRET && authHeader !== `Bearer ${...}`)
//
//    which reads a MISSING secret as "no protection configured, let
//    everyone through" instead of "misconfigured, let nobody through".
//    One deleted environment variable would have made both endpoints
//    public: anyone could burn the BEA, BLS, e-Stat and EIA quotas,
//    write through the service role, and fire subscriber emails.
//
// 2. THE PUBLIC WRITE ENDPOINTS HAD NO VOLUME LIMIT. They validate
//    input carefully, so bad submissions were already refused -- but
//    nothing refused ten thousand good ones. Filling subscribers with
//    fake addresses is worse than noise, because those get emailed, and
//    bounce complaints damage a sending domain permanently.
//
// Environment-independent: NODE_ENV and CRON_SECRET are set and restored
// around each case, so this asserts the LOGIC rather than whatever
// happens to be configured on the machine running it.
//
//   npx tsx scripts/verify-security.ts
// ============================================================

import { checkCronAuth } from "../lib/cronAuth";
import { rateLimit } from "../lib/rateLimit";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.log(`FAIL  ${name}`);
    console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  } else {
    console.log(`PASS  ${name}`);
  }
}

const req = (auth?: string) =>
  new Request("https://example.test/api/refresh", auth ? { headers: { authorization: auth } } : undefined);

function withEnv(nodeEnv: string, secret: string | undefined, fn: () => void) {
  const prevEnv = process.env.NODE_ENV;
  const prevSecret = process.env.CRON_SECRET;
  // NODE_ENV is readonly in the Next.js types but writable at runtime;
  // this is a test harness, not shipped code.
  (process.env as Record<string, string | undefined>).NODE_ENV = nodeEnv;
  if (secret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = secret;
  try {
    fn();
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
    if (prevSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevSecret;
  }
}

console.log("Refresh endpoint authorisation\n");

// THE ONE THAT MATTERS. No secret in production must refuse everyone.
withEnv("production", undefined, () => {
  check("production + NO secret + no header  -> REFUSED", checkCronAuth(req()).ok, false);
  check("production + NO secret + any header -> REFUSED", checkCronAuth(req("Bearer anything")).ok, false);
});

withEnv("production", "s3cret", () => {
  check("production + secret + correct header -> allowed", checkCronAuth(req("Bearer s3cret")).ok, true);
  check("production + secret + wrong header   -> REFUSED", checkCronAuth(req("Bearer wrong")).ok, false);
  check("production + secret + no header      -> REFUSED", checkCronAuth(req()).ok, false);
  check("production + secret + bare secret    -> REFUSED", checkCronAuth(req("s3cret")).ok, false);
});

// The deliberate exception, so a developer can run this locally.
withEnv("development", undefined, () => {
  check("development + NO secret -> allowed (documented exception)", checkCronAuth(req()).ok, true);
});
// ...but the exception must not weaken a configured secret.
withEnv("development", "s3cret", () => {
  check("development + secret + wrong header -> REFUSED", checkCronAuth(req("Bearer nope")).ok, false);
});

console.log("\nPublic write rate limit\n");

// A fresh key per case so cases cannot contaminate each other.
const k = (n: string) => `verify-security-${n}-${Math.round(performance.now() * 1000)}`;

const a = k("under");
for (let i = 1; i <= 3; i++) check(`request ${i} of 3 under a limit of 3 -> allowed`, rateLimit(a, 3, 60_000).allowed, true);

const b = k("over");
rateLimit(b, 2, 60_000);
rateLimit(b, 2, 60_000);
const blocked = rateLimit(b, 2, 60_000);
check("the request past the limit -> BLOCKED", blocked.allowed, false);
check("  ...and says when to retry", blocked.retryAfter > 0, true);

// One caller's burst must not lock out everybody else.
const d = k("isolation");
rateLimit(d, 1, 60_000);
rateLimit(d, 1, 60_000);
check("a different caller is unaffected", rateLimit(k("other"), 1, 60_000).allowed, true);

// A window that has already elapsed must forgive, or a limiter becomes a
// permanent ban after one burst. Wrapped in main() because this file is
// transpiled to CommonJS, where top-level await is unavailable.
async function main() {
  const c = k("expiry");
  rateLimit(c, 1, 1);
  await new Promise((r) => setTimeout(r, 15));
  check("after the window elapses -> allowed again", rateLimit(c, 1, 1).allowed, true);

  console.log("");
  if (failures > 0) {
    console.log(`${failures} FAILED — DO NOT SHIP`);
    process.exit(1);
  }
  console.log("Both endpoints fail closed, and volume is bounded.");
}
main();
