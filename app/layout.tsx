import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import SiteFooter from "@/components/SiteFooter";
import { SITE_URL } from "@/lib/siteUrl";
import StructuredData from "@/components/StructuredData";

const DESCRIPTION =
  "A transparent macro-market intelligence index — every formula published, every source licensed, no black box.";

export const metadata: Metadata = {
  // Required before any URL-based metadata (like the OG image below) will
  // resolve to an absolute address. Driven by NEXT_PUBLIC_SITE_URL so a
  // domain move cannot silently leave the canonical URL on the old host --
  // which would tell search engines the new site is a duplicate of it.
  metadataBase: new URL(SITE_URL),
  title: {
    // The charter (§17) records "Measuring the Pulse of the Economy" as a
    // CONCLUDED decision with the next requirement "use as
    // descriptor/tagline". It appeared nowhere until 2026-08-31.
    default: "MMAI — Measuring the Pulse of the Economy",
    // Child pages set just their own name; this appends the brand.
    template: "%s — MMAI",
  },
  description: DESCRIPTION,
  applicationName: "MMAI",
  // The homepage's canonical. Every other page sets its own through
  // lib/pageMetadata.ts. Without these a search engine reaching both the
  // vercel.app address and the real domain has no instruction about which
  // is authoritative, and may treat the new domain as a duplicate of the
  // old one -- the single most costly thing to get wrong during a move.
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    siteName: "MMAI",
    title: "MMAI — Measuring the Pulse of the Economy",
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: "MMAI — Moshnib Macro Analysis Index",
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font --
            This rule targets the Pages Router, where a font added outside
            pages/_document.js loads for one page only. This is the App
            Router ROOT layout, which wraps every route, so the font does
            load site-wide. False positive. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* WHAT THIS SITE IS, IN A FORM A CRAWLER CAN READ.
            The prose says MMAI publishes an index built from official
            statistics; a crawler cannot infer that from prose. For a
            data site this is the difference between being indexed as a
            blog and being eligible for Google Dataset Search. Every
            field is derived from the engine, so none can drift from what
            the site actually publishes. */}
        <StructuredData />
      </head>
      <body>
        {/* Standard "skip to content" pattern -- invisible until it
            receives keyboard focus (first Tab press on any page), so a
            keyboard user isn't forced through the full nav every single
            page load to reach the actual content. */}
        <a href="#main-content" className="skip-link">Skip to main content</a>
        {/* One nav for every page, rendered here rather than copy-pasted
            into each one (that duplication is what let the mobile menu go
            unbuilt for so long). Above every page's own <Suspense>
            boundary, so it stays visible during a page's loading fallback
            instead of disappearing with the rest of the content. */}
        <NavBar />
        <main id="main-content">{children}</main>
        {/* One footer for every page, rendered here rather than copy-pasted
            into each one -- it carries a live "last updated" stamp, so it has
            to be a single component that can re-check on its own. */}
        <SiteFooter />
      </body>
    </html>
  );
}
