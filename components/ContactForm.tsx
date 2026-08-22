"use client";

import { useState } from "react";

const SENDER_TYPES = [
  { value: "investor", label: "Investor" },
  { value: "company", label: "Company" },
  { value: "individual", label: "Individual" },
  { value: "student", label: "Student" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const TOPICS = [
  { value: "feedback", label: "Feedback" },
  { value: "partnership", label: "Partnership" },
  { value: "advertising", label: "Advertising" },
  { value: "other", label: "Other" },
];

export default function ContactForm() {
  const [senderType, setSenderType] = useState("");
  const [topic, setTopic] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — see app/api/feedback/route.ts
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderType, topic, name, email, message, website }),
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
      <div style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.35)", borderRadius: 16, padding: "24px 28px", textAlign: "center" }}>
        <div style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 16, color: "var(--gold-deep)" }}>Thanks — that&apos;s been sent ✓</div>
        <p style={{ fontSize: 13, color: "var(--slate)", margin: "8px 0 0" }}>
          We read every submission. If you left an email, we&apos;ll get back to you when there&apos;s something to say.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: "var(--glass)", border: "1px solid var(--hair)", borderRadius: 18, padding: "28px 32px", backdropFilter: "blur(14px)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <label style={fieldLabelStyle}>
          Who are you?
          <select required value={senderType} onChange={(e) => setSenderType(e.target.value)} style={selectStyle}>
            <option value="" disabled style={optionStyle}>Select one…</option>
            {SENDER_TYPES.map((s) => <option key={s.value} value={s.value} style={optionStyle}>{s.label}</option>)}
          </select>
        </label>

        <label style={fieldLabelStyle}>
          What&apos;s this about?
          <select required value={topic} onChange={(e) => setTopic(e.target.value)} style={selectStyle}>
            <option value="" disabled style={optionStyle}>Select one…</option>
            {TOPICS.map((t) => <option key={t.value} value={t.value} style={optionStyle}>{t.label}</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <label style={fieldLabelStyle}>
          Name <span style={{ color: "var(--slate)", fontWeight: 400 }}>(optional)</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </label>
        <label style={fieldLabelStyle}>
          Email <span style={{ color: "var(--slate)", fontWeight: 400 }}>(optional — leave it if you want a reply)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </label>
      </div>

      <label style={fieldLabelStyle}>
        Message
        <textarea
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </label>

      {/* Honeypot: hidden off-screen, not display:none (some bots skip those).
          Real users never see or fill it in; a filled value marks a bot. */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      <button
        type="submit"
        disabled={status === "loading"}
        style={{
          marginTop: 18, padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer",
          background: "linear-gradient(135deg, var(--gold-deep), #6D28D9)", color: "#fff", fontWeight: 700, fontSize: 13,
          opacity: status === "loading" ? 0.6 : 1,
        }}
      >
        {status === "loading" ? "Sending…" : "Send"}
      </button>
      {status === "error" && <p style={{ color: "#E14B4B", fontSize: 12, marginTop: 10 }}>{errorMsg}</p>}
    </form>
  );
}

const fieldLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--ink)",
};

const inputStyle: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid var(--hair)",
  background: "rgba(255,255,255,0.04)",
  color: "var(--ink)",
  fontSize: 13,
  fontWeight: 400,
};

// Solid background on both <select> and <option> — translucent/rgba
// backgrounds on native dropdowns render unreliably across browsers
// (see the same fix already applied in app/compare/ComparePageInner.tsx).
const selectStyle: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "#12121A",
  color: "#F5F6FA",
  fontSize: 13,
  fontWeight: 400,
  cursor: "pointer",
};

const optionStyle: React.CSSProperties = {
  background: "#12121A",
  color: "#F5F6FA",
};
