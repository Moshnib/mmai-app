// ============================================================
// Stablecoin supply, read directly from each blockchain.
//
// WHY THIS SOURCE AND NOT AN AGGREGATOR
// A token's supply is public ledger state: nobody owns it, no terms of
// service govern it, no attribution is required. That makes it cleaner
// than every macro source this project already publishes.
//
// DefiLlama was the obvious first stop and is NOT usable. Its terms
// (read 2026-08-28) forbid exactly what MMAI does: "republish the data
// in any form without permission... copy, scrape, harvest or otherwise
// exploit the Content & Data for commercial purposes without prior
// written consent." Same shape as the FRED clause that got FRED removed
// from this project. Do not reintroduce it without written permission.
//
// PEG PRICE IS DELIBERATELY ABSENT. Chainlink's on-chain oracle returns
// it (verified: USDC/USD = 0.999986), but Chainlink's terms carry a
// general prohibition on redistribution with no explicit allowance for
// republishing feed values commercially. Until that is cleared, or the
// price is read straight from an on-chain exchange pool, this module
// reports supply only.
//
// WHAT "ACCESS" MEANS HERE
// The DATA is unlicensed public ledger state. The ENDPOINT used to read
// it is a service with ordinary fair-use expectations. This runs twice a
// day, which is nothing, and every endpoint below is swappable -- the
// ledger is identical whoever serves it, so a provider going down is a
// URL change, never a data problem.
//
// THREE CHAIN FAMILIES, because stablecoins run on several chains at
// once and the same coin holds a SEPARATE supply on each:
//   - EVM (Ethereum and its relatives): eth_call totalSupply()
//   - Tron: TronGrid triggerconstantcontract, base58 addresses
//   - Solana: getTokenSupply against the mint account
// All three verified live 2026-08-28.
// ============================================================

export type StablecoinChain = "ethereum" | "tron" | "solana";

/** Where a coin's reserves sit. Not on-chain -- this is editorial
 *  metadata, maintained here by hand, and deliberately coarse: MMAI is
 *  not auditing anyone's reserves, only saying what kind of thing backs
 *  the token. */
export type StablecoinBacking = "fiat-backed" | "crypto-backed" | "synthetic";

export interface StablecoinToken {
  symbol: string;
  name: string;
  issuer: string;
  backing: StablecoinBacking;
  chain: StablecoinChain;
  address: string;
  /** Only meaningful for EVM and Tron; Solana returns a decimal-adjusted
   *  amount already. */
  decimals: number;
}

export interface StablecoinSupply {
  symbol: string;
  name: string;
  issuer: string;
  backing: StablecoinBacking;
  chain: StablecoinChain;
  /** Whole units of the peg currency, i.e. dollars. */
  supply: number;
}

// Every address below was called live on 2026-08-28 and returned a
// plausible supply. The long tail of 400+ stablecoins is deliberately
// excluded: a handful carry almost all the supply, and dead tokens add
// noise rather than insight.
export const STABLECOINS: StablecoinToken[] = [
  // ---------- Ethereum ----------
  { symbol: "USDT", name: "Tether", issuer: "Tether", backing: "fiat-backed", chain: "ethereum", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
  { symbol: "USDC", name: "USD Coin", issuer: "Circle", backing: "fiat-backed", chain: "ethereum", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  { symbol: "USDS", name: "Sky Dollar", issuer: "Sky", backing: "crypto-backed", chain: "ethereum", address: "0xdC035D45d973E3EC169d2276DDab16f1e407384F", decimals: 18 },
  { symbol: "DAI", name: "Dai", issuer: "Sky", backing: "crypto-backed", chain: "ethereum", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
  { symbol: "USDe", name: "Ethena USDe", issuer: "Ethena", backing: "synthetic", chain: "ethereum", address: "0x4c9EDD5852cd905f086C759E8383e09bff1E68B3", decimals: 18 },
  { symbol: "PYUSD", name: "PayPal USD", issuer: "PayPal", backing: "fiat-backed", chain: "ethereum", address: "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8", decimals: 6 },
  { symbol: "USD1", name: "USD1", issuer: "World Liberty Financial", backing: "fiat-backed", chain: "ethereum", address: "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d", decimals: 18 },
  { symbol: "USDG", name: "Global Dollar", issuer: "Paxos", backing: "fiat-backed", chain: "ethereum", address: "0xe343167631d89B6Ffc58B88d6b7fB0228795491D", decimals: 6 },
  { symbol: "FDUSD", name: "First Digital USD", issuer: "First Digital", backing: "fiat-backed", chain: "ethereum", address: "0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409", decimals: 18 },

  // ---------- Tron ----------
  // Tron holds MORE USDT than Ethereum does ($94.27B vs $88.31B when
  // this was written), across ~76 million holders -- driven heavily by
  // remittances and dollar access in emerging markets. Omitting Tron
  // would miss the largest single pool of the largest stablecoin.
  { symbol: "USDT", name: "Tether", issuer: "Tether", backing: "fiat-backed", chain: "tron", address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", decimals: 6 },
  { symbol: "USDC", name: "USD Coin", issuer: "Circle", backing: "fiat-backed", chain: "tron", address: "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8", decimals: 6 },

  // ---------- Solana ----------
  { symbol: "USDC", name: "USD Coin", issuer: "Circle", backing: "fiat-backed", chain: "solana", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  { symbol: "USDT", name: "Tether", issuer: "Tether", backing: "fiat-backed", chain: "solana", address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  { symbol: "PYUSD", name: "PayPal USD", issuer: "PayPal", backing: "fiat-backed", chain: "solana", address: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", decimals: 6 },
  { symbol: "USDG", name: "Global Dollar", issuer: "Paxos", backing: "fiat-backed", chain: "solana", address: "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH", decimals: 6 },
];

// ============================================================
// WHY THESE FIGURES DIFFER FROM AN AGGREGATOR'S
//
// Checked against a public aggregator on 2026-08-28 after the site
// owner spotted a gap. The differences are real and have concrete,
// verified causes -- they are definition differences, not errors.
//
// 1. TOTAL SUPPLY, NOT CIRCULATING SUPPLY. This module reads
//    totalSupply(): every token that exists on that chain. Aggregators
//    usually publish CIRCULATING supply, which subtracts tokens an
//    issuer has minted but not yet sold. Verified on-chain: Tether's
//    treasury (0x5754...B949) holds $1.90B of authorised-but-unissued
//    USDT on Ethereum alone. Real, counted here, excluded there.
//
// 2. WHICH TOKENS COUNT AS A STABLECOIN. USDe is a synthetic dollar
//    held to its peg by a hedged derivatives position rather than by
//    cash in a bank. Some aggregators bucket that separately. It is
//    included here and labelled "synthetic" on the page rather than
//    quietly folded in with the cash-backed ones.
//
// 3. COVERAGE. The list above is deliberately finite. USD1, USDG and
//    FDUSD were added after this check found them untracked. EURC is
//    deliberately EXCLUDED -- it is pegged to the euro, and this page
//    counts dollars.
//
// A hypothesis worth recording as REFUTED: that DAI and USDS
// double-count, since Sky lets holders convert one to the other. The
// Sky converter contract holds $0.00 of DAI, so no double count exists.
//
// The honest position is not to chase another site's number. It is to
// state precisely which measure this is, which the page does.
// ============================================================

const ENDPOINTS: Record<StablecoinChain, string> = {
  ethereum: "https://ethereum-rpc.publicnode.com",
  tron: "https://api.trongrid.io/wallet/triggerconstantcontract",
  solana: "https://api.mainnet-beta.solana.com",
};

const TIMEOUT_MS = 8000;

/** totalSupply() -- the first four bytes of its keccak hash, which is
 *  how an EVM chain identifies which function is being called. */
const TOTAL_SUPPLY_SELECTOR = "0x18160ddd";

/** Big integers divided down to whole dollars WITHOUT going through
 *  Number first. USDT's raw supply already exceeds Number.MAX_SAFE_INTEGER
 *  (9.0e15) -- it is ~9.4e16 at 6 decimals -- so converting the raw
 *  value to a Number before dividing silently loses precision. Divide in
 *  BigInt, convert after. */
function scaleDown(raw: bigint, decimals: number): number {
  // BigInt(10), not the 10n literal: this project targets ES2017 and
  // BigInt literals need ES2020. The constructor form is equivalent and
  // avoids raising the target for one line.
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = raw / divisor;
  const remainder = raw % divisor;
  return Number(whole) + Number(remainder) / Number(divisor);
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // No `next: { revalidate: 0 }` here, unlike the macro fetchers.
    // Those run inside a cron route where "always fresh" is right. This
    // one is called from a page that sets its own revalidate window, and
    // a per-fetch revalidate:0 OVERRIDES the page's setting -- it forced
    // /stablecoins to render dynamically, which would have meant every
    // visitor triggering eleven live blockchain calls. Caught by the
    // build, which reported the route as dynamic. Leaving this unset lets
    // the calling page decide, so the supply is read at most once per
    // window no matter how many people load the page.
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`request failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function readEvmSupply(token: StablecoinToken): Promise<number> {
  const json = (await postJson(ENDPOINTS.ethereum, {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{ to: token.address, data: TOTAL_SUPPLY_SELECTOR }, "latest"],
  })) as { result?: string; error?: { message?: string } };

  if (json.error) throw new Error(`RPC error: ${json.error.message ?? "unknown"}`);
  if (!json.result || !/^0x[0-9a-fA-F]+$/.test(json.result)) {
    throw new Error(`unexpected eth_call result: ${JSON.stringify(json.result)}`);
  }
  return scaleDown(BigInt(json.result), token.decimals);
}

async function readTronSupply(token: StablecoinToken): Promise<number> {
  // visible:true means addresses are the human-readable base58 form
  // ("TR7NH...") rather than Tron's hex encoding. owner_address is
  // required by the API but irrelevant for a constant (read-only) call,
  // so the contract's own address is passed.
  const json = (await postJson(ENDPOINTS.tron, {
    owner_address: token.address,
    contract_address: token.address,
    function_selector: "totalSupply()",
    visible: true,
  })) as { constant_result?: string[]; Error?: string; result?: { message?: string } };

  if (json.Error) throw new Error(`TronGrid error: ${json.Error}`);
  const hex = json.constant_result?.[0];
  if (!hex || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(`unexpected TronGrid result: ${JSON.stringify(json.constant_result)}`);
  }
  return scaleDown(BigInt(`0x${hex}`), token.decimals);
}

async function readSolanaSupply(token: StablecoinToken): Promise<number> {
  const json = (await postJson(ENDPOINTS.solana, {
    jsonrpc: "2.0",
    id: 1,
    method: "getTokenSupply",
    params: [token.address],
  })) as { result?: { value?: { amount?: string; decimals?: number } }; error?: { message?: string } };

  if (json.error) throw new Error(`Solana RPC error: ${json.error.message ?? "unknown"}`);
  const value = json.result?.value;
  // `amount` (raw string) is used rather than the convenient `uiAmount`,
  // which Solana returns as a float and which loses precision at these
  // magnitudes for the same reason scaleDown exists.
  if (!value?.amount || !/^\d+$/.test(value.amount)) {
    throw new Error(`unexpected getTokenSupply result: ${JSON.stringify(value)}`);
  }
  return scaleDown(BigInt(value.amount), value.decimals ?? token.decimals);
}

/** Reads one token's supply. Throws on any failure -- the caller decides
 *  whether one missing token should sink the whole run. */
export async function fetchStablecoinSupply(token: StablecoinToken): Promise<StablecoinSupply> {
  const read = token.chain === "ethereum" ? readEvmSupply : token.chain === "tron" ? readTronSupply : readSolanaSupply;
  const supply = await read(token);

  // A stablecoin with zero or absurd supply means the call succeeded but
  // returned something that is not a supply -- a wrong address, or a
  // proxy contract answering a different question. Better to fail loudly
  // than to publish a nonsense figure.
  if (!Number.isFinite(supply) || supply < 0 || supply > 1e15) {
    throw new Error(`${token.symbol} on ${token.chain}: implausible supply ${supply}`);
  }

  return {
    symbol: token.symbol,
    name: token.name,
    issuer: token.issuer,
    backing: token.backing,
    chain: token.chain,
    supply,
  };
}

/** Reads every configured token concurrently. One token failing yields
 *  null for that token rather than sinking the run, mirroring settle()
 *  in the refresh routes -- with eleven tokens across three independent
 *  networks, an all-or-nothing read would rarely complete. */
export async function fetchAllStablecoinSupplies(): Promise<Array<StablecoinSupply | null>> {
  return Promise.all(
    STABLECOINS.map(async (token) => {
      try {
        return await fetchStablecoinSupply(token);
      } catch (err) {
        console.error(`Stablecoin ${token.symbol}/${token.chain} failed:`, err instanceof Error ? err.message : err);
        return null;
      }
    })
  );
}
