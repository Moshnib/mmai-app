// ============================================================
//  RETRY A SOURCE THAT BLINKS
//
//  Written for data.gov.bh, which answered five out of five direct
//  calls in under half a second and still failed to produce Bahrain's
//  inflation on roughly four days in ten. A source like that does not
//  need a longer timeout -- it needs to be asked twice.
//
//  Deliberately small: three attempts, short linear backoff, and no
//  retry on the kind of failure a retry cannot fix. Retrying a 404
//  just turns one wrong answer into three.
// ============================================================

/** Attempts in total, not retries after the first. */
export const RETRY_ATTEMPTS = 3;

/** Linear rather than exponential. These are national statistics
 *  portals with a moment of indigestion, not an overloaded API asking
 *  to be backed off; and the whole refresh runs inside a 60-second
 *  function, so a long tail of doubling waits would cost more than the
 *  value it rescues. */
export const RETRY_DELAY_MS = 400;

/** The longest a single attempt can take, for reserving against a
 *  deadline. Matches the slowest timeout any fetcher sets -- BIS and
 *  Qatar CPI both allow 15 seconds. Deliberately the WORST case rather
 *  than an average: the point of a reservation is that it holds when the
 *  source is slow, which is precisely when retries happen. */
export const MAX_ATTEMPT_MS = 15_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RetryOptions {
  /** Which failures are worth repeating. Defaults to all of them, which
   *  suits a network blip; narrow it where the source distinguishes
   *  "not now" from "not ever". */
  shouldRetry?: (err: Error) => boolean;
  /** Epoch milliseconds after which no FURTHER attempt may start.
   *
   *  RETRYING IS NOT FREE, AND THE CALLER'S TIME IS NOT INFINITE. The
   *  Gulf refresh runs six countries one after another inside a
   *  60-second function, and its fetchers allow up to 15 seconds each.
   *  Three attempts turns a worst case of 90 seconds into 277, which
   *  does not fail politely: the function is killed part-way and the
   *  countries later in the list are never written at all -- strictly
   *  worse than the missing-value bug retrying was added to fix.
   *
   *  With a deadline the retries simply stop when the budget is spent,
   *  and the caller still gets whatever the first attempts produced. */
  deadline?: number;
  /** How many goes in total, defaulting to RETRY_ATTEMPTS.
   *
   *  The default suits the refresh, where a rescued value is the whole
   *  point and a source is worth pestering. The source audit overrides
   *  it to 2: that caller only writes a report, every fetcher it calls
   *  already carries its own 8-15 second abort, and three attempts plus
   *  backoff would not fit inside the budget it runs in. */
  attempts?: number;
}

/**
 * Run `attempt` up to `options.attempts` times (RETRY_ATTEMPTS unless the
 * caller says otherwise), returning the first success.
 */
export async function withRetry<T>(
  label: string,
  attempt: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { shouldRetry = () => true, deadline } = options;
  // At least one go. Asked for 0, this used to skip the loop entirely,
  // never call the source, and throw "failed after 0 attempts" -- reporting
  // a failure that did not happen. No caller passes 0 today; the clamp
  // keeps it that way by construction rather than by luck.
  const requested = options.attempts ?? RETRY_ATTEMPTS;
  const attempts = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : RETRY_ATTEMPTS;
  let last: Error | undefined;

  for (let i = 1; i <= attempts; i++) {
    try {
      return await attempt();
    } catch (err) {
      last = err as Error;
      if (i === attempts || !shouldRetry(last)) break;
      // RESERVE THE ATTEMPT, do not merely check the clock.
      //
      // This asked `Date.now() >= deadline` -- whether time had ALREADY
      // run out, not whether the attempt about to start could finish
      // inside it. With a 600ms budget and a 500ms attempt, measured
      // overrun was 826ms. At production scale a 15-second fetcher can
      // start legally with two seconds left and return the caller 13
      // seconds late, which is how the Gulf refresh could still be
      // killed part-way through its list -- the exact outcome the
      // deadline was introduced to prevent.
      const nextAttemptEnds = Date.now() + RETRY_DELAY_MS * i + MAX_ATTEMPT_MS;
      if (deadline != null && nextAttemptEnds >= deadline) {
        console.warn(`${label}: not enough time left for another attempt after ${i}, giving up`);
        break;
      }
      // Logged at each retry rather than only at the end: a source that
      // needs two goes every single day is degrading, and that is worth
      // seeing before it starts failing outright.
      console.warn(`${label}: attempt ${i} failed (${last.message}), retrying`);
      await sleep(RETRY_DELAY_MS * i);
    }
  }

  throw new Error(`${label}: failed after ${attempts} attempts — ${last?.message ?? "unknown error"}`);
}
