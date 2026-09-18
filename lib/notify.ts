import { Resend } from "resend";
import { SITE_URL, ALERT_FROM } from "@/lib/siteUrl";

// ONE PLACE THAT KNOWS A SEND FAILED.
//
// resend.emails.send does NOT throw when the API rejects a message: it
// resolves with { data: null, error }. Everything here used to sit in a
// try/catch, which means a rejected send -- an unverified domain, a
// blocked address, a bad key -- counted as a success and the only trace
// was nothing at all. The refresh route's "sent" and "failed" tallies
// were wrong in the one direction that matters.
async function send(payload: Parameters<Resend["emails"]["send"]>[0]) {
  const resend = getResendClient();
  const { data, error } = await resend.emails.send(payload);
  if (error) throw new Error(`${error.name ?? "send failed"}: ${error.message ?? String(error)}`);
  return data;
}

// Lazily constructed so this file can be imported even when RESEND_API_KEY
// isn't set yet (e.g. during local dev before that key is added) — the
// actual send call fails loudly instead, rather than crashing at import time.
function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set — see .env.local.example");
  return new Resend(key);
}

export interface BandCrossing {
  marketCode: string;
  marketName: string;
  oldBand: string;
  newBand: string;
  score: number;
}

function emailHtml(crossing: BandCrossing, unsubscribeUrl: string): string {
  return `
  <div style="font-family:-apple-system,sans-serif;background:#0A0F1A;color:#E9ECF1;padding:32px;border-radius:8px;">
    <p style="font-family:monospace;font-size:11px;color:#FFD166;letter-spacing:2px;margin:0 0 12px;">MMAI ALERT</p>
    <h2 style="font-family:Georgia,serif;font-size:22px;margin:0 0 16px;">
      ${crossing.marketName} moved from ${crossing.oldBand} to ${crossing.newBand}
    </h2>
    <p style="font-size:15px;color:#C5CCD7;line-height:1.6;">
      The MMAI composite score for ${crossing.marketName} is now <b style="color:#FFD166;">${crossing.score.toFixed(1)}</b>.
    </p>
    <a href="${SITE_URL}/trends?market=${crossing.marketCode}"
       style="display:inline-block;margin-top:16px;padding:10px 20px;background:#FFD166;color:#0A0F1A;text-decoration:none;border-radius:4px;font-weight:600;">
      View the chart →
    </a>
    <p style="font-size:11px;color:#9BA6B7;margin-top:32px;">
      You're receiving this because you subscribed to MMAI alerts for ${crossing.marketName}.
      <a href="${unsubscribeUrl}" style="color:#9BA6B7;">Unsubscribe</a>
    </p>
  </div>`;
}

export async function sendBandCrossingEmail(to: string, crossing: BandCrossing, unsubscribeToken: string) {
  const unsubscribeUrl = `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  return send({
    // Follows the site domain, but the SENDING domain still has to be
    // verified with Resend separately -- pointing the site at a new domain
    // does not by itself make email work from it.
    from: ALERT_FROM,
    to,
    subject: `${crossing.marketName}: ${crossing.oldBand} → ${crossing.newBand}`,
    html: emailHtml(crossing, unsubscribeUrl),
    // ONE-CLICK UNSUBSCRIBE, THE STANDARD WAY (RFC 8058).
    //
    // These two headers are what put the "Unsubscribe" button beside the
    // sender's name in Gmail, Outlook and Apple Mail. Pressing it makes
    // the mail provider send a POST to the URL with the body
    // "List-Unsubscribe=One-Click" -- no page visit, no second click.
    //
    // It matters for more than convenience. The link in the body now
    // opens a confirmation page rather than unsubscribing on sight (see
    // app/api/unsubscribe/route.ts, and why: corporate link scanners open
    // every link in a message). Without these headers, "unsubscribe"
    // would have become two steps for everyone; with them, the provider's
    // own button stays one step, and it is POST-only, so a scanner that
    // merely follows links can never trigger it.
    //
    // Gmail and Yahoo also REQUIRE both headers from bulk senders; mail
    // without them is increasingly routed to spam.
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

// ============================================================
//  THE FIRST EMAIL: YOU ARE ON THE LIST
//
//  Until this existed, nothing sent mail except a band crossing in the
//  refresh route -- which can be weeks apart. Nobody, including the
//  owner, could tell whether sending worked until the one moment it
//  mattered, and for months it did not work at all.
//
//  It also answers the form's oldest problem, recorded in
//  app/api/subscribe/route.ts: anyone can type in somebody else's
//  address. Mailing that address is better than silence -- the person
//  learns their address was used and has a one-click unsubscribe in the
//  same message -- and the caller only sends when the stored market list
//  actually CHANGED, which caps what a stranger can inflict at one email
//  per market, ever.
// ============================================================

/** Exported for scripts/test-welcome-email.ts, which renders it without
 *  sending anything. */
export function welcomeHtml(marketNames: string[], unsubscribeUrl: string, isUpdate: boolean): string {
  const list = marketNames.join(", ");
  return `
  <div style="font-family:-apple-system,sans-serif;background:#0A0F1A;color:#E9ECF1;padding:32px;border-radius:8px;">
    <p style="font-family:monospace;font-size:11px;color:#FFD166;letter-spacing:2px;margin:0 0 12px;">MMAI</p>
    <h2 style="font-family:Georgia,serif;font-size:22px;margin:0 0 16px;">
      ${isUpdate ? "Your watchlist was updated" : "You're on the list"}
    </h2>
    <p style="font-size:15px;color:#C5CCD7;line-height:1.6;margin:0 0 14px;">
      You'll get an email when the MMAI composite score for one of these crosses into a different band:
      <b style="color:#E9ECF1;">${list}</b>.
    </p>
    <p style="font-size:15px;color:#C5CCD7;line-height:1.6;margin:0 0 14px;">
      That is all this list sends. No daily digest, no newsletter — a band change is a handful of times a year
      per market.
    </p>
    <a href="${SITE_URL}"
       style="display:inline-block;margin-top:6px;padding:10px 20px;background:#FFD166;color:#0A0F1A;text-decoration:none;border-radius:4px;font-weight:600;">
      Open MMAI →
    </a>
    <p style="font-size:11px;color:#9BA6B7;margin-top:32px;line-height:1.6;">
      If you didn't sign up, ignore this or
      <a href="${unsubscribeUrl}" style="color:#9BA6B7;">unsubscribe</a> — nothing else arrives until a band
      changes, and unsubscribing removes the address completely.
    </p>
  </div>`;
}

/** Sent when an address joins the list, or when its markets change.
 *  `marketNames` are names, not codes -- the reader never sees "KR". */
export async function sendWelcomeEmail(
  to: string,
  marketNames: string[],
  unsubscribeToken: string,
  isUpdate: boolean
) {
  const unsubscribeUrl = `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  return send({
    from: ALERT_FROM,
    to,
    subject: isUpdate ? "Your MMAI watchlist was updated" : "You're on the MMAI alert list",
    html: welcomeHtml(marketNames, unsubscribeUrl, isUpdate),
    // The same one-click unsubscribe the alerts carry (RFC 8058), for the
    // same reasons -- and here it matters more, because this is the
    // message a person who never signed up receives.
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}
