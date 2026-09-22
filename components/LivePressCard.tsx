"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import VideoTiles from "@/components/VideoTiles";
import { checked } from "@/lib/videoList";
import { useNow } from "@/lib/liveTime";
import {
  liveState, daysUntil, conferences, youtubeChannelUrl, youtubeLiveEmbedUrl,
  type Conference, type PressVideo,
} from "@/lib/pressConferences";

const keyOf = (c: Conference) => `${c.bank}-${c.date}`;

/**
 * THE NEXT CENTRAL BANK PRESS CONFERENCE, AND A WAY TO WATCH IT LIVE.
 *
 * Costs the homepage almost nothing: no YouTube script, frame, image or
 * cookie is loaded until the reader presses play. Until then this is a
 * line of text. The player is youtube-nocookie, and the only frame the
 * site's CSP allows (next.config.ts).
 *
 * The schedule and the rules for "live" are in lib/pressConferences.ts.
 * A "Watch on YouTube" link is always there, player or not: the live
 * embed follows whatever the channel is streaming, and if a bank ever
 * turns embedding off the link still works.
 */
export default function LivePressCard() {
  const now = useNow();
  // Players the reader has started. Held HERE, not in each player, so a
  // conference that overruns its window keeps playing: the card must never
  // pull a stream out from under someone mid-sentence. Only the reader's
  // own "Close player" removes one.
  const [playing, setPlaying] = useState<ReadonlySet<string>>(new Set());
  const setPlay = (key: string, on: boolean) =>
    setPlaying((prev) => { const n = new Set(prev); if (on) n.add(key); else n.delete(key); return n; });

  const state = now === null ? null : liveState(now);
  if (state && state.live.length === 0 && state.ended.length === 0 && state.next === null && playing.size === 0) return null;

  // Live, plus any the reader is still watching after its window closed.
  const shown = state
    ? [...state.live, ...conferences().filter((c) => playing.has(keyOf(c)) && !state.live.some((l) => keyOf(l) === keyOf(c)))]
    : [];
  const zone = now === null ? "UTC" : Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    // One element from the server render onward -- a placeholder of the
    // card's own height first, so the page does not jump, and the same
    // live region throughout, so a screen reader hears it fill in rather
    // than finding it already written.
    <div className={now === null ? "press-card press-card--placeholder" : "press-card"}>
      {/* Read out once when something goes live, not every tick: the text
          only changes when the set of live conferences does. */}
      <span className="sr-only" aria-live="polite">
        {state && state.live.length > 0 ? `Live now: ${state.live.map((c) => `${c.channel.name} press conference`).join(", ")}` : ""}
      </span>

      {state && <>
      {shown.map((c) => (
        <LiveNow key={keyOf(c)} c={c} playing={playing.has(keyOf(c))} onPlay={(on) => setPlay(keyOf(c), on)}
          over={!state.live.some((l) => keyOf(l) === keyOf(c))} />
      ))}

      {shown.length === 0 && state.ended.map((c) => (
        <p key={`${c.bank}-${c.date}`} className="press-line">
          <span className="press-tag">JUST ENDED</span>
          <span>{c.channel.name} press conference</span>
          <a className="press-link" href={youtubeChannelUrl(c.channel)} target="_blank" rel="noopener noreferrer">
            Watch the recording on YouTube ↗
          </a>
        </p>
      ))}

      {state.next && now !== null && (
        <p className="press-line">
          <span className="press-tag">NEXT LIVE</span>
          <span>
            <strong>{state.next.channel.name}</strong> press conference · {formatStart(state.next.start)}
            <span className="press-until"> · {inDays(daysUntil(state.next.start, now, zone))}</span>
          </span>
        </p>
      )}

      <RecentVideos />

      <p className="press-note">
        Scheduled press conferences from the Federal Reserve, the ECB, the Bank of England and the Bank of
        Canada, streamed by each bank. Videos play only when you press play.
      </p>
      </>}
    </div>
  );
}

function LiveNow({ c, playing, onPlay, over }: { c: Conference; playing: boolean; onPlay: (on: boolean) => void; over: boolean }) {
  const title = `${c.channel.name} press conference`;
  return (
    <div className="press-live">
      <p className="press-line">
        {over
          ? <span className="press-tag">SCHEDULED TIME OVER</span>
          : <span className="press-tag press-tag--live"><span className="live-dot" aria-hidden="true" /> LIVE NOW</span>}
        <strong>{title}</strong>
      </p>
      {c.channel.liveOn === "site" ? (
        // The Fed streams only on its own site; it posts to YouTube after.
        <a className="tap btn-primary press-watch" href={c.channel.siteLiveUrl} target="_blank" rel="noopener noreferrer">
          Watch live on federalreserve.gov ↗
        </a>
      ) : (
        <>
          <div className="press-player">
            {playing ? (
              // No sandbox, on purpose: YouTube needs scripts, same-origin,
              // popups and presentation, which leaves a sandbox nothing to
              // do, and the frame is already a separate origin. The
              // referrer is kept because YouTube refuses to play embeds
              // that send none (error 153).
              <iframe
                src={youtubeLiveEmbedUrl(c.channel)}
                title={`${title}, live on YouTube`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <button type="button" className="press-play" onClick={() => onPlay(true)}
                aria-label={`Play ${title} live (loads YouTube)`}>
                <span className="press-play-icon" aria-hidden="true">▶</span>
                <span>Play live</span>
                <span className="press-play-sub">loads YouTube</span>
              </button>
            )}
          </div>
          <p className="press-line">
            <a className="press-link" href={youtubeChannelUrl(c.channel)} target="_blank" rel="noopener noreferrer">
              Watch on YouTube ↗
            </a>
            {playing && (
              <button type="button" className="press-close" onClick={() => onPlay(false)}>
                Close player
              </button>
            )}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * THE LATEST RECORDED PRESS CONFERENCES, so there is always something to
 * watch between meetings. Read from the banks' own channels by
 * /api/press-videos after the page has loaded, so the homepage's HTML is
 * unchanged and a failed feed only hides this row. Speeches, briefings
 * and the other channels are on the Videos page.
 */
function RecentVideos() {
  const [videos, setVideos] = useState<PressVideo[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/press-videos")
      .then((r) => (r.ok ? r.json() : {}) as Promise<{ home?: unknown; videos?: unknown }>)
      // `videos` is the shape before the Videos page; a CDN copy of it can
      // outlive the deploy by a day, so it is still read.
      .then((j) => { if (!cancelled) setVideos(checked(j.home ?? j.videos)); })
      .catch(() => { if (!cancelled) setVideos([]); });
    return () => { cancelled = true; };
  }, []);

  if (!videos || videos.length === 0) return null;

  return (
    <div className="press-recent">
      <p className="press-tag">RECENT PRESS CONFERENCES</p>
      <VideoTiles videos={videos} className="press-tiles--home" initial={{ narrow: 4, wide: 6 }} />
      <Link className="press-link" href="/videos">All central bank videos →</Link>
    </div>
  );
}

function formatStart(t: number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(t));
}

function inDays(n: number): string {
  if (n <= 0) return "today";
  if (n === 1) return "tomorrow";
  return `in ${n} days`;
}
