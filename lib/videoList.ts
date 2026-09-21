import { VIDEO_CHANNELS, VIDEO_ID, type PressVideo } from "@/lib/pressConferences";

/** What the browser accepts from /api/press-videos: only entries with a
 *  valid id and a known channel, whatever a cached or future answer holds.
 *  A kind or language missing from an older answer gets a safe default. */
export function checked(list: unknown): PressVideo[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((v): v is PressVideo =>
      !!v && typeof v === "object" && typeof v.videoId === "string" && VIDEO_ID.test(v.videoId)
      && typeof v.bank === "string" && Object.hasOwn(VIDEO_CHANNELS, v.bank)
      && typeof v.title === "string" && typeof v.published === "string")
    .map((v) => ({ ...v, kind: v.kind ?? "Press conference", lang: v.lang ?? "en" }));
}
