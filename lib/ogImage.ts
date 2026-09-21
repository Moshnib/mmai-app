// ============================================================
//  THE SOCIAL CARD'S PICTURE, DESCRIBED ONCE
//
//  app/opengraph-image.tsx draws it; lib/pageMetadata.ts points every page
//  at it. Until 21 September 2026 only the homepage showed it: Next attaches
//  the file-based image to the ROOT's openGraph, and a page that sets its
//  own openGraph (every page does, through pageMetadata) replaces that
//  object whole -- title, description and the picture with it. A /trends
//  link shared on WhatsApp came through as a bare title. Nothing on the
//  site itself looked wrong.
//
//  Its own file so the image route does not pull in the site-URL setup.
// ============================================================

export const OG_IMAGE_PATH = "/opengraph-image";
export const OG_ALT = "MMAI — Moshnib Macro Analysis Index";
export const OG_SIZE = { width: 1200, height: 630 };
