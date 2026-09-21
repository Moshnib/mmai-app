"use client";

import { useEffect, useState } from "react";
import VideoTiles from "@/components/VideoTiles";
import { VIDEO_CHANNELS, youtubeChannelUrl, CHANNELS, type PressVideo, type VideoChannelId } from "@/lib/pressConferences";
import { checked } from "@/lib/videoList";
import { useQuery, setQuery } from "@/lib/urlState";

/**
 * EVERY CENTRAL BANK VIDEO THE SITE CAN SEE, NEWEST FIRST.
 *
 * The same list the homepage row is cut from (/api/press-videos, one
 * cached read of nine channels), all of it: press conferences, rate
 * decisions, speeches, briefings. The page shell is static; the list loads
 * after it opens. A chip per institution filters it, kept in the address
 * as ?bank= so a filtered view can be shared.
 */
export default function VideosInner() {
  const [videos, setVideos] = useState<PressVideo[] | null>(null);
  const query = useQuery();
  const wanted = query.get("bank");
  const bank = wanted && Object.hasOwn(VIDEO_CHANNELS, wanted) ? (wanted as VideoChannelId) : null;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/press-videos")
      .then((r) => (r.ok ? r.json() : {}) as Promise<{ all?: unknown; videos?: unknown }>)
      .then((j) => { if (!cancelled) setVideos(checked(j.all ?? j.videos)); })
      .catch(() => { if (!cancelled) setVideos([]); });
    return () => { cancelled = true; };
  }, []);

  const present = videos ? (Object.keys(VIDEO_CHANNELS) as VideoChannelId[]).filter((id) => videos.some((v) => v.bank === id)) : [];
  const shown = videos?.filter((v) => !bank || v.bank === bank) ?? [];

  return (
    <>
      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">CENTRAL BANK VIDEOS</p>
          <h1 className="headline" style={{ maxWidth: "22ch" }}>Hear it from the people who set the rates</h1>
          <p className="sub">
            Press conferences, rate decisions, speeches and briefings, played from each institution&apos;s own
            YouTube channel: the Federal Reserve, the ECB, the Bank of England, the Bank of Canada, Sweden&apos;s
            Riksbank, Norges Bank, the Bank of Japan, the Bank of Korea and the Bank for International
            Settlements. Newest first; every video shows the day it was published.
          </p>
        </div>
      </div>

      <div className="section">
        <div className="wrap">
          <noscript>
            <p className="press-note">
              The video list needs JavaScript. The Federal Reserve&apos;s channel is at{" "}
              <a className="press-link" href={youtubeChannelUrl(CHANNELS.fed)}>youtube.com</a>, and each
              bank&apos;s own website links to its channel.
            </p>
          </noscript>

          {videos === null && <p className="news-empty">Reading the central banks&apos; channels…</p>}
          {videos !== null && videos.length === 0 && (
            <p className="news-empty">The channels could not be read just now. Try again in a few minutes.</p>
          )}

          {videos !== null && videos.length > 0 && (
            <div className="press-card">
              <div className="video-chips" role="group" aria-label="Show videos from">
                <button type="button" className="video-chip" aria-pressed={bank === null}
                  onClick={() => setQuery({ bank: null }, "replace")}>All</button>
                {present.map((id) => (
                  <button key={id} type="button" className="video-chip" aria-pressed={bank === id}
                    onClick={() => setQuery({ bank: id }, "replace")}>{VIDEO_CHANNELS[id].short}</button>
                ))}
              </div>
              {/* Keyed by the filter so an open player closes with it. */}
              <VideoTiles key={bank ?? "all"} videos={shown} className="press-tiles--page" />
              <p className="press-note">
                What each channel still lists: YouTube shows only an institution&apos;s newest uploads, so older
                videos drop out. Videos play only when you press play; preview pictures come from YouTube&apos;s
                image server, which sets no cookies. Titles not in English carry an English label, with the
                original beneath it.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
