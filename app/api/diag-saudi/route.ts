// ============================================================
// TEMPORARY DIAGNOSTIC ROUTE — not part of the app, delete after use.
// Tests whether Saudi Arabia's central bank and open-data portal are
// reachable from Vercel's production network. Local dev testing gave an
// ambiguous result (connection failures, not a Cloudflare-style block) —
// this settles it from the environment that actually matters.
// ============================================================

const TARGETS = [
  { name: "SAMA (Saudi Central Bank)", url: "https://www.sama.gov.sa" },
  { name: "Saudi Open Data Portal", url: "https://od.data.gov.sa" },
  { name: "GASTAT (control — already confirmed reachable)", url: "https://www.stats.gov.sa" },
];

export async function GET() {
  const results = await Promise.all(
    TARGETS.map(async (target) => {
      const start = Date.now();
      try {
        const res = await fetch(target.url, {
          method: "GET",
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(10000),
        });
        return {
          name: target.name,
          url: target.url,
          reachable: true,
          status: res.status,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        return {
          name: target.name,
          url: target.url,
          reachable: false,
          error: (err as Error).message,
          durationMs: Date.now() - start,
        };
      }
    })
  );

  return Response.json({ testedAt: new Date().toISOString(), results });
}
