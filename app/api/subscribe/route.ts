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

  // THIS FORM TAKES AN ADDRESS FROM ANYONE, so an existing subscription is
  // treated with care rather than simply overwritten.
  //
  // It used to upsert { email, markets, fresh token }, which did two things
  // nobody intended:
  //
  //   - It REPLACED the markets. Anyone could type in someone else's
  //     address, tick one market, and silently stop that person's alerts
  //     for every other market they had chosen.
  //   - It minted a NEW unsubscribe token every time. Every earlier email
  //     carries the old one, so the moment someone updated their markets,
  //     the unsubscribe link in each message they had already received
  //     stopped working -- and said "already used" when it had not been.
  //
  // Now an existing row keeps its token, and markets are ADDED, never
  // removed. Removing needs the unsubscribe link, which only the owner of
  // the address has.
  //
  // WHAT THIS DOES NOT FIX: anyone can still sign up an address that is
  // not theirs, or add markets to one. Only a confirmation email closes
  // that -- a product decision and a schema change, recorded in the
  // handover (section 19.10) and deliberately not done here.
  const { data: existing, error: lookupError } = await supabase
    .from("subscribers")
    .select("markets, unsubscribe_token")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) {
    console.error("Subscribe lookup error:", lookupError);
    return NextResponse.json({ error: "Something went wrong — try again in a moment" }, { status: 500 });
  }

  const mergedMarkets = existing
    ? Array.from(new Set([...((existing.markets as string[] | null) ?? []), ...markets])).filter((m) => VALID_CODES.includes(m))
    : markets;
  const unsubscribeToken = (existing?.unsubscribe_token as string | null) ?? randomUUID();

  const { error } = await supabase
    .from("subscribers")
    .upsert(
      { email, markets: mergedMarkets, unsubscribe_token: unsubscribeToken },
      { onConflict: "email", ignoreDuplicates: false }
    );

  if (error) {
    console.error("Subscribe error:", error);
    return NextResponse.json({ error: "Something went wrong — try again in a moment" }, { status: 500 });
  }

  // Deliberately does NOT echo the market list. It used to echo what was
  // submitted, which was harmless while that was all it could ever be.
  // Once markets merge, returning the result would tell anyone who types
  // in an address exactly which markets its owner follows.
  return NextResponse.json({ ok: true });
}
