import { ImageResponse } from "next/og";

// The preview card shown whenever an MMAI link is shared on LinkedIn, X,
// WhatsApp, Slack, iMessage, etc. Without this file those platforms render a
// bare URL with no title, description, or image.
//
// Deliberately built from the site's own tokens (app/globals.css) rather than
// a stock template, so a shared link looks like the product it points at.

export const alt = "MMAI — Moshnib Macro Analysis Index";
export const size = { width: 1200, height: 630 };
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
          background: "#08080D",
          padding: "72px 80px",
        }}
      >
        {/* Brand row — the gradient dot + wordmark, matching the site nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #B98CFF, #22D3EE)",
            }}
          />
          <div style={{ fontSize: 34, fontWeight: 700, color: "#F5F6FA", letterSpacing: 2 }}>MMAI</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 62,
              fontWeight: 700,
              color: "#F5F6FA",
              lineHeight: 1.15,
              maxWidth: 940,
            }}
          >
            Is today&apos;s macro environment supportive, or working against you?
          </div>
          <div style={{ fontSize: 27, color: "#8A8EA3", marginTop: 28, maxWidth: 900, lineHeight: 1.4 }}>
            One transparent number — every formula published, every source licensed, no black box.
          </div>
        </div>

        {/* Accent rule echoing the score gradient (red → orange → violet → cyan) */}
        <div
          style={{
            display: "flex",
            height: 8,
            borderRadius: 99,
            background: "linear-gradient(90deg, #E14B4B, #F0975B, #8B5CF6, #22D3EE)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
