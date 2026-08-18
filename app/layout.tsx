import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MMAI — Moshnib Market Analysis Index",
  description:
    "A transparent macro-market intelligence index — every formula published, every source licensed, no black box.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
