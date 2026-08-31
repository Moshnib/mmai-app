import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import SiteFooter from "@/components/SiteFooter";

const SITE_URL = "https://mmai-app.vercel.app";
const DESCRIPTION =
  "A transparent macro-market intelligence index — every formula published, every source licensed, no black box.";

export const metadata: Metadata = {
  // Required before any URL-based metadata (like the OG image below) will
  // resolve to an absolute address. Update this if the site moves to a
  // custom domain.
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
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
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
