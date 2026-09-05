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
  <div style="font-family:-apple-system,sans-serif;background:#08080D;color:#F5F6FA;padding:32px;border-radius:12px;">
    <p style="font-family:monospace;font-size:11px;color:#9C7B3D;letter-spacing:2px;margin:0 0 12px;">MMAI ALERT</p>
    <h2 style="font-family:Georgia,serif;font-size:22px;margin:0 0 16px;">
      ${crossing.marketName} moved from ${crossing.oldBand} to ${crossing.newBand}
    </h2>
    <p style="font-size:15px;color:#C7C9D9;line-height:1.6;">
      The MMAI composite score for ${crossing.marketName} is now <b style="color:#fff;">${crossing.score.toFixed(1)}</b>.
    </p>
    <a href="${SITE_URL}/trends?market=${crossing.marketCode}"
       style="display:inline-block;margin-top:16px;padding:10px 20px;background:#8B5CF6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
      View the chart →
    </a>
    <p style="font-size:11px;color:#6B7086;margin-top:32px;">
      You're receiving this because you subscribed to MMAI alerts for ${crossing.marketName}.
      <a href="${unsubscribeUrl}" style="color:#6B7086;">Unsubscribe</a>
    </p>
  </div>`;
}

export async function sendBandCrossingEmail(to: string, crossing: BandCrossing, unsubscribeToken: string) {
  const resend = getResendClient();
  const unsubscribeUrl = `${SITE_URL}/api/unsubscribe?token=${unsubscribeToken}`;
  return resend.emails.send({
    // Follows the site domain, but the SENDING domain still has to be
    // verified with Resend separately -- pointing the site at a new domain
    // does not by itself make email work from it.
    from: ALERT_FROM,
    to,
    subject: `${crossing.marketName}: ${crossing.oldBand} → ${crossing.newBand}`,
    html: emailHtml(crossing, unsubscribeUrl),
  });
}
