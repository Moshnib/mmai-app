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

/**
 * Run `attempt` up to RETRY_ATTEMPTS times, returning the first success.
 *
 * `shouldRetry` decides which failures are worth repeating. The default
 * retries everything, which suits a network blip; pass a narrower test
 * where the source distinguishes "not now" from "not ever".
 */
export async function withRetry<T>(
  label: string,
  attempt: () => Promise<T>,
  shouldRetry: (err: Error) => boolean = () => true,
): Promise<T> {
  let last: Error | undefined;

  for (let i = 1; i <= RETRY_ATTEMPTS; i++) {
    try {
      return await attempt();
    } catch (err) {
      last = err as Error;
      if (i === RETRY_ATTEMPTS || !shouldRetry(last)) break;
      // Logged at each retry rather than only at the end: a source that
      // needs two goes every single day is degrading, and that is worth
      // seeing before it starts failing outright.
      console.warn(`${label}: attempt ${i} failed (${last.message}), retrying`);
      await sleep(RETRY_DELAY_MS * i);
    }
  }

  throw new Error(`${label}: failed after ${RETRY_ATTEMPTS} attempts — ${last?.message ?? "unknown error"}`);
}
