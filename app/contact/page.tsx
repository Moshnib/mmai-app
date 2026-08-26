import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Requests, partnership inquiries, or a thought worth sharing — every message is read personally.",
};

export default function ContactPage() {
  return (
    <>
      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">CONTACT</p>
          <h1 className="headline" style={{ maxWidth: "20ch" }}>Get in touch</h1>
          <p className="sub">MMAI is built for the people who rely on it, and every voice shapes where it goes next. Requests, partnership inquiries, or simply a thought worth sharing — every message is read personally, not filtered through a queue.</p>
        </div>
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap" style={{ maxWidth: 640 }}>
          <ContactForm />
        </div>
      </div>
    </>
  );
}
