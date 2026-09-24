"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  VIDEO_CHANNELS, LANGUAGE_NAME, youtubeThumbUrl, youtubeVideoEmbedUrl, youtubeVideoUrl,
  type PressVideo,
} from "@/lib/pressConferences";

/**
 * CENTRAL BANK VIDEOS AS TILES, WITH ONE SHARED PLAYER.
 *
 * Used under the homepage's live card and on the Videos page. Each tile is
 * a YouTube thumbnail (lazy, ~11 KB) with the institution, the kind of
 * video and the date -- always the date, so an old upload never reads as
 * new. Nothing plays and no frame loads until a tile is pressed; then one
 * youtube-nocookie player opens above the tiles, with "Watch on YouTube"
 * (for any video that will not embed) and "Close player".
 *
 * Titles not in English carry our own English label, with YouTube's title
 * beneath it marked in its language so a screen reader pronounces it.
 */
/** Phones show fewer tiles before "Show more". Worked out here rather than
 *  hidden with CSS, so the button can say exactly how many more there are
 *  and the hidden tiles' thumbnails are never requested. */
const NARROW = "(max-width: 759px)";
function useNarrow(): boolean {
  return useSyncExternalStore(
    (onChange) => { const m = window.matchMedia(NARROW); m.addEventListener("change", onChange); return () => m.removeEventListener("change", onChange); },
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}

export default function VideoTiles({ videos, className = "", initial }: {
  videos: PressVideo[];
  className?: string;
  /** Tiles shown before "Show more": { narrow, wide }. Omitted, all show. */
  initial?: { narrow: number; wide: number };
}) {
  const [open, setOpen] = useState<string | null>(null);
  // A video the institution has since made private or deleted: its
  // thumbnail 404s and it would not play either. The Bank of Japan did
  // exactly that to a 18 September press conference, and the tile sat
  // there broken until a browser check caught it. The tile goes; the rest
  // of the row is untouched. /api/refresh-videos marks it hidden on its
  // next run, so this is the stopgap between the two.
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const narrow = useNarrow();
  const [expanded, setExpanded] = useState(false);
  const firstRevealed = useRef<number | null>(null);
  const visible = videos.filter((v) => !gone.has(v.videoId));
  const shownCount = !initial || expanded ? visible.length : Math.min(visible.length, narrow ? initial.narrow : initial.wide);
  const hiddenCount = visible.length - shownCount;

  // After "Show more", the keyboard goes to the first tile it revealed.
  useEffect(() => {
    if (!expanded || firstRevealed.current == null) return;
    const v = visible[firstRevealed.current];
    firstRevealed.current = null;
    if (v) document.getElementById(`press-tile-${v.videoId}`)?.focus();
  }, [expanded, visible]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  // Opening moves the keyboard to the player's Close button; closing
  // hands it back to the tile that opened it.
  // The player opens above the tiles, which on the Videos page can be
  // well off-screen from the tile pressed; bring it into view first.
  useEffect(() => {
    if (!open) return;
    playerRef.current?.scrollIntoView({ block: "start" });
    closeRef.current?.focus({ preventScroll: true });
  }, [open]);
  const close = () => {
    const id = open;
    setOpen(null);
    if (id) requestAnimationFrame(() => document.getElementById(`press-tile-${id}`)?.focus());
  };

  const current = visible.find((v) => v.videoId === open);

  return (
    <>
      {current && (
        <div className="press-live" ref={playerRef}>
          <div className="press-player">
            {/* No sandbox and the referrer kept, for the reasons given on
                the live player in components/LivePressCard.tsx. */}
            <iframe
              src={youtubeVideoEmbedUrl(current.videoId)}
              title={`${VIDEO_CHANNELS[current.bank].name}: ${current.title}`}
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
      <ul className={`press-tiles ${className}`}>
        {visible.slice(0, shownCount).map((v) => {
          const channel = VIDEO_CHANNELS[v.bank];
          const day = formatDay(v.published);
          const language = v.lang === "en" ? "" : `, in ${LANGUAGE_NAME[v.lang]}`;
          return (
            <li key={v.videoId}>
              <button
                id={`press-tile-${v.videoId}`}
                type="button"
                className={`press-tile${v.videoId === open ? " is-open" : ""}`}
                onClick={() => setOpen(v.videoId)}
                aria-label={`Play ${channel.name} ${v.kind.toLowerCase()}, ${day}${language} (loads YouTube)`}
              >
                <span className="press-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element --
                      YouTube's own image server, per its terms; next/image
                      would copy it through this site's optimiser. */}
                  <img src={youtubeThumbUrl(v.videoId)} alt="" width={320} height={180} loading="lazy" decoding="async"
                    onError={() => setGone((prev) => new Set(prev).add(v.videoId))} />
                  <span className="press-thumb-play" aria-hidden="true">▶</span>
                </span>
                <span className="press-tile-bank">
                  {channel.short} · {v.kind} · {day}
                  {v.lang !== "en" && <span className="press-tile-lang"> · in {LANGUAGE_NAME[v.lang]}</span>}
                </span>
                <span className="press-tile-title">{v.title}</span>
                {v.original && <span className="press-tile-original" lang={v.lang}>{v.original}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {hiddenCount > 0 && (
        <button type="button" className="press-close press-more"
          onClick={() => { firstRevealed.current = shownCount; setExpanded(true); }}>
          Show {hiddenCount} more
        </button>
      )}
    </>
  );
}

export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
