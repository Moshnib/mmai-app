// ============================================================
//  FILES THE BROWSER BUILDS AND HANDS OVER
//
//  One copy of the CSV and download plumbing, shared by the full-table
//  export on /sources and the per-chart downloads. Two copies of a CSV
//  escaper is how one of them ends up quoting commas but not line breaks.
// ============================================================

/** One CSV cell. Quoted when it holds a comma, a quote or any line break --
 *  \r included, which a Windows-authored note can carry. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows of objects to CSV, headers taken from the first row. */
export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return [headers.map(csvCell).join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\n");
}

/** A CSV blob Excel on Windows reads as UTF-8. The leading BOM is built
 *  with fromCharCode rather than typed into the source: an invisible
 *  character in a file is one a formatter can strip without a visible diff,
 *  and without it the em dashes in source notes come out mangled. */
export function csvBlob(csv: string): Blob {
  return new Blob([String.fromCharCode(0xfeff) + csv], { type: "text/csv;charset=utf-8;" });
}

/** Hand a blob to the browser as a download.
 *  iOS Safari opens a preview instead of saving; from there the reader
 *  saves or shares it, which is the platform's own behaviour. */
export function downloadBlob(filename: string, blob: Blob): void {
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

/** A filename-safe slug: "MMAI score — Japan" -> "mmai-score-japan". */
export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
