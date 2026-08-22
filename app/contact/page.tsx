import Link from "next/link";
import ContactForm from "@/components/ContactForm";

export default function ContactPage() {
  return (
    <>
      <nav>
        <div className="navrow">
          <Link href="/" className="brand"><span className="dot" />MMAI</Link>
          <div className="navlinks">
            <Link href="/" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Overview</Link>
            <Link href="/trends" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Data Over Time</Link>
            <Link href="/compare" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Compare</Link>
            <Link href="/learn" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Learn</Link>
            <Link href="/sources" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Sources</Link>
            <button className="navlink active">Contact</button>
          </div>
        </div>
      </nav>

      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">CONTACT</p>
          <h1 className="headline" style={{ maxWidth: "20ch" }}>Get in touch</h1>
          <p className="sub">Found something wrong with the data? Have a question, a partnership idea, or something else? Tell us below.</p>
        </div>
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="wrap" style={{ maxWidth: 640 }}>
          <ContactForm />
        </div>
      </div>

      <footer>
        <div className="wrap">
          © 2026 MMAI — Moshnib Market Analysis Index. An analytical communication tool, not investment advice.
        </div>
      </footer>
    </>
  );
}
