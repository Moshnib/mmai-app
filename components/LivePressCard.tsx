"use client";

import { useEffect, useRef, useState } from "react";
import { useNow } from "@/lib/liveTime";
import {
  CHANNELS, liveState, daysUntil, conferences, youtubeChannelUrl, youtubeLiveEmbedUrl,
  VIDEO_ID, youtubeThumbUrl, youtubeVideoEmbedUrl, youtubeVideoUrl,
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
 * unchanged and a failed feed only hides this row. Each tile is a small
 * YouTube thumbnail (lazy, ~11 KB); the player itself loads on tap.
 */
function RecentVideos() {
  const [videos, setVideos] = useState<PressVideo[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/press-videos")
      .then((r) => (r.ok ? r.json() : { videos: [] }))
      .then((j) => { if (!cancelled) setVideos(Array.isArray(j.videos) ? j.videos.filter((v: PressVideo) => VIDEO_ID.test(v.videoId)) : []); })
      .catch(() => { if (!cancelled) setVideos([]); });
    return () => { cancelled = true; };
  }, []);

  // Opening moves the keyboard to the player's Close button; closing
  // hands it back to the tile that opened it.
  useEffect(() => { if (open) closeRef.current?.focus(); }, [open]);
  const close = () => {
    const id = open;
    setOpen(null);
    if (id) requestAnimationFrame(() => document.getElementById(`press-tile-${id}`)?.focus());
  };

  if (!videos || videos.length === 0) return null;
  const current = videos.find((v) => v.videoId === open);

  return (
    <div className="press-recent">
      <p className="press-tag">RECENT PRESS CONFERENCES</p>
      {current && (
        <div className="press-live">
          <div className="press-player">
            <iframe
              src={youtubeVideoEmbedUrl(current.videoId)}
              title={`${CHANNELS[current.bank].name}: ${current.title}`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <p className="press-line">
            <a className="press-link" href={youtubeVideoUrl(current.videoId)} target="_blank" rel="noopener noreferrer">
              Watch on YouTube ↗
            </a>
            <button ref={closeRef} type="button" className="press-close" onClick={close}>Close player</button>
          </p>
        </div>
      )}
      <ul className="press-tiles">
        {videos.map((v) => {
          const bank = CHANNELS[v.bank];
          const day = formatDay(v.published);
          return (
            <li key={v.videoId}>
              <button
                id={`press-tile-${v.videoId}`}
                type="button"
                className={`press-tile${v.videoId === open ? " is-open" : ""}`}
                onClick={() => setOpen(v.videoId)}
                aria-label={`Play ${bank.name} press conference, ${day} (loads YouTube)`}
              >
                <span className="press-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element --
                      YouTube's own image server, per its terms; next/image
                      would copy it through this site's optimiser. */}
                  <img src={youtubeThumbUrl(v.videoId)} alt="" width={320} height={180} loading="lazy" decoding="async" />
                  <span className="press-thumb-play" aria-hidden="true">▶</span>
                </span>
                <span className="press-tile-bank">{bank.short} · {day}</span>
                <span className="press-tile-title">{v.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
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
