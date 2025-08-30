// Library for fetching OpenSea listings and joining with NFT traits

// ===================== Types =====================
export type PriceCurrent = {
  currency: string;
  decimals: number;
  value: string; // wei string
};

export type ListingPrice = {
  current: PriceCurrent;
};

export type OfferItem = {
  itemType: number;
  token: string; // contract address (ERC-721)
  identifierOrCriteria: string; // tokenId (decimal string; very large → stringで扱う)
  startAmount: string;
  endAmount: string;
};

export type ConsiderationItem = {
  itemType: number;
  token: string;
  identifierOrCriteria: string;
  startAmount: string;
  endAmount: string;
  recipient: string;
};

export type ProtocolParameters = {
  offerer: string;
  offer: OfferItem[];
  consideration: ConsiderationItem[];
  startTime: string; // unix seconds as string
  endTime: string; // unix seconds as string
  orderType: number;
  zone: string;
  zoneHash: string;
  salt: string;
  conduitKey: string;
  totalOriginalConsiderationItems: number;
  counter: number;
};

export type ProtocolData = {
  parameters: ProtocolParameters;
  signature: string | null;
};

export type Listing = {
  order_hash: string;
  chain: string; // "ethereum"
  protocol_address: string;
  price: ListingPrice;
  protocol_data: ProtocolData;
  type: string; // "basic", etc
};

export type ListingsResponse = {
  listings: Listing[];
  next?: string | null;
};

export type NftTrait = {
  trait_type: string;
  value: string | number;
};

export type NftApiResponse = {
  nft?: {
    name?: string;
    traits?: NftTrait[];
  };
};

export type JoinedRow = {
  orderHash: string;
  chain: string;
  contract: string;
  tokenId: string;
  priceEth: number;
  sellerNetEth: number;
  feesEth: number;
  startTimeIso: string;
  endTimeIso: string;
  house?: string;
  // trait由来の場所（例: FUKUOKA, AOSHIMA など）
  place?: string;
  nights?: number;
  checkinJst?: string;
  openseaAssetUrl: string;
};

// ===================== Helpers =====================

function weiToEth(wei: string): number {
  // safe for up to ~1e20 range as decimal string → parse via BigInt then to Number (lossless for ETH sized values)
  const bi = BigInt(wei);
  const eth = Number(bi) / 1e18;
  return eth;
}

function sumWei(items: { startAmount: string }[]): string {
  let sum = 0n;
  for (const it of items) sum += BigInt(it.startAmount);
  return sum.toString();
}

function unixToIso(secStr: string): string {
  const n = Number(secStr);
  return Number.isFinite(n) ? new Date(n * 1000).toISOString() : "";
}

function buildOpenseaAssetUrl(
  chain: string,
  contract: string,
  tokenId: string,
): string {
  const net = chain === "ethereum" ? "ethereum" : chain;
  return `https://opensea.io/assets/${net}/${contract}/${tokenId}`;
}

function extractTrait(
  traits: NftTrait[] | undefined,
  keyIncludes: string,
): string | undefined {
  if (!traits) return undefined;
  // trait_type は「5 NUMBER OF NIGHTS」「3 HOUSE」「4 CHECK-IN DATE(JST)」のようにprefix番号が付くことがあるためincludesで検索
  const t = traits.find((t) =>
    t.trait_type.toLowerCase().includes(keyIncludes.toLowerCase()),
  );
  if (!t) return undefined;
  return String(t.value);
}

function parseNights(val: string | undefined): number | undefined {
  if (!val) return undefined;
  // "1", "1 Night", "1 night", などを想定
  const m = val.match(/\d+/);
  return m ? Number(m[0]) : undefined;
}

import { httpGetJson, mapWithConcurrency } from "@/lib/http";

// ===================== OpenSea API funcs =====================
const API_BASE = "https://api.opensea.io/api/v2";

export type Mode = "best" | "all";

export function buildListingsUrl(
  slug: string,
  mode: Mode,
  limit = 200,
  next?: string,
): string {
  const path =
    mode === "best"
      ? `listings/collection/${slug}/best`
      : `listings/collection/${slug}/all`;
  const u = new URL(`${API_BASE}/${path}`);
  u.searchParams.set("limit", String(limit));
  if (next) u.searchParams.set("next", next);
  return u.toString();
}

export async function fetchAllListings(
  slug: string,
  apiKey: string,
  mode: Mode = "best",
): Promise<Listing[]> {
  const headers = { "X-API-KEY": apiKey };
  let next: string | undefined;
  const all: Listing[] = [];
  do {
    const url = buildListingsUrl(slug, mode, 200, next);
    const json = await httpGetJson<ListingsResponse>(url, headers);
    all.push(...(json.listings ?? []));
    next = json.next ?? undefined;
  } while (next);
  return all;
}

export async function fetchNftMeta(
  contract: string,
  tokenId: string,
  apiKey: string,
): Promise<NftApiResponse> {
  const url = `${API_BASE}/chain/ethereum/contract/${contract}/nfts/${tokenId}`;
  return httpGetJson<NftApiResponse>(url, { "X-API-KEY": apiKey });
}

export function joinListingWithTraits(
  listing: Listing,
  meta: NftApiResponse | null,
): JoinedRow {
  const p = listing.protocol_data.parameters;
  const offer = p.offer[0];
  const tokenId = offer.identifierOrCriteria;
  const contract = offer.token;

  // buyer pays total (ETH)
  const priceEth = weiToEth(listing.price.current.value);

  // seller net (recipient === offerer)
  const sellerWei = sumWei(
    p.consideration.filter(
      (c) => c.recipient.toLowerCase() === p.offerer.toLowerCase(),
    ),
  );
  const feesWei = sumWei(
    p.consideration.filter(
      (c) => c.recipient.toLowerCase() !== p.offerer.toLowerCase(),
    ),
  );
  const sellerNetEth = weiToEth(sellerWei);
  const feesEth = weiToEth(feesWei);

  // traits
  const traits = meta?.nft?.traits;
  const houseBase = extractTrait(traits, "house");
  const place = extractTrait(traits, "place");
  const nightsStr = extractTrait(traits, "number of nights");
  const nights = parseNights(nightsStr);
  const checkinFromTrait = extractTrait(traits, "check-in date");
  // 厳密な日付: name から "OCT.27, 2025" 形式を優先的に抽出
  let checkinJst: string | undefined;
  if (meta?.nft?.name) {
    const nm = meta.nft.name;
    const m = nm.match(/\b([A-Za-z]{3,})\.?\s*(\d{1,2}),\s*(\d{4})\b/);
    if (m) {
      const [_all, monStr, dayStr, yearStr] = m;
      const monthMap: Record<string, string> = {
        JANUARY: "01",
        FEBRUARY: "02",
        MARCH: "03",
        APRIL: "04",
        MAY: "05",
        JUNE: "06",
        JULY: "07",
        AUGUST: "08",
        SEPTEMBER: "09",
        OCTOBER: "10",
        NOVEMBER: "11",
        DECEMBER: "12",
        JAN: "01",
        FEB: "02",
        MAR: "03",
        APR: "04",
        JUN: "06",
        JUL: "07",
        AUG: "08",
        SEP: "09",
        OCT: "10",
        NOV: "11",
        DEC: "12",
      };
      const key = monStr.toUpperCase();
      const mon = monthMap[key] ?? monthMap[key.slice(0, 3)];
      const dd = dayStr.padStart(2, "0");
      if (mon) checkinJst = `${yearStr}-${mon}-${dd}`;
    }
  }
  // それでも取れなければ trait を使用（YYYY-MM-DD/スラッシュはそのまま）
  if (!checkinJst && checkinFromTrait) checkinJst = checkinFromTrait;

  // house: "+CHEF" + place → "+CHEF FUKUOKA" のように正規化
  let house = houseBase || undefined;
  if (house && place && !house.toUpperCase().includes(place.toUpperCase())) {
    house = `${house} ${place}`;
  }

  const row: JoinedRow = {
    orderHash: listing.order_hash,
    chain: listing.chain,
    contract,
    tokenId,
    priceEth,
    sellerNetEth,
    feesEth,
    startTimeIso: unixToIso(p.startTime),
    endTimeIso: unixToIso(p.endTime),
    house: house || undefined,
    place: place || undefined,
    nights: nights || undefined,
    checkinJst: checkinJst || undefined,
    openseaAssetUrl: buildOpenseaAssetUrl(listing.chain, contract, tokenId),
  };
  return row;
}

// Orchestrator: fetch listings, fetch metas, join
export async function fetchOpenseaListingsJoined(
  slug: string,
  apiKey: string,
  mode: Mode = "all",
): Promise<JoinedRow[]> {
  const listings = await fetchAllListings(slug, apiKey, mode);
  // tokenId × contract のユニーク化
  const keyOf = (l: Listing) => {
    const p = l.protocol_data.parameters;
    const o = p.offer[0];
    return `${o.token}:${o.identifierOrCriteria}`;
  };
  const uniqMap = new Map<string, Listing>();
  for (const l of listings) uniqMap.set(keyOf(l), l);
  const uniqListings = [...uniqMap.values()];

  // メタデータ取得（レート制限に配慮して並列5）
  const metas = await mapWithConcurrency(
    uniqListings,
    async (l) => {
      const o = l.protocol_data.parameters.offer[0];
      try {
        return await fetchNftMeta(o.token, o.identifierOrCriteria, apiKey);
      } catch (_e) {
        return null;
      }
    },
    5,
  );

  // tokenKey → meta
  const metaMap = new Map<string, NftApiResponse | null>();
  uniqListings.forEach((l, i) => {
    const o = l.protocol_data.parameters.offer[0];
    metaMap.set(`${o.token}:${o.identifierOrCriteria}`, metas[i]);
  });

  // JOIN（元のlistings順で）
  const joined: JoinedRow[] = listings.map((l) => {
    const o = l.protocol_data.parameters.offer[0];
    const meta = metaMap.get(`${o.token}:${o.identifierOrCriteria}`) ?? null;
    return joinListingWithTraits(l, meta);
  });

  return joined;
}

// Unique tokens from joined rows
export type UniqueToken = { contract: string; tokenId: string };

export function uniqTokens(rows: JoinedRow[]): UniqueToken[] {
  const set = new Set<string>();
  const out: UniqueToken[] = [];
  for (const r of rows) {
    const key = `${r.contract}:${r.tokenId}`;
    if (set.has(key)) continue;
    set.add(key);
    out.push({ contract: r.contract, tokenId: r.tokenId });
  }
  return out;
}
