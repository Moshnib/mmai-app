"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { FeedItem } from "@/lib/fetchers/newsFeeds";
import { groupNews, feedKey } from "@/lib/newsGroups";
import { useNow, formatAgo } from "@/lib/liveTime";

/**
 * WHAT THE INSTITUTIONS HAVE SAID, AND WHAT THEY WILL PUBLISH NEXT.
 *
 * Nine central banks and statistics offices, each read from its own
 * feed (lib/newsSources.ts). No headlines from news outlets -- this
 * site's whole claim is that every line traces to the institution that
 * published it, and an aggregated headline cannot.
 *
 * Most days nothing is published "today", so the band leads with how
 * recent the newest item is and shows only the groups that have
 * something: Today / Yesterday / Last 30 days / Coming up (the grouping
 * rules are in lib/newsGroups.ts). The list does not rotate or scroll: a
 * link that moves under a finger is a mis-click, the lesson the ticker
 * already taught.
 *
 * It refreshes itself: the route behind it re-reads the feeds every
 * fifteen minutes, and this asks again on the same rhythm, so a page
 * left open stays current with nothing run by hand.
 */
export default function NewsBand() {
  const [data, setData] = useState<{ items: FeedItem[]; reachable: boolean } | null>(null);
  const now = useNow();

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/announcements")
        .then((r) => (r.ok ? r.json() : { items: [], reachable: false }))
        .then((j) => {
          if (cancelled) return;
          // A cached answer from before this field existed has no
          // `reachable`; it had items, so treat it as reachable.
          setData({ items: Array.isArray(j.items) ? j.items : [], reachable: j.reachable !== false });
        })
        .catch(() => { if (!cancelled) setData({ items: [], reachable: false }); });
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Nothing at all, or no feed answered: the section stays out of the
  // page rather than printing an empty box.
  if (data !== null && (!data.reachable || data.items.length === 0)) return null;

  if (data === null || now === null) {
    return (
      <div className="news-band">
        <p className="news-empty">Reading the central bank and statistics office feeds…</p>
      </div>
    );
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { latest, groups } = groupNews(data.items, now, timeZone);

  return (
    <div className="news-band">
      {latest && (
        <p className="news-latest">
          <span className="live-dot" aria-hidden="true" />
          Latest: <b>{formatAgo(latest.at, now)}</b> · {latest.source}
        </p>
      )}
      <div className="news-groups">
        {groups.map((g) => (
          <div className="news-col" key={g.key}>
            <p className="news-head">{g.label}</p>
            <ul>
              {g.items.map((i) => (
                <li key={feedKey(i)}>
                  <span className="news-when">{i.when}</span>
                  <a href={i.url} target="_blank" rel="noopener noreferrer" className="news-link">{i.title}</a>
                  <span className="news-src" title={i.institution}>{i.source}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="news-credit">
        From each institution&rsquo;s own feed, under its own licence ·{" "}
        <Link href="/sources">licences on the Sources page</Link>
      </p>
    </div>
  );
}
