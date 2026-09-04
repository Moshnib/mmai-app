"use client";

import { useState } from "react";
import { getPublicSupabaseClient } from "@/lib/supabase";

// Public read access only (same RLS policy every chart on the site
// already reads through) -- this doesn't touch anything not already
// visible somewhere on the site, it just hands over the raw table.
// Keep this list to public, read-policy'd tables only -- adding one
// without a "for select using (true)" policy in supabase/schema.sql
// wouldn't leak anything (RLS default-denies to an empty result, not an
// error), but would silently produce a broken "no data" export.
const TABLES = [
  { table: "raw_indicators" as const, label: "Raw indicators (CSV)", filename: "mmai-raw-indicators.csv" },
  { table: "mmai_scores" as const, label: "Computed scores (CSV)", filename: "mmai-computed-scores.csv" },
  { table: "gulf_indicators" as const, label: "Gulf Watch data (CSV)", filename: "mmai-gulf-indicators.csv" },
];

type TableName = (typeof TABLES)[number]["table"];

// Supabase's default per-request row cap (Project Settings > API > Max
// Rows) is 1000 -- a plain select("*") silently truncates past that with
// no error, which at 6 markets/day would start dropping real history well
// under a year after launch. Page through with .range() until a
// shorter-than-a-full-page response confirms there's nothing left.
const PAGE_SIZE = 1000;

async function fetchAllRows(table: TableName): Promise<Array<Record<string, unknown>>> {
  const supabase = getPublicSupabaseClient();
  const rows: Array<Record<string, unknown>> = [];
  let from = 0;
  for (;;) {
    // "id" as a tiebreaker: observation_date isn't unique (all 7 markets
    // share the same date), and Postgres doesn't guarantee stable order
    // for tied sort keys across separate range() requests -- without a
    // unique second key, a page boundary can land mid-tie and duplicate
    // or drop rows between requests.
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("observation_date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    // Compare to the actual page size received, not the hardcoded
    // PAGE_SIZE constant -- if Supabase's own Max Rows project setting is
    // ever lower than PAGE_SIZE, every page would come back short and a
    // fixed-constant check would stop after page one, silently truncating
    // again (the exact bug this pagination exists to fix).
    if (data.length < PAGE_SIZE) break;
    from += data.length;
  }
  return rows;
}

function toCSV(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
  return lines.join("\n");
}

function downloadCSV(filename: string, csv: string) {
  // Leading BOM so Excel on Windows reads this as UTF-8 rather than the
  // system codepage -- without it, the em dash in source_note ("...
  // PARTIAL this run") renders as mangled characters.
  // String.fromCharCode(0xFEFF), not a literal BOM character in the source
  // file -- an invisible codepoint sitting in source is fragile (a
  // formatter, linter --fix, or copy-paste can silently strip it with no
  // visible git diff); building it explicitly survives all of that.
  const BOM = String.fromCharCode(0xfeff);
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Deferred a tick -- revoking synchronously right after click() has been
  // flaky in Firefox, which can still be resolving the download when the
  // blob URL disappears.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

type Status = "idle" | "loading" | "error" | "empty";

export default function ExportDataButtons() {
  const [status, setStatus] = useState<Record<string, Status>>({});

  async function exportTable(table: TableName, filename: string) {
    setStatus((s) => ({ ...s, [table]: "loading" }));
    try {
      const rows = await fetchAllRows(table);
      if (rows.length === 0) {
        setStatus((s) => ({ ...s, [table]: "empty" }));
        return;
      }
      downloadCSV(filename, toCSV(rows));
      setStatus((s) => ({ ...s, [table]: "idle" }));
    } catch {
      setStatus((s) => ({ ...s, [table]: "error" }));
    }
  }

  return (
    <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--hair)", borderRadius: 16, padding: "20px 24px", backdropFilter: "blur(10px)" }}>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5, fontWeight: 700, color: "var(--accent-2)", letterSpacing: 1, marginBottom: 10 }}>
        EXPORT THE DATA
      </div>
      <p style={{ fontSize: 12.5, color: "var(--slate)", margin: "0 0 14px" }}>
        Every number behind every chart on this site, as a plain CSV file — no account, no request, nothing held back.
      </p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {TABLES.map(({ table, label, filename }) => (
          <div key={table}>
            <button
              onClick={() => exportTable(table, filename)}
              disabled={status[table] === "loading"}
              style={{
                padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,
                border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)", color: "var(--ink)",
                opacity: status[table] === "loading" ? 0.6 : 1,
              }}
            >
              {status[table] === "loading" ? "Preparing…" : `Download ${label}`}
            </button>
            {status[table] === "error" && (
              <p style={{ color: "#E14B4B", fontSize: 11.5, margin: "6px 0 0" }}>Couldn&apos;t reach the database — try again in a moment.</p>
            )}
            {status[table] === "empty" && (
              <p style={{ color: "var(--slate)", fontSize: 11.5, margin: "6px 0 0" }}>No data yet for this table.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
