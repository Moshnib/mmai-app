-- ============================================================
--  PRESS VIDEOS — every central bank video the site has seen.
--
--  WHY A TABLE. The videos came straight from YouTube's channel feeds on
--  every cache refresh. On 22 September 2026 that endpoint answered 404 or
--  500 for eight of nine channels at once, the one that answered was
--  cached for an hour, and the homepage showed one video instead of six.
--  Stored rows mean a bad moment at YouTube can no longer shrink the list;
--  and because each feed only ever lists a channel's newest ~15 uploads,
--  the stored list also grows into a history the feeds cannot give.
--
--  THE RAW TITLE IS STORED, NOT OUR TAGS. Kind (press conference, speech,
--  ...) and language are worked out from the title each time the list is
--  read (lib/fetchers/pressVideos.ts RULES), so a rule changed later
--  applies to old rows too, instead of leaving them tagged as they were.
--
--  WRITTEN ONLY BY /api/refresh-videos, which checks CRON_SECRET and uses
--  the service role. Readers may SELECT and nothing else -- hidden rows
--  included, because the site must see the flag to keep a hidden video off
--  the page while its channel's feed still lists it (the data is public
--  either way). Nothing is deleted by the site. To take a video off the
--  site (a bank made it private, a wrong one slipped in):
--    update press_videos set hidden = true where video_id = '...';
--
--  Run once in the Supabase SQL editor. Safe to run twice.
-- ============================================================

create table if not exists press_videos (
  -- YouTube's id: exactly eleven of these characters, because it is put
  -- into a URL on the page.
  video_id   text primary key check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  -- The channel, as lib/pressConferences.ts VIDEO_CHANNELS names it.
  channel    text not null,
  -- The title exactly as YouTube gives it.
  title      text not null,
  -- When YouTube published it.
  published  timestamptz not null,
  -- When this site first saw it.
  first_seen timestamptz not null default now(),
  -- Set by hand to take a video off the site without deleting it.
  hidden     boolean not null default false
);

create index if not exists press_videos_published_idx on press_videos (published desc);

-- Permissions stated outright rather than left to the defaults: the public
-- key may read, and only read.
alter table press_videos enable row level security;
revoke all on press_videos from anon, authenticated;
grant select on press_videos to anon;

drop policy if exists "Public read access" on press_videos;
create policy "Public read access" on press_videos for select using (true);
