"use client";

import { useEffect, useState } from "react";
import type { FeedItem } from "@/lib/fetchers/newsFeeds";
import { useNow } from "@/lib/liveTime";

/**
 * WHAT IS COMING, AND WHAT WAS JUST ANNOUNCED.
 *
 * Two columns, both first-hand: the ONS release calendar on the left
 * (the next UK figures and the day they land) and ECB decisions on the
 * right. No headlines from news outlets -- this site's whole claim is
 * that every line traces to the institution that published it, and an
 * aggregated headline cannot.
 *
 * It refreshes itself: the route behind it re-reads the feeds every
 * fifteen minutes, and this asks again on the same rhythm, so a page
 * left open stays current with nothing run by hand.
 *
 * WHEN THERE IS NOTHING, IT SAYS SO. An empty band is better than a
 * stale one, and a band that quietly disappears makes a reader wonder
 * whether the site broke.
 */
export default function NewsBand() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const now = useNow();

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/announcements")
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((j) => { if (!cancelled) setItems(Array.isArray(j.items) ? j.items : []); })
        .catch(() => { if (!cancelled) setItems([]); });
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Nothing at all: the section stays out of the page rather than
  // printing two empty columns.
  if (items !== null && items.length === 0) return null;

  const upcoming = (items ?? []).filter((i) => i.kind === "upcoming");
  const announced = (items ?? []).filter((i) => i.kind === "announcement");

  return (
    <div className="news-band">
      <div className="news-col">
        <p className="news-head">Coming up</p>
        {items === null ? (
          <p className="news-empty">Reading the release calendars…</p>
        ) : upcoming.length === 0 ? (
          <p className="news-empty">Nothing scheduled in the next three weeks.</p>
        ) : (
          <ul>
            {upcoming.map((i) => (
              <li key={i.url}>
                <span className="news-when">{when(i.at, now)}</span>
                <a href={i.url} target="_blank" rel="noopener noreferrer" className="news-link">{i.title}</a>
                <span className="news-src">{i.source}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="news-col">
        <p className="news-head">Just announced</p>
        {items === null ? (
          <p className="news-empty">Reading the central bank feeds…</p>
        ) : announced.length === 0 ? (
          <p className="news-empty">No decisions published in the last three weeks.</p>
        ) : (
          <ul>
            {announced.map((i) => (
              <li key={i.url}>
                <span className="news-when">{when(i.at, now)}</span>
                <a href={i.url} target="_blank" rel="noopener noreferrer" className="news-link">{i.title}</a>
                <span className="news-src">{i.source}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** "Tomorrow", "in 3 days", "2 days ago" -- and the date itself for
 *  anything further out, because "in 17 days" is not a thing anyone
 *  holds in their head. `now` is null until the browser has a clock, so
 *  the server and the first client render agree. */
function when(iso: string, now: number | null): string {
  const t = Date.parse(iso);
  const date = new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  if (now === null) return date;

  const days = Math.round((t - now) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1 && days <= 6) return `in ${days} days`;
  if (days < -1 && days >= -6) return `${Math.abs(days)} days ago`;
  return date;
}
