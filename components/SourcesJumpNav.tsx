"use client";

import Flag from "@/components/Flag";
import { slugify } from "@/lib/download";

/**
 * "ON THIS PAGE" FOR /sources.
 *
 * The page lists every source for every market, and it was 32 screens long
 * on a phone. The groups are folded now (components/SourcesTable.tsx), and
 * these links go straight to one and open it.
 *
 * Plain <a href="#..."> rather than next/link: this is a jump within the
 * page. The group is opened on CLICK as well as by the table's hashchange
 * listener, because following the same link twice changes no hash and so
 * fires no event -- a reader who closed a group and clicked its link again
 * would otherwise land on a closed fold.
 */
export default function SourcesJumpNav({
  scored,
  gulf,
}: {
  scored: Array<{ name: string; code?: string }>;
  gulf: Array<{ name: string; code?: string }>;
}) {
  function open(id: string) {
    const el = document.getElementById(id);
    if (el instanceof HTMLDetailsElement) el.open = true;
  }

  const row = (label: string, prefix: string, items: Array<{ name: string; code?: string }>) => (
    <div className="sources-jump-row">
      <span className="sources-jump-label">{label}</span>
      <ul className="sources-jump-list">
        {items.map((it) => {
          const id = `${prefix}-${slugify(it.name)}`;
          return (
            <li key={id}>
              <a href={`#${id}`} className="sources-jump-link" onClick={() => open(id)}>
                {it.code && <span aria-hidden="true"><Flag code={it.code} size={15} /></span>}
                {it.name}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <nav className="sources-jump" aria-label="On this page">
      {row("Scored markets", "src", scored)}
      {row("Gulf Watch", "gulf", gulf)}
      <div className="sources-jump-row">
        <span className="sources-jump-label">Also</span>
        <ul className="sources-jump-list">
          <li><a href="#export" className="sources-jump-link">Download the data</a></li>
          <li><a href="#disclaimer" className="sources-jump-link">Disclaimer</a></li>
        </ul>
      </div>
    </nav>
  );
}
