import { setTimeout as sleep } from "node:timers/promises";

import { fetchOpenseaListingsJoined, type JoinedRow } from "../lib/opensea-listings";

const BASE_URL = process.env.BASE_URL || "https://nah-key-scout.vercel.app";
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY || "";
const SLUG = process.env.SLUG || "the-key-nah";

async function httpGet(url: string): Promise<number> {
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  // drain body to free resources
  await res.arrayBuffer().catch(() => {});
  return res.status;
}

function uniqTokens(rows: JoinedRow[]): { contract: string; tokenId: string }[] {
  const set = new Set<string>();
  const out: { contract: string; tokenId: string }[] = [];
  for (const r of rows) {
    const key = `${r.contract}:${r.tokenId}`;
    if (set.has(key)) continue;
    set.add(key);
    out.push({ contract: r.contract, tokenId: r.tokenId });
  }
  return out;
}

async function run(): Promise<void> {
  // 1) warm root and about
  const roots = ["/", "/about"]; 
  for (const p of roots) {
    const url = `${BASE_URL}${p}`;
    const st = await httpGet(url).catch(() => 0);
    console.error(`[revalidate] ${url} -> ${st}`);
    await sleep(150);
  }

  // 2) discover detail pages via OpenSea
  if (!OPENSEA_API_KEY) {
    console.error("[revalidate] skip details: missing OPENSEA_API_KEY");
    return;
  }
  const rows = await fetchOpenseaListingsJoined(SLUG, OPENSEA_API_KEY, "all");
  const tokens = uniqTokens(rows);
  console.error(`[revalidate] discovered tokens: ${tokens.length}`);

  // 3) fetch each detail page with modest concurrency
  const concurrency = 6;
  let i = 0;
  async function worker(id: number) {
    while (true) {
      const idx = i++;
      if (idx >= tokens.length) break;
      const t = tokens[idx];
      const url = `${BASE_URL}/item/${t.tokenId}`;
      const st = await httpGet(url).catch(() => 0);
      console.error(`[revalidate:${id}] ${url} -> ${st}`);
      await sleep(150);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(tokens.length, 1)) }, (_, k) => worker(k)));
}

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
