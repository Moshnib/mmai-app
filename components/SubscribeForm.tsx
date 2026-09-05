"use client";

import { useState } from "react";
import { FALLBACK_MARKETS } from "@/lib/markets";
import Flag from "@/components/Flag";

export default function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function toggleMarket(code: string) {
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, markets: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setErrorMsg("Network error — try again");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.35)", borderRadius: 16, padding: "20px 24px", textAlign: "center" }}>
        <div style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 15, color: "var(--accent-2)" }}>You&apos;re on the list ✓</div>
        {/* THIS USED TO SAY "You're subscribed" AND PROMISE EMAIL.
            It could not keep that promise. Alerts send through Resend,
            which will not verify a vercel.app address as a sending
            domain -- so every send fails, and the only trace is a line in
            a server log. People had signed up and been told they would
            hear about band changes they were never going to hear about.
            Saying so is not a caveat, it is the difference between a
            waiting list and a lie. */}
        <p style={{ fontSize: 13, color: "var(--slate)", margin: "6px 0 0", lineHeight: 1.6 }}>
          <b style={{ color: "var(--ink-soft)" }}>Alerts are not sending yet.</b> MMAI needs its own domain before
          an email provider will let it send, and it does not have one. You are on the list and will be included in
          the first alert that goes out. Nothing arrives before then.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: "var(--glass)", border: "1px solid var(--hair)", borderRadius: 16, padding: "20px 24px", backdropFilter: "blur(10px)" }}>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, fontWeight: 700, color: "var(--accent-2)", letterSpacing: 1, marginBottom: 10 }}>
        JOIN THE ALERT LIST
      </div>
      {/* TWO THINGS WERE WRONG HERE.
          It promised alerts the site cannot send -- Resend will not verify
          a vercel.app address as a sending domain, so every send fails
          into a server log while the reader believes they subscribed.
          And the example bands, "Balanced → Supportive", were retired with
          the five-pillar engine; the bands are fifths of the record now.
          A stale example is the same class of bug as the "Price Stability"
          sentence on the homepage: correct-looking, and describing a
          method the site no longer runs. */}
      <p style={{ fontSize: 13, color: "var(--slate)", margin: "0 0 14px", lineHeight: 1.6 }}>
        When a market moves from one band to another — say <b style={{ color: "var(--ink-soft)" }}>Middle of the
        range</b> to <b style={{ color: "var(--ink-soft)" }}>Above average</b> — you get one email. Never a daily
        digest. <b style={{ color: "var(--ink-soft)" }}>Not sending yet:</b> MMAI needs its own domain first, so
        this is a waiting list rather than a live alert.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {FALLBACK_MARKETS.map((m) => (
          <button
            type="button"
            key={m.code}
            onClick={() => toggleMarket(m.code)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: selected.includes(m.code) ? "1px solid var(--accent)" : "1px solid var(--hair)",
              background: selected.includes(m.code) ? "rgba(139,92,246,0.18)" : "transparent",
              color: selected.includes(m.code) ? "#fff" : "var(--slate)",
            }}
          >
            <Flag code={m.code} size={14} />
            {m.name}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            flex: 1, minWidth: 200, padding: "9px 14px", borderRadius: 10,
            border: "1px solid var(--hair)", background: "rgba(255,255,255,0.04)", color: "var(--ink)", fontSize: 13,
          }}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          style={{
            padding: "9px 20px", borderRadius: 10, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, var(--accent-2), #6D28D9)", color: "#fff", fontWeight: 700, fontSize: 13,
            opacity: status === "loading" ? 0.6 : 1,
          }}
        >
          {status === "loading" ? "Subscribing…" : "Subscribe"}
        </button>
      </div>
      {status === "error" && <p style={{ color: "#E14B4B", fontSize: 12, marginTop: 10 }}>{errorMsg}</p>}
    </form>
  );
}
