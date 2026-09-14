import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import { pageMetadata } from "@/lib/pageMetadata";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description:
    "Requests, partnership enquiries, corrections — every message is read personally. If you think something on MMAI is wrong, that is the most useful message you can send.",
  path: "/contact",
});

/**
 * A PAGE OF ITS OWN AGAIN.
 *
 * The form was folded into /about on the reasoning that the navigation was
 * already full at eight items. That was a navigation argument used to
 * settle a findability question, and it settled it the wrong way: a
 * contact form at the bottom of a long About page is a form most people
 * never reach. The site owner said so, and a dedicated Contact page is
 * what anybody looks for anyway.
 *
 * About keeps a link to it rather than the form itself, so the two pages
 * do each other's job instead of competing.
 */
export default function ContactPage() {
  return (
    <>
      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">CONTACT</p>
          <h1 className="headline" style={{ maxWidth: "20ch" }}>
            Every message is read personally
          </h1>
          <p className="sub" style={{ maxWidth: "62ch" }}>
            Requests, partnership enquiries, or a thought worth sharing. If you think something here is wrong,
            that is the most useful message you can send — the whole point of publishing the working is that
            somebody can check it.
          </p>
        </div>
      </div>

      <div className="section">
        <div className="wrap" style={{ maxWidth: 640 }}>
          <ContactForm />
        </div>
      </div>
    </>
  );
}
