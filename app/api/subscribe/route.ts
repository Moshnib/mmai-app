import { NextResponse } from "next/server";
import { limitPublicWrite } from "@/lib/rateLimit";
import { randomUUID } from "crypto";
import { getServiceSupabaseClient } from "@/lib/supabase";
import { FALLBACK_MARKETS } from "@/lib/markets";

const VALID_CODES = FALLBACK_MARKETS.map((m) => m.code);

function isValidEmail(email: string): boolean {
  // Deliberately simple — good enough to catch typos, not a full RFC 5322 parser.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  // Volume limit. Input validation below stops BAD submissions; this
  // stops TOO MANY of them. See lib/rateLimit.ts for what it does and
  // does not protect against.
  const limit = limitPublicWrite(request);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: { email?: string; markets?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const markets = (body.markets ?? []).filter((m) => VALID_CODES.includes(m));

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }
  if (markets.length === 0) {
    return NextResponse.json({ error: "Pick at least one market to watch" }, { status: 400 });
  }

  const supabase = getServiceSupabaseClient();
  const unsubscribeToken = randomUUID();

  // Upsert on email: resubscribing (or changing markets) just updates the
  // existing row instead of creating a duplicate or erroring.
  const { error } = await supabase
    .from("subscribers")
    .upsert(
      { email, markets, unsubscribe_token: unsubscribeToken },
      { onConflict: "email", ignoreDuplicates: false }
    );

  if (error) {
    console.error("Subscribe error:", error);
    return NextResponse.json({ error: "Something went wrong — try again in a moment" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, markets });
}
