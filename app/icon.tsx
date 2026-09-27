import { ImageResponse } from "next/og";

// Replaces the stock create-next-app favicon, which was still shipping the
// Next.js logo -- another company's mark representing MMAI in every browser
// tab, bookmark, and search result.
//
// Generated rather than a binary .ico so the brand colors stay in one place
// and match app/globals.css. There's only room for one shape: the same gold
// mark used by the site's nav wordmark. Literal hex -- Satori renders this
// to a PNG and cannot resolve CSS variables.
//
// 96, NOT 32 (27 September 2026). Google showed a generic globe beside
// mmai.markets in search results while every other site had its mark. The
// icon was fine -- served, declared, crawlable -- but Google's own guidance
// asks for a square favicon LARGER than 48x48 so it holds up on phones and
// high-density screens, and 32 is under that. 96 is two multiples of 48,
// which is the size Google's documentation gives as an example.
//
// THE ADDRESS MUST STAY PUT. Google asks that the favicon URL not change
// often. Next serves this at /icon?<hash of this file>, so editing this
// file moves the address and restarts whatever clock Google keeps. Change
// it when the mark changes, not for tidying.
//
// app/favicon.ico HOLDS THE SAME PICTURE at the classic address, which was
// returning 404. It is generated FROM this file's output rather than drawn
// again -- run scripts/make-favicon.mjs after changing anything here, or
// the two will show different marks.

export const size = { width: 96, height: 96 };
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
          background: "#0A0F1A",
          borderRadius: 18,
        }}
      >
        {/* Half the width, as at 32px: the proportions are what made the
            mark readable when it was small, and scaling changed nothing
            about the design. */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 6,
            background: "#FFD166",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
