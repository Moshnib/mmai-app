import Link from "next/link";

export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <>
      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">404 — PAGE NOT FOUND</p>
          <h1 className="headline" style={{ maxWidth: "20ch" }}>That page doesn&apos;t exist</h1>
          <p className="sub">
            The link may be out of date, or the address mistyped. Everything on MMAI is reachable from the
            menu above — or start from the <Link href="/" style={{ color: "var(--accent-2)" }}>Overview</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
