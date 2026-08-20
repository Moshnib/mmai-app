import { NextResponse } from "next/server";
import { getServiceSupabaseClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new NextResponse(unsubscribePage("Missing unsubscribe link.", false), {
      headers: { "Content-Type": "text/html" },
    });
  }

  const supabase = getServiceSupabaseClient();
  const { error, count } = await supabase
    .from("subscribers")
    .delete({ count: "exact" })
    .eq("unsubscribe_token", token);

  const success = !error && (count ?? 0) > 0;
  const message = success
    ? "You've been unsubscribed. You won't receive any more MMAI alerts."
    : "That link has already been used or has expired.";

  return new NextResponse(unsubscribePage(message, success), {
    headers: { "Content-Type": "text/html" },
  });
}

function unsubscribePage(message: string, success: boolean): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>MMAI — Unsubscribe</title></head>
<body style="margin:0;background:#08080D;color:#F5F6FA;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="text-align:center;max-width:420px;padding:40px;">
    <div style="font-family:monospace;font-size:12px;color:#9C7B3D;letter-spacing:2px;margin-bottom:16px;">MMAI</div>
    <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px;">${success ? "Unsubscribed" : "Link not valid"}</h1>
    <p style="color:#C7C9D9;line-height:1.6;">${message}</p>
    <a href="https://mmai-app.vercel.app" style="display:inline-block;margin-top:20px;color:#8B5CF6;">Back to MMAI →</a>
  </div>
</body></html>`;
}
