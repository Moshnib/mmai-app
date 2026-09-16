import { Resend } from "resend";
import { SITE_URL, ALERT_FROM } from "@/lib/siteUrl";

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
    <p style="font-family:monospace;font-size:11px;color:#D4B06A;letter-spacing:2px;margin:0 0 12px;">MMAI ALERT</p>
    <h2 style="font-family:Georgia,serif;font-size:22px;margin:0 0 16px;">
      ${crossing.marketName} moved from ${crossing.oldBand} to ${crossing.newBand}
    </h2>
    <p style="font-size:15px;color:#C5CCD7;line-height:1.6;">
      The MMAI composite score for ${crossing.marketName} is now <b style="color:#D4B06A;">${crossing.score.toFixed(1)}</b>.
    </p>
    <a href="${SITE_URL}/trends?market=${crossing.marketCode}"
       style="display:inline-block;margin-top:16px;padding:10px 20px;background:#D4B06A;color:#0A0F1A;text-decoration:none;border-radius:4px;font-weight:600;">
      View the chart →
    </a>
    <p style="font-size:11px;color:#9BA6B7;margin-top:32px;">
      You're receiving this because you subscribed to MMAI alerts for ${crossing.marketName}.
      <a href="${unsubscribeUrl}" style="color:#9BA6B7;">Unsubscribe</a>
    </p>
  </div>`;
}

export async function sendBandCrossingEmail(to: string, crossing: BandCrossing, unsubscribeToken: string) {
  const resend = getResendClient();
  const unsubscribeUrl = `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  return resend.emails.send({
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
