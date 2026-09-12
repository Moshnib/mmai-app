"use client";

// Hand-built SVG flags for exactly the markets this site covers -- not an
// emoji (Windows has historically rendered flag emoji as plain two-letter
// codes instead of actual flag images, unreliable for a professional site)
// and not a large external icon-font dependency for the handful needed.
// All rendered at a fixed 4:3 aspect ratio with rounded corners for a
// consistent, elegant look across the site.

const FLAGS: Record<string, React.ReactNode> = {
  US: (
    <>
      <rect width="28" height="20" fill="#B22234" />
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={i} y={(2 * i + 1) * (20 / 13)} width="28" height={20 / 13} fill="#fff" />
      ))}
      <rect width="11.2" height={20 * (7 / 13)} fill="#3C3B6E" />
    </>
  ),
  UK: (
    <>
      <rect width="28" height="20" fill="#012169" />
      <path d="M0,0 L28,20 M28,0 L0,20" stroke="#fff" strokeWidth="3.2" />
      <path d="M0,0 L28,20 M28,0 L0,20" stroke="#C8102E" strokeWidth="1.2" />
      <path d="M14,0 V20 M0,10 H28" stroke="#fff" strokeWidth="5.2" />
      <path d="M14,0 V20 M0,10 H28" stroke="#C8102E" strokeWidth="2.4" />
    </>
  ),
  EA: (
    <>
      <rect width="28" height="20" fill="#003399" />
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
        // Rounded to avoid SSR/client hydration mismatches from 1-ULP
        // differences in Math.cos/Math.sin between server and browser.
        const cx = Math.round((14 + 6.2 * Math.cos(angle)) * 1000) / 1000;
        const cy = Math.round((10 + 6.2 * Math.sin(angle)) * 1000) / 1000;
        return <circle key={i} cx={cx} cy={cy} r="0.9" fill="#FFCC00" />;
      })}
    </>
  ),
  CA: (
    <>
      <rect width="28" height="20" fill="#fff" />
      <rect width="7" height="20" fill="#D80621" />
      <rect x="21" width="7" height="20" fill="#D80621" />
      <path
        d="M14,3.5
           C13.6,5 12.8,5.8 11.3,6.1
           C11.9,6.6 12,7.1 11.6,7.6
           C10.5,7.2 9.6,7.3 8.7,8.1
           C9.3,8.5 9.3,9 8.8,9.4
           C9.8,10.1 10.9,10.2 12,9.7
           C11.7,10.8 11.2,11.7 10.3,12.4
           C11.2,12.6 12,12.4 12.7,11.8
           C12.9,12.8 13,13.8 12.7,15
           L14,14
           L15.3,15
           C15,13.8 15.1,12.8 15.3,11.8
           C16,12.4 16.8,12.6 17.7,12.4
           C16.8,11.7 16.3,10.8 16,9.7
           C17.1,10.2 18.2,10.1 19.2,9.4
           C18.7,9 18.7,8.5 19.3,8.1
           C18.4,7.3 17.5,7.2 16.4,7.6
           C16,7.1 16.1,6.6 16.7,6.1
           C15.2,5.8 14.4,5 14,3.5 Z"
        fill="#D80621"
      />
    </>
  ),
  JP: (
    <>
      <rect width="28" height="20" fill="#fff" />
      <circle cx="14" cy="10" r="5.6" fill="#BC002D" />
    </>
  ),
  AU: (
    <>
      <rect width="28" height="20" fill="#00008B" />
      <rect width="14" height="10" fill="#00008B" />
      <path d="M0,0 L14,10 M14,0 L0,10" stroke="#fff" strokeWidth="1.6" />
      <path d="M7,0 V10 M0,5 H14" stroke="#fff" strokeWidth="2.4" />
      <path d="M7,0 V10 M0,5 H14" stroke="#C8102E" strokeWidth="1" />
      <circle cx="22" cy="4" r="0.55" fill="#fff" />
      <circle cx="24" cy="9" r="0.55" fill="#fff" />
      <circle cx="21" cy="13" r="0.55" fill="#fff" />
      <circle cx="25" cy="15" r="0.55" fill="#fff" />
      <circle cx="19" cy="17" r="0.4" fill="#fff" />
    </>
  ),
  NO: (
    <>
      <rect width="28" height="20" fill="#EF2B2D" />
      <rect x="7" y="0" width="6" height="20" fill="#fff" />
      <rect x="0" y="7" width="28" height="6" fill="#fff" />
      <rect x="8.8" y="0" width="2.4" height="20" fill="#002868" />
      <rect x="0" y="8.8" width="28" height="2.4" fill="#002868" />
    </>
  ),
  // Sweden: Nordic cross, same construction as Norway above but two
  // colours instead of three. The vertical bar sits left of centre, as
  // on the real flag.
  SE: (
    <>
      <rect width="28" height="20" fill="#006AA7" />
      <rect x="7" y="0" width="4" height="20" fill="#FECC00" />
      <rect x="0" y="8" width="28" height="4" fill="#FECC00" />
    </>
  ),
  // ---------- Gulf Watch flags ----------
  AE: (
    <>
      <rect width="28" height="20" fill="#00732F" />
      <rect y="6.67" width="28" height="6.67" fill="#fff" />
      <rect y="13.33" width="28" height="6.67" fill="#000" />
      <rect width="7" height="20" fill="#FF0000" />
    </>
  ),
  BH: (
    <>
      <rect width="28" height="20" fill="#fff" />
      <rect x="8" width="20" height="20" fill="#CE1126" />
      <path d="M8,0 L11.2,2 L8,4 L11.2,6 L8,8 L11.2,10 L8,12 L11.2,14 L8,16 L11.2,18 L8,20 L0,20 L0,0 Z" fill="#fff" />
    </>
  ),
  QA: (
    <>
      <rect width="28" height="20" fill="#8D1B3D" />
      <path d="M10,0 L11.6,1.43 L10,2.86 L11.6,4.29 L10,5.71 L11.6,7.14 L10,8.57 L11.6,10 L10,11.43 L11.6,12.86 L10,14.29 L11.6,15.71 L10,17.14 L11.6,18.57 L10,20 L0,20 L0,0 Z" fill="#fff" />
    </>
  ),
  SA: (
    <>
      <rect width="28" height="20" fill="#006C35" />
      <rect x="4" y="8.5" width="16" height="1.6" fill="#fff" />
      <path d="M20,7.5 L24,9.3 L20,11.1 Z" fill="#fff" />
    </>
  ),
  KW: (
    <>
      <rect width="28" height="20" fill="#fff" />
      <rect y="6.67" width="28" height="6.67" fill="#CE1126" />
      <rect y="13.33" width="28" height="6.67" fill="#000" />
      <path d="M0,0 L7,0 L0,10 L7,20 L0,20 Z" fill="#007A3D" />
    </>
  ),
  OM: (
    <>
      <rect width="28" height="20" fill="#fff" />
      <rect y="6.67" width="28" height="6.67" fill="#DB161B" />
      <rect y="13.33" width="28" height="6.67" fill="#008000" />
      <rect width="8" height="20" fill="#DB161B" />
    </>
  ),
};

export default function Flag({ code, size = 20 }: { code: string; size?: number }) {
  const content = FLAGS[code];
  if (!content) return null;
  return (
    <svg
      width={size}
      height={size * (20 / 28)}
      viewBox="0 0 28 20"
      // Decorative -- every usage of this component sits directly next
      // to the country/market name as visible text, so the flag itself
      // adds nothing a screen reader needs to announce. Without this,
      // an unlabeled SVG can get read out as a bare "image", noise
      // right before the name that already says the same thing.
      aria-hidden="true"
      style={{ borderRadius: 3, boxShadow: "0 0 0 1px rgba(255,255,255,0.15)", flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}
    >
      {content}
    </svg>
  );
}
