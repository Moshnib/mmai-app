import { NextResponse } from "next/server";
import { getServiceSupabaseClient } from "@/lib/supabase";

const VALID_SENDER_TYPES = ["investor", "company", "individual", "student", "other", "prefer_not_to_say"];
const VALID_TOPICS = ["feedback", "partnership", "advertising", "other"];

function isValidEmail(email: string): boolean {
  // Deliberately simple — good enough to catch typos, not a full RFC 5322 parser.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  let body: { senderType?: string; topic?: string; name?: string; email?: string; message?: string; website?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Honeypot: a field real users never see or fill in (hidden off-screen in
  // ContactForm.tsx). Bots that auto-fill every field trip it. Report success
  // without actually inserting, so the bot doesn't learn it was caught.
  if ((body.website ?? "").trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const senderType = body.senderType ?? "";
  const topic = body.topic ?? "";
  const name = (body.name ?? "").trim() || null;
  const email = (body.email ?? "").trim() || null;
  const message = (body.message ?? "").trim();

  if (!VALID_SENDER_TYPES.includes(senderType)) {
    return NextResponse.json({ error: "Please select who you are" }, { status: 400 });
  }
  if (!VALID_TOPICS.includes(topic)) {
    return NextResponse.json({ error: "Please select a topic" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Please enter a message" }, { status: 400 });
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: "Message is too long (5,000 character limit)" }, { status: 400 });
  }
  if (name && name.length > 200) {
    return NextResponse.json({ error: "Name is too long" }, { status: 400 });
  }
  if (email && (email.length > 200 || !isValidEmail(email))) {
    return NextResponse.json({ error: "That email doesn't look right — fix it or leave it blank" }, { status: 400 });
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase
    .from("feedback_submissions")
    .insert({ sender_type: senderType, topic, name, email, message });

  if (error) {
    console.error("Feedback submission error:", error);
    return NextResponse.json({ error: "Something went wrong — try again in a moment" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
