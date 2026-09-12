// ============================================================
//  UNSUBSCRIBE: A LINK SHOWS A BUTTON, ONLY A POST DELETES
//
//  This used to delete the subscription on a plain GET -- the moment the
//  link was opened. That is the natural way to write it and it is wrong,
//  because people are not the only thing that opens links in email.
//  Corporate mail filters (Outlook Safe Links, Mimecast, Proofpoint and
//  others) fetch every link in an incoming message to check it is safe
//  BEFORE the recipient sees it. Each of those fetches is a GET. Every
//  subscriber at a company running one would have been unsubscribed on
//  arrival of their first alert, without ever clicking anything -- and
//  nobody would have known, because the page that said so was shown to a
//  scanner.
//
//  So:
//    GET   shows "Unsubscribe from MMAI alerts?" and a button. Changes
//          nothing, so a scanner can fetch it all day.
//    POST  deletes. Sent by that button, and by the mail provider's own
//          one-click button (RFC 8058 -- see the List-Unsubscribe headers
//          in lib/notify.ts), which POSTs straight here with the body
//          "List-Unsubscribe=One-Click". Scanners follow links; they do
//          not submit forms.
//
//  THE TOKEN IS VALIDATED BEFORE IT IS USED ANYWHERE, including before it
//  is written into the confirmation page. That page puts the token into
//  the form's address, and the token arrives from the URL -- i.e. from
//  whoever wrote the link. Unchecked, a link carrying markup instead of a
//  token would have run that markup on this site's own address. Every
//  real token is a UUID (all four existing ones were checked), so
//  anything else is refused outright.
// ============================================================

import { NextResponse } from "next/server";
import { getServiceSupabaseClient } from "@/lib/supabase";
import { SITE_URL } from "@/lib/siteUrl";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tokenFrom(request: Request): string | null {
  const token = new URL(request.url).searchParams.get("token");
  return token && UUID.test(token) ? token : null;
}

export async function GET(request: Request) {
  const token = tokenFrom(request);
  if (!token) {
    return page(400, "Link not valid", "This unsubscribe link is incomplete. Use the link from the most recent MMAI email you received.");
  }
  // Deliberately touches nothing. See the header.
  return page(
    200,
    "Unsubscribe from MMAI alerts?",
    "You'll stop receiving band-change emails for every market you follow.",
    token,
  );
}

export async function POST(request: Request) {
  const token = tokenFrom(request);
  if (!token) {
    return page(400, "Link not valid", "This unsubscribe link is incomplete. Use the link from the most recent MMAI email you received.");
  }

  let removed: number;
  try {
    const supabase = getServiceSupabaseClient();
    const { error, count } = await supabase
      .from("subscribers")
      .delete({ count: "exact" })
      .eq("unsubscribe_token", token);
    if (error) throw new Error(error.message);
    removed = count ?? 0;
  } catch (err) {
    console.error("Unsubscribe failed:", (err as Error).message);
    return page(500, "Something went wrong", "Nothing was changed. Please try the link again in a moment.");
  }

  // A second press, or a mail provider retrying its one-click POST, finds
  // nothing to delete. That is success from the reader's side -- they are
  // not subscribed -- so it is a 200 that says so, not an error. The old
  // page answered this case with "already been used or has expired";
  // tokens never expired, and the phrasing read like a fault.
  return removed > 0
    ? page(200, "Unsubscribed", "You won't receive any more MMAI alerts.")
    : page(200, "Already unsubscribed", "This address isn't on the MMAI alert list, so there's nothing more to do.");
}

function page(status: number, title: string, message: string, confirmToken?: string): NextResponse {
  // Only fixed strings and a validated UUID are ever interpolated here.
  const form = confirmToken
    ? `<form method="post" action="/api/unsubscribe?token=${confirmToken}" style="margin-top:24px;">
      <button type="submit" style="font:inherit;font-weight:600;padding:10px 22px;border-radius:8px;border:1px solid #6B7086;background:#F5F6FA;color:#08080D;cursor:pointer;">Unsubscribe</button>
    </form>`
    : "";
  const body = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>MMAI — ${title}</title></head>
<body style="margin:0;background:#08080D;color:#F5F6FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <main style="text-align:center;max-width:420px;padding:40px 24px;">
    <div style="font-family:monospace;font-size:12px;color:#C9A55C;letter-spacing:2px;margin-bottom:16px;">MMAI</div>
    <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px;">${title}</h1>
    <p style="color:#C7C9D9;line-height:1.6;margin:0;">${message}</p>${form}
    <p style="margin-top:28px;"><a href="${SITE_URL}" style="color:#C7C9D9;">Back to MMAI</a></p>
  </main>
</body></html>`;
  return new NextResponse(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
