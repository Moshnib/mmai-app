// Standalone live check of Gulf Watch's inflation sources, as the refresh
// uses them since 19 September (not the Supabase write, which needs the
// real service role key -- see the route's own manual-trigger check).
//
//   AE / KW / OM   IMF, fetched by the workflow relay (scripts/relay-gulf.mjs)
//   BH             data.gov.bh, via the relay (the route's own fetch is the fallback)
//   QA / SA        the route's own fetchers
//   QA rate        IMF MFS_IR, via the relay
//
// Live network, deliberately not in CI.
//
//   npx tsx scripts/verify-gulf-refresh-fetchers.ts
import { fetchImf, fetchBahrain, SERIES } from "./relay-gulf.mjs";
import { fetchQatarInflation } from "../lib/fetchers/qatarCpi";
import { fetchQatarRealEstate } from "../lib/fetchers/qatarRealEstate";
import { fetchSaudiInflation } from "../lib/fetchers/datasaudi";

async function settle<T>(label: string, promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    console.log(`  settle caught [${label}]:`, (err as Error).message);
    return null;
  }
}

type Relayed = { value: number | null; date?: string; reason?: string };

(async () => {
  const now = Date.now();
  let allOk = true;
  const line = (ok: boolean, label: string, detail: string) => {
    allOk = allOk && ok;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(30)} ${detail}`);
  };

  const bh = (await settle("Bahrain CPI", fetchBahrain(now))) as Relayed | null;
  line(bh?.value != null, "BH CPI (data.gov.bh)", bh?.value != null ? `${bh.value} (${bh.date})` : bh?.reason ?? "failed");

  for (const s of SERIES) {
    const r = (await settle(s.what, fetchImf(s, now))) as Relayed | null;
    line(r?.value != null, s.what, r?.value != null ? `${r.value} (${r.date})` : r?.reason ?? "failed");
  }

  const [qa, re] = await Promise.all([settle("Qatar CPI", fetchQatarInflation()), settle("Qatar RE", fetchQatarRealEstate())]);
  line(qa != null, "QA CPI (data.gov.qa)", qa ? `${qa.inflation} (${qa.observationDate})` : "failed");
  console.log(`      QA real estate: ${re?.realEstateValue ?? "failed"}`);
  const sa = await settle("Saudi CPI", fetchSaudiInflation());
  line(sa != null, "SA CPI (Data Saudi)", sa ? `${sa.inflation} (${sa.observationDate})` : "failed");

  console.log("\n" + (allOk ? "EVERY GULF INFLATION SOURCE ANSWERED" : "SOME SOURCES FAILED"));
  process.exit(allOk ? 0 : 1);
})();
