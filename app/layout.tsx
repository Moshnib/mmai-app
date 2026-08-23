import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://mmai-app.vercel.app";
const DESCRIPTION =
  "A transparent macro-market intelligence index — every formula published, every source licensed, no black box.";

export const metadata: Metadata = {
  // Required before any URL-based metadata (like the OG image below) will
  // resolve to an absolute address. Update this if the site moves to a
  // custom domain.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MMAI — Moshnib Market Analysis Index",
    // Child pages set just their own name; this appends the brand.
    template: "%s — MMAI",
  },
  description: DESCRIPTION,
  applicationName: "MMAI",
  openGraph: {
    type: "website",
    siteName: "MMAI",
    title: "MMAI — Moshnib Market Analysis Index",
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: "MMAI — Moshnib Market Analysis Index",
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
