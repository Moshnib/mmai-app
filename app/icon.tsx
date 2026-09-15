import { ImageResponse } from "next/og";

// Replaces the stock create-next-app favicon, which was still shipping the
// Next.js logo -- another company's mark representing MMAI in every browser
// tab, bookmark, and search result.
//
// Generated rather than a binary .ico so the brand colors stay in one place
// and match app/globals.css. At 32px there's only room for one shape: the
// same gold mark used by the site's nav wordmark. Literal hex -- Satori
// renders this to a PNG and cannot resolve CSS variables.

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#101826",
          borderRadius: 6,
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 2,
            background: "#D4B06A",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
