import { ImageResponse } from "next/og";
import { OG_ALT, OG_SIZE } from "@/lib/ogImage";

// The preview card shown whenever an MMAI link is shared on LinkedIn, X,
// WhatsApp, Slack, iMessage, etc. Without this file those platforms render a
// bare URL with no title, description, or image.
//
// Deliberately built from the site's own tokens (app/globals.css) rather than
// a stock template, so a shared link looks like the product it points at.
// LITERAL HEX, NOT var(): this is rendered to a PNG by Satori, which has no
// stylesheet to resolve a variable against. Keep in step with :root.

// From lib/ogImage.ts, which every page's metadata also points at, so the
// card each page names and the card this draws cannot disagree.
export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0A0F1A",
          padding: "72px 80px",
        }}
      >
        {/* Brand row — the gold mark + wordmark, matching the site nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 22, height: 22, borderRadius: 2, background: "#FFD166" }} />
          <div style={{ fontSize: 34, fontWeight: 700, color: "#E9ECF1", letterSpacing: 2 }}>MMAI</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 62,
              fontWeight: 700,
              color: "#E9ECF1",
              lineHeight: 1.15,
              maxWidth: 940,
            }}
          >
            Is today&apos;s macro environment supportive, or working against you?
          </div>
          <div style={{ fontSize: 27, color: "#9BA6B7", marginTop: 28, maxWidth: 900, lineHeight: 1.4 }}>
            One transparent number — every formula published, every source licensed, no black box.
          </div>
        </div>

        {/* A printed rule with one gold segment -- the site's single accent,
            where a report would put its section mark. */}
        <div style={{ display: "flex", height: 2, background: "#202B3D" }}>
          <div style={{ width: 120, height: 2, background: "#FFD166" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
