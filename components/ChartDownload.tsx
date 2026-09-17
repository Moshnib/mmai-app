"use client";

import { useState, type RefObject } from "react";
import type { Series } from "@/components/TrendChart";
import { csvBlob, csvCell, downloadBlob, slugify } from "@/lib/download";
import { SITE_URL } from "@/lib/siteUrl";

// ============================================================
//  DOWNLOAD THIS CHART
//
//  Data sites put "download the image" and "download the data" beside the
//  chart itself, not on a separate export page. This is that row.
//
//  ATTRIBUTION TRAVELS WITH THE FILE. Each caller passes the credit lines
//  its sources ask for -- some licences require a set statement, some a
//  note that the data was processed -- and they are written into the
//  image footer and the end of the CSV. Nothing here claims a licence for
//  the file itself.
// ============================================================

export interface ChartDownloadSpec {
  /** Shown at the top of the image, and the basis of the filename. */
  title: string;
  /** Credit lines, one per source, exactly as the sources ask. */
  source: string[];
  /** Unit for the CSV column headers, e.g. "%" or "$B". */
  unit?: string;
}

/** A CSS colour that may be a var() reference, resolved to what the page
 *  actually paints -- a canvas cannot read custom properties. */
function resolveColour(colour: string, fallback: string): string {
  if (!colour.includes("var(")) return colour;
  const probe = document.createElement("span");
  probe.style.color = colour;
  document.body.appendChild(probe);
  const out = getComputedStyle(probe).color || fallback;
  probe.remove();
  return out;
}

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// ---------------------------------------------------------------- CSV

function chartCsv(spec: ChartDownloadSpec, series: Series[]): string {
  // Period in the chart's own order. Where a point carries an ISO sortKey
  // (the bond panel's daily dates), that is the period written -- "1 Jun 26"
  // is a label for a narrow axis, not a date a spreadsheet can read.
  const order = new Map<string, string>();
  for (const s of series) for (const d of s.data) if (!order.has(d.year)) order.set(d.year, d.sortKey ?? d.year);
  const labels = [...order.keys()].sort((a, b) => String(order.get(a)).localeCompare(String(order.get(b))));
  const unit = spec.unit ? ` (${spec.unit})` : "";
  const lookup = series.map((s) => new Map(s.data.map((d) => [d.year, d.value])));

  const lines = [["Period", ...series.map((s) => `${s.name}${unit}`)].map(csvCell).join(",")];
  for (const label of labels) {
    lines.push([order.get(label) ?? label, ...lookup.map((m) => m.get(label) ?? "")].map(csvCell).join(","));
  }
  lines.push("");
  for (const line of spec.source) lines.push(["Source", line].map(csvCell).join(","));
  lines.push(["Downloaded from", `${SITE_URL} on ${new Date().toISOString().slice(0, 10)}`].map(csvCell).join(","));
  return lines.join("\n");
}

// ---------------------------------------------------------------- PNG

const COPIED_STYLES = ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-opacity", "fill-opacity", "opacity", "font-size", "font-family", "font-weight", "text-anchor", "dominant-baseline"];

/** The chart's SVG as a self-contained image: every colour and font the
 *  stylesheet applied is copied onto the node, because the image is
 *  rendered with no stylesheet and no custom properties. */
function standaloneSvg(svg: SVGSVGElement): { markup: string; width: number; height: number } {
  const { width, height } = svg.getBoundingClientRect();
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const from = [svg, ...svg.querySelectorAll("*")];
  const to = [clone, ...clone.querySelectorAll("*")];
  from.forEach((node, i) => {
    const target = to[i] as SVGElement | undefined;
    if (!target) return;
    const cs = getComputedStyle(node);
    const style = COPIED_STYLES.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";");
    target.setAttribute("style", style);
  });
  // What a pointer left behind is not part of the chart.
  clone.querySelectorAll(".recharts-active-dot, .recharts-tooltip-cursor").forEach((n) => n.remove());
  // Recharts draws each line in by animating its dash pattern. A line
  // caught mid-animation would be exported half-drawn, so the data lines
  // lose their dash pattern here (the dashed grid keeps its own).
  clone.querySelectorAll(".recharts-line-curve").forEach((n) => {
    (n as SVGElement).style.strokeDasharray = "none";
    n.removeAttribute("stroke-dasharray");
  });
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(Math.round(width)));
  clone.setAttribute("height", String(Math.round(height)));
  return { markup: new XMLSerializer().serializeToString(clone), width, height };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

async function chartPng(spec: ChartDownloadSpec, series: Series[], svg: SVGSVGElement): Promise<Blob> {
  const { markup, width, height } = standaloneSvg(svg);
  // A data: URL rather than a blob: one -- both are allowed by the CSP, and
  // a data URL never trips the older-Safari rule that taints a canvas
  // drawn from a blob.
  const img = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("chart image did not load"));
  });
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  // Some WebKit versions reject decode() for an SVG they would still draw,
  // so a rejected decode falls back to the load event; only a real load
  // error gives up.
  await img.decode().catch(() => loaded);

  const paper = cssVar("--paper", "#0A0F1A");
  const ink = cssVar("--ink", "#F2F5FA");
  const slate = cssVar("--slate", "#B4BFCE");
  const hair = cssVar("--hair", "#202B3D");
  const display = cssVar("--font-display", "Georgia, serif");
  const body = cssVar("--font-body", "sans-serif");

  const scale = 2;
  const pad = 28;
  const innerWidth = Math.max(width, 560);
  const measure = document.createElement("canvas").getContext("2d")!;

  measure.font = `600 22px ${display}`;
  const titleLines = wrap(measure, spec.title, innerWidth);
  measure.font = `13px ${body}`;
  const legendItems = series.map((s) => ({ name: s.name, colour: resolveColour(s.color, slate), width: measure.measureText(s.name).width + 26 }));
  const legendRows: (typeof legendItems)[] = [[]];
  let rowWidth = 0;
  for (const item of legendItems) {
    if (rowWidth + item.width > innerWidth && legendRows[legendRows.length - 1].length) {
      legendRows.push([]);
      rowWidth = 0;
    }
    legendRows[legendRows.length - 1].push(item);
    rowWidth += item.width + 12;
  }
  measure.font = `12px ${body}`;
  const footerLines = [
    ...spec.source.flatMap((s) => wrap(measure, `Source: ${s}`, innerWidth)),
    `${SITE_URL.replace(/^https?:\/\//, "")} · downloaded ${new Date().toISOString().slice(0, 10)}`,
  ];

  const titleH = titleLines.length * 28;
  const legendH = series.length > 1 ? legendRows.length * 22 + 8 : 0;
  const footerH = footerLines.length * 18 + 16;
  const totalW = innerWidth + pad * 2;
  const totalH = pad + titleH + 14 + height + 10 + legendH + footerH + pad;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(totalW * scale);
  canvas.height = Math.round(totalH * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, totalW, totalH);

  let y = pad;
  ctx.fillStyle = ink;
  ctx.font = `600 22px ${display}`;
  ctx.textBaseline = "top";
  for (const line of titleLines) {
    ctx.fillText(line, pad, y);
    y += 28;
  }
  y += 14;
  ctx.drawImage(img, pad, y, width, height);
  y += height + 10;

  if (series.length > 1) {
    ctx.font = `13px ${body}`;
    for (const row of legendRows) {
      let x = pad;
      for (const item of row) {
        ctx.fillStyle = item.colour;
        ctx.fillRect(x, y + 6, 16, 3);
        ctx.fillStyle = ink;
        ctx.fillText(item.name, x + 22, y);
        x += item.width + 12;
      }
      y += 22;
    }
    y += 8;
  }

  ctx.strokeStyle = hair;
  ctx.beginPath();
  ctx.moveTo(pad, y + 0.5);
  ctx.lineTo(totalW - pad, y + 0.5);
  ctx.stroke();
  y += 10;
  ctx.fillStyle = slate;
  ctx.font = `12px ${body}`;
  for (const line of footerLines) {
    ctx.fillText(line, pad, y);
    y += 18;
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas export failed"))), "image/png")
  );
}

// ---------------------------------------------------------------- UI

export default function ChartDownload({
  spec,
  series,
  chartRef,
}: {
  spec: ChartDownloadSpec;
  series: Series[];
  chartRef: RefObject<HTMLDivElement | null>;
}) {
  const [status, setStatus] = useState("");
  // Every file starts "mmai-", once: several titles already begin "MMAI".
  const slug = slugify(spec.title);
  const base = slug.startsWith("mmai") ? slug : `mmai-${slug || "chart"}`;

  async function image() {
    // The LARGEST surface: Recharts draws each legend icon as its own small
    // svg.recharts-surface too, and the first match can be one of those.
    const surfaces = [...(chartRef.current?.querySelectorAll<SVGSVGElement>("svg.recharts-surface") ?? [])];
    const svg = surfaces.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return rb.width * rb.height - ra.width * ra.height;
    })[0] ?? null;
    if (!svg) return setStatus("The chart is not ready yet — try again in a moment.");
    setStatus("Preparing image…");
    try {
      downloadBlob(`${base}.png`, await chartPng(spec, series, svg));
      setStatus("");
    } catch {
      setStatus("The image could not be made in this browser. The data download still works.");
    }
  }

  function data() {
    setStatus("");
    downloadBlob(`${base}.csv`, csvBlob(chartCsv(spec, series)));
  }

  return (
    <div className="chart-download">
      <span className="chart-download-label">Download</span>
      <button type="button" className="chart-download-btn" onClick={image}>
        Image <span className="chart-download-fmt">PNG</span>
      </button>
      <button type="button" className="chart-download-btn" onClick={data}>
        Data <span className="chart-download-fmt">CSV</span>
      </button>
      <span className="chart-download-status" role="status" aria-live="polite">{status}</span>
    </div>
  );
}
