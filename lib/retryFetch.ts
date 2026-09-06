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
}

/**
 * Run `attempt` up to RETRY_ATTEMPTS times, returning the first success.
 */
export async function withRetry<T>(
  label: string,
  attempt: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { shouldRetry = () => true, deadline } = options;
  let last: Error | undefined;

  for (let i = 1; i <= RETRY_ATTEMPTS; i++) {
    try {
      return await attempt();
    } catch (err) {
      last = err as Error;
      if (i === RETRY_ATTEMPTS || !shouldRetry(last)) break;
      if (deadline != null && Date.now() >= deadline) {
        console.warn(`${label}: out of time after attempt ${i}, not retrying`);
        break;
      }
      // Logged at each retry rather than only at the end: a source that
      // needs two goes every single day is degrading, and that is worth
      // seeing before it starts failing outright.
      console.warn(`${label}: attempt ${i} failed (${last.message}), retrying`);
      await sleep(RETRY_DELAY_MS * i);
    }
  }

  throw new Error(`${label}: failed after ${RETRY_ATTEMPTS} attempts — ${last?.message ?? "unknown error"}`);
}
