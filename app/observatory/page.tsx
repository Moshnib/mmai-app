import type { Metadata } from "next";
import ObservatoryInner from "./ObservatoryInner";
import { pageMetadata } from "@/lib/pageMetadata";

export const metadata: Metadata = pageMetadata({
  title: "Observatory",
  description:
    "Countries tracked with real figures and deliberately not scored — with the reason printed beside each one, because an unscored country with no explanation reads as missing data.",
  path: "/observatory",
});

export default function ObservatoryPage() {
  return <ObservatoryInner />;
}
