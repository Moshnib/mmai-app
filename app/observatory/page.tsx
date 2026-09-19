import type { Metadata } from "next";
import ObservatoryInner from "./ObservatoryInner";
import { pageMetadata } from "@/lib/pageMetadata";

export const metadata: Metadata = pageMetadata({
  title: "Observatory",
  description:
    "Countries tracked with real figures and no score — some because the index cannot read them, some while they are checked for it — with the reason printed beside each one.",
  path: "/observatory",
});

export default function ObservatoryPage() {
  return <ObservatoryInner />;
}
