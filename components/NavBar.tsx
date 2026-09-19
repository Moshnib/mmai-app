"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Single source of truth for the site nav -- previously duplicated
// identically across 8 page files, which is how the mobile menu never
// got built (no one change ever touched all 8 at once). Rendered once
// in app/layout.tsx, above every page's <Suspense> boundary, so it
// stays visible even during a page's loading fallback (Compare's
// fallback used to hide the entire nav while its data loaded).
//
// SIX ENTRIES, NOT ELEVEN. The bar used to list every page in the order
// each was built: Overview, Dashboard, Data Over Time, Compare, Gulf
// Watch, Observatory, Stablecoins, Learn More, Sources, About, Contact.
// The owner found it too long and oddly ordered, and it was both -- a
// scored tool, an unscored watchlist and a contact form all at the same
// level. In September 2026 it became:
//
//   the three scored tools, in the order a reader uses them;
//   "Beyond the score"  -- the pages that track without scoring;
//   "About the index"   -- how it is built, where the data comes from.
//
// Contact moved to the footer, where readers look for it.
//
// "Overview" went too -- on the reasoning that the logo already goes
// home. That reasoning was wrong in one direction and the owner said so:
// a logo is only a way home to someone who KNOWS it is, and on a phone
// the menu had no route home at all, so a reader deep in the Sources page
// had to close the menu and find the mark at the top. Home is a link
// again, named Home, first in the row.

interface NavLink { href: string; label: string; note?: string }
interface NavGroup { id: string; label: string; items: NavLink[] }
type NavEntry = NavLink | NavGroup;

const NAV: NavEntry[] = [
  // HOME IS A LINK AGAIN, and this time it is not the old "Overview".
  // Dropping it left the logo as the only way back, which a reader has to
  // KNOW; on a phone the menu had no route home at all, so someone deep
  // in the Sources page had to close the menu and hunt for the logo. It
  // is named Home, because that is what the word is.
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/compare", label: "Compare" },
  { href: "/trends", label: "Trends" },
  {
    id: "beyond",
    label: "Beyond the score",
    items: [
      // Gulf Watch and the Observatory side by side deliberately: both
      // show countries with real figures and no score.
      { href: "/gulf-watch", label: "Gulf Watch", note: "Six Gulf economies, figure by figure" },
      { href: "/observatory", label: "Observatory", note: "Tracked, not scored" },
      { href: "/stablecoins", label: "Stablecoins", note: "How many dollars exist on a blockchain" },
    ],
  },
  {
    id: "about",
    label: "About the index",
    items: [
      { href: "/learn", label: "How the score works", note: "Every indicator and formula, in plain words" },
      { href: "/sources", label: "Data sources", note: "Where each number comes from, and its licence" },
      { href: "/about", label: "About MMAI", note: "Who makes it, and why" },
    ],
  },
];

function isGroup(e: NavEntry): e is NavGroup {
  return "items" in e;
}

/** The current page is a link that says so, not a do-nothing button:
 *  inside a list of links a dead button reads as broken to a screen
 *  reader. Following it simply reloads the same page. */
function PageLink({ item, pathname, className, onFollow }: { item: NavLink; pathname: string; className: string; onFollow: () => void }) {
  const active = item.href === pathname;
  return (
    <Link
      href={item.href}
      className={`${className}${active ? " active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onFollow}
    >
      {item.label}
    </Link>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // The panel would otherwise stay open across a client-side navigation
  // -- this component lives in the layout, so it persists (doesn't
  // remount) between pages. Adjusted directly during render (React's
  // documented pattern for "reset state when a prop changes") rather than
  // via a setState-in-effect, which the react-hooks/purity rule flags as
  // an extra, avoidable render pass.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
    setOpenGroup(null);
  }

  // Following any link closes whatever is open. The pathname reset above
  // cannot do it alone: following the link to the page you are already on
  // changes no pathname, and the menu would stay open over the page.
  const closeAll = () => {
    setOpen(false);
    setOpenGroup(null);
  };

  // A dropdown closes when the reader clicks anywhere else or presses
  // Escape. Escape hands focus back to the button that opened it, so a
  // keyboard reader is left where they were rather than at the top.
  useEffect(() => {
    if (!openGroup) return;
    const onPointer = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      document.getElementById(`navgroup-btn-${openGroup}`)?.focus();
      setOpenGroup(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [openGroup]);

  return (
    // No inline position here -- globals.css's `.sitenav { position: sticky }`
    // establishes the containing block the absolute panels position against.
    <nav className="sitenav" ref={navRef}>
      <div className="navrow">
        <Link href="/" className="brand" aria-label="MMAI home"><span className="dot" />MMAI</Link>

        <div className="navlinks">
          {NAV.map((entry) => {
            if (!isGroup(entry)) {
              return <PageLink key={entry.href} item={entry} pathname={pathname} className="navlink" onFollow={closeAll} />;
            }
            const expanded = openGroup === entry.id;
            const hasActive = entry.items.some((i) => i.href === pathname);
            return (
              <div
                key={entry.id}
                className="navgroup"
                // Tabbing out of an open menu closes it. Only when focus
                // actually lands somewhere else: Safari does not focus a
                // clicked link, so relatedTarget is null mid-click, and
                // closing then would swallow the click on the item.
                onBlur={(e) => {
                  const to = e.relatedTarget as Node | null;
                  if (to && !e.currentTarget.contains(to)) setOpenGroup(null);
                }}
              >
                <button
                  type="button"
                  id={`navgroup-btn-${entry.id}`}
                  className={`navlink navgroup-btn${hasActive ? " has-active" : ""}`}
                  aria-expanded={expanded}
                  aria-controls={`navmenu-${entry.id}`}
                  onClick={() => setOpenGroup(expanded ? null : entry.id)}
                >
                  {entry.label}
                  <span className="navgroup-caret" aria-hidden="true">▾</span>
                </button>
                <div id={`navmenu-${entry.id}`} className={`navmenu${expanded ? " open" : ""}`}>
                  {entry.items.map((item) => {
                    const active = item.href === pathname;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`navmenu-link${active ? " active" : ""}`}
                        aria-current={active ? "page" : undefined}
                        onClick={closeAll}
                      >
                        <span className="navmenu-label">{item.label}</span>
                        {item.note && <span className="navmenu-note">{item.note}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
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

      {/* On a phone nothing is nested: the groups are laid out in full
          under a label each. Labels are paragraphs, not headings -- every
          page's own h1 should be the first heading a reader meets. */}
      <div id="mobile-nav-panel" className={`navpanel${open ? " open" : ""}`}>
        {NAV.map((entry) =>
          isGroup(entry) ? (
            <div key={entry.id} className="navpanel-group" role="group" aria-labelledby={`navpanel-label-${entry.id}`}>
              <p id={`navpanel-label-${entry.id}`} className="navpanel-label">{entry.label}</p>
              {entry.items.map((item) => (
                <PageLink key={item.href} item={item} pathname={pathname} className="navpanel-link" onFollow={closeAll} />
              ))}
            </div>
          ) : (
            <PageLink key={entry.href} item={entry} pathname={pathname} className="navpanel-link" onFollow={closeAll} />
          ),
        )}
      </div>
    </nav>
  );
}
