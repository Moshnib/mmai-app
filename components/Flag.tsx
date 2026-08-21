"use client";

// Hand-built SVG flags for exactly the markets this site covers -- not an
// emoji (Windows has historically rendered flag emoji as plain two-letter
// codes instead of actual flag images, unreliable for a professional site)
// and not a large external icon-font dependency for only 6 flags needed.
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
};

export default function Flag({ code, size = 20 }: { code: string; size?: number }) {
  const content = FLAGS[code];
  if (!content) return null;
  return (
    <svg
      width={size}
      height={size * (20 / 28)}
      viewBox="0 0 28 20"
      style={{ borderRadius: 3, boxShadow: "0 0 0 1px rgba(255,255,255,0.15)", flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}
    >
      {content}
    </svg>
  );
}
