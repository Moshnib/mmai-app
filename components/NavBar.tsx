"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Single source of truth for the site nav -- previously duplicated
// identically across 8 page files, which is how the mobile menu never
// got built (no one change ever touched all 8 at once). Rendered once
// in app/layout.tsx, above every page's <Suspense> boundary, so it
// stays visible even during a page's loading fallback (Compare's
// fallback used to hide the entire nav while its data loaded).
const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/trends", label: "Data Over Time" },
  { href: "/compare", label: "Compare" },
  { href: "/gulf-watch", label: "Gulf Watch" },
  { href: "/stablecoins", label: "Stablecoins" },
  { href: "/learn", label: "Learn More" },
  { href: "/sources", label: "Sources" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // The panel would otherwise stay open across a client-side navigation
  // -- this component lives in the layout now, so it persists (doesn't
  // remount) between pages, unlike when nav markup was copy-pasted into
  // each page and reset for free. Adjusted directly during render (React's
  // documented pattern for "reset state when a prop changes") rather than
  // via a setState-in-effect, which the react-hooks/purity rule flags as
  // an extra, avoidable render pass.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    // No inline position here -- globals.css's `nav { position: sticky }`
    // was silently losing to an inline `position: relative` that existed
    // only to anchor .navpanel's `position: absolute` dropdown. `sticky`
    // establishes the same containing block relative/absolute/fixed do,
    // so the dropdown still positions correctly with the nav now actually
    // sticking to the top of the viewport while scrolling, as the
    // stylesheet already intended.
    <nav>
      <div className="navrow">
        <Link href="/" className="brand"><span className="dot" />MMAI</Link>

        <div className="navlinks">
          {NAV_ITEMS.map((item) => {
            const active = item.href === pathname;
            return active ? (
              <button key={item.href} className="navlink active" aria-current="page">{item.label}</button>
            ) : (
              <Link key={item.href} href={item.href} className="navlink" style={{ textDecoration: "none", display: "inline-block" }}>{item.label}</Link>
            );
          })}
        </div>

        <button
          type="button"
          className={`navburger${open ? " open" : ""}`}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav-panel"
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div id="mobile-nav-panel" className={`navpanel${open ? " open" : ""}`}>
        {NAV_ITEMS.map((item) => {
          const active = item.href === pathname;
          return active ? (
            <button key={item.href} className="navpanel-link active" aria-current="page">{item.label}</button>
          ) : (
            <Link key={item.href} href={item.href} className="navpanel-link">{item.label}</Link>
          );
        })}
      </div>
    </nav>
  );
}
