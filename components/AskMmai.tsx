"use client";

import { useState } from "react";

// ============================================================
//  THE QUESTION BOX
//
//  An empty box with a cursor in it is the fastest way to make nobody
//  use a feature: the reader has to guess both what it knows and how to
//  phrase things. The examples below are not decoration -- they teach the
//  boundary in one glance. Two are about the figures, one is about method,
//  and the last is deliberately the kind of question it will decline, so
//  nobody has to discover that by being refused.
// ============================================================

const EXAMPLES = [
  "Which market has the weakest labour market right now?",
  "Why is Sweden scored on CPIF instead of CPI?",
  "What has moved most in the last twelve months?",
];

export default function AskMmai() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Something went wrong.");
      else setAnswer(data.answer);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chart-card" style={{ marginTop: 20 }}>
      <div className="chart-card-label">
        <span>Ask about these figures</span>
        <span style={{ marginLeft: "auto", color: "var(--slate)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
          answers only from what this site publishes
        </span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      >
        <label htmlFor="ask-input" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          Ask a question about the published figures
        </label>
        <input
          id="ask-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={400}
          placeholder="Which market has the weakest labour market right now?"
          style={{
            flex: "1 1 260px",
            minWidth: 0,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--hair)",
            background: "rgba(255,255,255,0.03)",
            color: "var(--ink)",
            font: "inherit",
          }}
        />
        <button
          type="submit"
          disabled={busy || question.trim().length === 0}
          style={{
            font: "inherit",
            fontWeight: 600,
            padding: "10px 20px",
            borderRadius: 10,
            border: "1px solid var(--hair)",
            background: busy || question.trim().length === 0 ? "transparent" : "var(--ink)",
            color: busy || question.trim().length === 0 ? "var(--slate)" : "#08080D",
            cursor: busy || question.trim().length === 0 ? "default" : "pointer",
          }}
        >
          {busy ? "Reading…" : "Ask"}
        </button>
      </form>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {EXAMPLES.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => {
              setQuestion(e);
              ask(e);
            }}
            disabled={busy}
            style={{
              font: "inherit",
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid var(--hair)",
              background: "transparent",
              color: "var(--slate)",
              cursor: busy ? "default" : "pointer",
            }}
          >
            {e}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        {error && (
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "14px 0 0" }}>{error}</p>
        )}
        {answer && (
          <p style={{ fontSize: 14, color: "var(--ink)", margin: "14px 0 0", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
            {answer}
          </p>
        )}
      </div>

      <p style={{ fontSize: 12, color: "var(--slate)", margin: "14px 0 0", paddingTop: 12, borderTop: "1px dashed var(--hair)", lineHeight: 1.7 }}>
        <b style={{ color: "var(--ink-soft)" }}>What it can and cannot do.</b> It is given the figures this
        site publishes and nothing else, so it can read them back, compare them and explain what they
        mean &mdash; and it will tell you when something is not published rather than estimate it. It
        cannot tell you what to buy, sell or hold: MMAI measures the macro environment, not any
        security. Answers are generated, so check anything that matters against{" "}
        <a href="/sources" style={{ color: "var(--accent-2)" }}>Sources</a>, which names the institution
        and reporting date behind every number.
      </p>
    </div>
  );
}
