// Fetch current ETH/JPY rate with caching and safe fallbacks
// Default: uses Coinbase, falls back to CoinGecko, then to seed value.

import { DEFAULT_PRICING_CONFIG } from "./nah-the-key.seed";

type Options = {
  revalidate?: number; // seconds
  fallback?: number;
};

async function fetchFromCoinbase(revalidate?: number): Promise<number | null> {
  try {
    const res = await fetch(
      "https://api.coinbase.com/v2/exchange-rates?currency=ETH",
      revalidate ? { next: { revalidate } } : { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: { currency?: string; rates?: Record<string, string> };
    };
    const jpy = data?.data?.rates?.JPY;
    const n = jpy ? Number(jpy) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

async function fetchFromCoingecko(revalidate?: number): Promise<number | null> {
  try {
    const url =
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=jpy";
    const res = await fetch(url, revalidate ? { next: { revalidate } } : {});
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ethereum?: { jpy?: number };
    };
    const n = data?.ethereum?.jpy;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function getEthJpy(options: Options = {}): Promise<number> {
  const revalidate = options.revalidate ?? 1800; // align with page ISR
  const fallback = options.fallback ?? DEFAULT_PRICING_CONFIG.ethJpy;

  // Try providers in order
  const fromCoinbase = await fetchFromCoinbase(revalidate);
  if (fromCoinbase && Number.isFinite(fromCoinbase)) return fromCoinbase;

  const fromCoingecko = await fetchFromCoingecko(revalidate);
  if (fromCoingecko && Number.isFinite(fromCoingecko)) return fromCoingecko;

  return fallback;
}
