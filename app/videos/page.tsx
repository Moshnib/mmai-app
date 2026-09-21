import type { Metadata } from "next";
import VideosInner from "./VideosInner";
import { pageMetadata } from "@/lib/pageMetadata";

export const metadata: Metadata = pageMetadata({
  title: "Central bank videos",
  description:
    "Press conferences, rate decisions, speeches and briefings from eight central banks and the BIS, played from each institution's own YouTube channel.",
  path: "/videos",
});

export default function VideosPage() {
  return <VideosInner />;
}
