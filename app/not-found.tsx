import Link from "next/link";

export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <>
      <nav>
        <div className="navrow">
          <Link href="/" className="brand"><span className="dot" />MMAI</Link>
          <div className="navlinks">
            <Link href="/" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Overview</Link>
            <Link href="/trends" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Data Over Time</Link>
            <Link href="/compare" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Compare</Link>
            <Link href="/gulf-watch" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Gulf Watch</Link>
            <Link href="/learn" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Learn</Link>
            <Link href="/sources" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Sources</Link>
            <Link href="/contact" className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>Contact</Link>
          </div>
        </div>
      </nav>

      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">404 — PAGE NOT FOUND</p>
          <h1 className="headline" style={{ maxWidth: "20ch" }}>That page doesn&apos;t exist</h1>
          <p className="sub">
            The link may be out of date, or the address mistyped. Everything on MMAI is reachable from the
            menu above — or start from the <Link href="/" style={{ color: "var(--gold-deep)" }}>Overview</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
