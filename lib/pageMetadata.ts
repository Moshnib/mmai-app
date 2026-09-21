// ============================================================
//  ONE PAGE'S METADATA, BUILT IN ONE PLACE
//
//  WHAT WAS WRONG. Every page set `title` and `description`, and Next
//  rendered them correctly into <title> and <meta name="description">.
//  Nothing set openGraph or twitter per page, so those inherited the
//  ROOT layout's — which meant every page on the site shared one social
//  card. Sharing /dashboard showed "MMAI — Measuring the Pulse of the
//  Economy" and the generic site description, as did /learn, /sources
//  and every other page.
//
//  That is invisible on the site itself and visible everywhere the site
//  is shared, which is the worst place for it to be wrong: a link posted
//  to WhatsApp, LinkedIn or Slack is often the first thing a new reader
//  sees of MMAI.
//
//  NOTHING EMITTED A CANONICAL URL either. That matters most right now,
//  because this site is about to move from a vercel.app address to a real
//  domain. Without canonicals, a search engine that reaches both hosts has
//  no instruction about which is authoritative and may treat the new
//  domain as a duplicate of the old one.
//
//  So a page declares its title, its description and its path, and this
//  builds the rest. A page cannot forget the social card or the canonical
//  because it never writes them.
// ============================================================

import type { Metadata } from "next";
import { SITE_URL } from "@/lib/siteUrl";
import { OG_ALT, OG_IMAGE_PATH, OG_SIZE } from "@/lib/ogImage";

export interface PageMeta {
  /** Page name only. The root layout's template appends " — MMAI". */
  title: string;
  /** One sentence. Used for search results, the social card, and nothing
   *  else — so it should read as a description of the page, not a slogan. */
  description: string;
  /** Path with a leading slash, exactly as it appears in lib/routes.ts. */
  path: string;
}

export function pageMetadata({ title, description, path }: PageMeta): Metadata {
  // The canonical is absolute, and built from SITE_URL so it follows the
  // domain automatically. metadataBase would resolve a relative path too,
  // but writing it out keeps the value greppable when a domain move is
  // being checked.
  const url = path === "/" ? SITE_URL : `${SITE_URL}${path}`;

  // The social card wants the page's OWN name, with the brand, because it
  // appears with no other context. On the page itself the brand is already
  // in the navigation, which is why <title> can stay short.
  const socialTitle = `${title} — MMAI`;

  // Written out, not inherited: this page's openGraph replaces the root's
  // whole, and the picture goes with it (lib/ogImage.ts). Relative, so
  // metadataBase makes it absolute on whatever domain the site is on.
  const image = { url: OG_IMAGE_PATH, ...OG_SIZE, alt: OG_ALT, type: "image/png" };

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "MMAI",
      title: socialTitle,
      description,
      url,
      locale: "en",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [image],
    },
  };
}
