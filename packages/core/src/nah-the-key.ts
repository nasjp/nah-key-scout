// Utilities for THE KEY: enrich OpenSea listings with per-house info
// and compute fair price metrics based on configurable coefficients.

import {
  addDays,
  dateIsoJst,
  getJstDowIndex,
  getJstMonthIndex,
  parseCheckinDateJst,
} from "./date-utils";
import {
  DEFAULT_PRICING_CONFIG,
  HOUSE_TABLE,
  hydrateThumbnails,
  resolveOgImage,
} from "./nah-the-key.seed";
import type {
  Area,
  Capacity,
  HouseId,
  HouseInfo,
  PricingConfig,
} from "./nah-the-key.types";
import type { JoinedRow } from "./opensea-listings";

export type AnnotatedListing = JoinedRow & {
  houseId?: HouseId;
  area?: Area;
  capacity?: Capacity;
  baselinePerNightJpy?: number;
  fairPerNightJpy?: number;
  actualPerNightJpy?: number;
  discountPct?: number; // 正の値で割安
  label?: "割安" | "やや割安" | "妥当" | "やや割高" | "割高";
  maxBidEth25off?: number; // 参考: 25%目標時の上限入札（ETH）
  officialUrl?: string;
  officialThumbUrl?: string;
};

// Re-export seeds for convenience (public API compatibility)
export {
  HOUSE_TABLE,
  DEFAULT_PRICING_CONFIG,
  hydrateThumbnails,
  resolveOgImage,
  parseCheckinDateJst,
};

// ===================== Helpers =====================
const DOW: Array<"Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat"> = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];
const DOW_JP = ["日", "月", "火", "水", "木", "金", "土"] as const;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// dateIsoJst is imported from date-utils

function resolveHouseId(houseRaw: string | undefined): HouseId | undefined {
  if (!houseRaw) return undefined;
  const key = houseRaw
    .trim()
    .toUpperCase()
    .replace(/[^+A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const tokens = key.split("_").filter(Boolean);
  const has = (token: string) =>
    tokens.some((part) => part === token || part === `+${token}`);

  if (has("DESK")) return "+DESK_FUKUOKA";
  if (has("CHEF")) return "+CHEF_FUKUOKA";
  if (has("ATELIER")) return "+ATELIER_FUKUOKA";
  if (has("BAR")) return "BAR_FUKUOKA";
  if (has("SOUND")) return "SOUND_FUKUOKA";
  if (has("PENTHOUSE")) return "PENTHOUSE_FUKUOKA";
  if (has("RETREAT")) return "RETREAT_FUKUOKA";
  if (has("DOMA")) return "DOMA_FUKUOKA";
  if (has("RUSUTSU")) return "RUSUTSU";
  if (has("SETOUCHI")) {
    if (has("360")) return "SETOUCHI_360";
    if (has("270")) return "SETOUCHI_270";
    if (has("180")) return "SETOUCHI_180";
  }
  if (has("NIGO") || key.includes("NIGO_HOUSE")) return "THE_NIGO_HOUSE_TOKYO";
  if (has("NATURE") && has("WITHIN")) return "NATURE_WITHIN_KITA_KARUIZAWA";
  if (
    has("BASE") &&
    (has("KITA") || has("KITAKARUIZAWA") || key.includes("KITA_KARUIZAWA"))
  ) {
    if (has("L")) return "BASE_L_KITA_KARUIZAWA";
    if (has("M")) return "BASE_M_KITA_KARUIZAWA";
    if (has("S")) return "BASE_S_KITA_KARUIZAWA";
  }
  if (key.includes("IRORI2") || key.includes("IRORI_2"))
    return "IRORI_2_KITA_KARUIZAWA";
  if (has("IRORI")) return "IRORI_KITA_KARUIZAWA";
  if (has("MASU")) return "MASU_KITA_KARUIZAWA";
  if (has("COAST")) return "COAST_AOSHIMA";
  if (key.includes("CHILL2") || key.includes("CHILL_2"))
    return "CHILL_2_AOSHIMA";
  if (has("CHILL")) return "CHILL_AOSHIMA";
  if (has("SURF")) return "SURF_AOSHIMA";
  if (has("GARDEN")) return "GARDEN_AOSHIMA";
  if (has("MASTERPIECE") && has("NASU")) return "MASTERPIECE_NASU";
  if (has("MASTERPIECE") && has("AOSHIMA")) return "AOSHIMA_EXCLUSIVE";
  if (has("CAVE")) return "CAVE_NASU";
  if (has("THINK")) return "THINK_NASU";
  if (has("TOJI")) return "TOJI_MINAKAMI";
  if (has("EARTH")) return "EARTH_ISHIGAKI";
  if (has("CLUB") && has("SUITE") && has("MIURA")) return "CLUB_SUITE_MIURA";
  if (has("CLUB") && has("VILLA") && has("MIURA")) return "CLUB_VILLA_MIURA";
  if (has("TOKYO")) return "THE_NIGO_HOUSE_TOKYO";
  if (has("BASE") && (has("S") || key.includes("BASE_S")))
    return "BASE_S_KITA_KARUIZAWA";
  if (has("AOSHIMA")) return "AOSHIMA_EXCLUSIVE";
  return undefined;
}

function labelByDiscount(pct: number | undefined): AnnotatedListing["label"] {
  if (pct === undefined) return undefined;
  if (pct >= 30) return "割安";
  if (pct >= 15) return "やや割安";
  if (pct >= -5) return "妥当";
  if (pct >= -30) return "やや割高";
  return "割高";
}

function resolveLeadFactor(daysUntil: number, cfg: PricingConfig): number {
  const sorted = [...cfg.leadtimeFactor].sort((a, b) => a.days_lt - b.days_lt);
  for (const item of sorted) {
    if (daysUntil < item.days_lt) return item.factor;
  }
  return sorted.length ? sorted[sorted.length - 1].factor : 1.0;
}

// ===================== Core calculations =====================
export function computeFairPerNightJpy(
  house: HouseInfo,
  checkin: Date,
  nights: number,
  cfg: PricingConfig = DEFAULT_PRICING_CONFIG,
): number {
  const month = String(getJstMonthIndex(checkin) + 1);
  const sMonth = cfg.monthFactor[house.area]?.[month] ?? 1.0;

  // D_dow: 平均（泊数>1なら夜ごとに計算して平均）
  const dowFactors: number[] = [];
  for (let i = 0; i < nights; i++) {
    const d = addDays(checkin, i);
    const dow = DOW[getJstDowIndex(d)];
    dowFactors.push(cfg.dowFactor[dow]);
  }
  const dDow = avg(dowFactors);

  // L_nights
  const lNights = cfg.longStayFactor[String(clamp(nights, 1, 30))] ?? 1.0;

  // T_lead
  const today = new Date();
  const daysUntil = Math.max(
    0,
    Math.ceil((checkin.getTime() - today.getTime()) / 86400000),
  );
  const tLead = resolveLeadFactor(daysUntil, cfg);

  const fair = house.baselinePerNightJpy * sMonth * dDow * lNights * tLead;
  return Math.round(fair);
}

export type FairBreakdown = {
  baselinePerNightJpy: number;
  month: { month: number; area: Area; factor: number };
  dowFactors: Array<{
    dateIso: string;
    dow: "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
    dowJp: string;
    factor: number;
  }>;
  dowAvg: number;
  longStay: { nights: number; factor: number };
  leadtime: { daysUntil: number; factor: number };
  fairPerNightJpy: number;
};

export function computeFairBreakdown(
  house: HouseInfo,
  checkin: Date,
  nights: number,
  cfg: PricingConfig = DEFAULT_PRICING_CONFIG,
): FairBreakdown {
  const monthIdx = getJstMonthIndex(checkin) + 1;
  const sMonth = cfg.monthFactor[house.area]?.[String(monthIdx)] ?? 1.0;

  const dowFactors = Array.from({ length: nights }, (_, i) => {
    const d = addDays(checkin, i);
    const dow = DOW[getJstDowIndex(d)];
    return {
      dateIso: dateIsoJst(d),
      dow,
      dowJp: DOW_JP[getJstDowIndex(d)],
      factor: cfg.dowFactor[dow],
    };
  });
  const dDow = avg(dowFactors.map((x) => x.factor));

  const lNights = cfg.longStayFactor[String(clamp(nights, 1, 30))] ?? 1.0;

  const today = new Date();
  const daysUntil = Math.max(
    0,
    Math.ceil((checkin.getTime() - today.getTime()) / 86400000),
  );
  const tLead = resolveLeadFactor(daysUntil, cfg);

  const fair = Math.round(
    house.baselinePerNightJpy * sMonth * dDow * lNights * tLead,
  );
  return {
    baselinePerNightJpy: house.baselinePerNightJpy,
    month: { month: monthIdx, area: house.area, factor: sMonth },
    dowFactors,
    dowAvg: dDow,
    longStay: { nights, factor: lNights },
    leadtime: { daysUntil, factor: tLead },
    fairPerNightJpy: fair,
  };
}

export function computeActualPerNightJpy(
  priceEth: number,
  nights: number,
  cfg: PricingConfig = DEFAULT_PRICING_CONFIG,
): number {
  if (!nights || !nights) return 0;
  const jpy = priceEth * cfg.ethJpy;
  return Math.round(jpy / nights);
}

export function computeDiscountPct(
  actualPerNightJpy: number | undefined,
  fairPerNightJpy: number | undefined,
): number | undefined {
  if (!actualPerNightJpy || !fairPerNightJpy) return undefined;
  const pct = (1 - actualPerNightJpy / fairPerNightJpy) * 100;
  return Math.round(pct);
}

export function computeMaxBidEth(
  fairPerNightJpy: number | undefined,
  nights: number | undefined,
  targetDiscountRate: number, // 0.25 → 25%
  cfg: PricingConfig = DEFAULT_PRICING_CONFIG,
): number | undefined {
  if (!fairPerNightJpy || !nights || nights <= 0) return undefined;
  const totalFair = fairPerNightJpy * nights;
  const maxJpy = totalFair * (1 - targetDiscountRate);
  const maxEth = maxJpy / cfg.ethJpy;
  return Math.round(maxEth * 1e6) / 1e6; // 6 decimals
}

// ===================== Main entry =====================
export type AnnotateOptions = {
  config?: PricingConfig;
  houses?: Partial<Record<HouseId, HouseInfo>>; // overrideable per house
  targetDiscountRate?: number; // for maxBid calc; default 0.25
};

export function annotateListingsWithFairness(
  rows: JoinedRow[],
  opts: AnnotateOptions = {},
): AnnotatedListing[] {
  const cfg = opts.config ?? DEFAULT_PRICING_CONFIG;
  // ベーステーブル + オプションを統合し、idエイリアス（+付き/なし）も張る
  const baseTable: Record<HouseId, HouseInfo> = {
    ...HOUSE_TABLE,
    ...(opts.houses as Record<HouseId, HouseInfo> | undefined),
  };
  const houseTable: Record<HouseId, HouseInfo> = { ...baseTable };
  for (const item of Object.values(baseTable)) {
    if (!item) continue;
    // 物件の固有IDでのアクセス（例: idが"+ATELIER_FUKUOKA" でもOKに）
    if (item.id && !houseTable[item.id]) houseTable[item.id] = item;
    // 先頭'+'を除いたIDでもアクセス可能に（将来の差異に備え両対応）
    if (item.id?.startsWith("+") && !houseTable[item.id.slice(1)]) {
      houseTable[item.id.slice(1)] = item;
    }
  }
  const targetDiscount = opts.targetDiscountRate ?? 0.25;

  return rows.map((row) => {
    const houseId = resolveHouseId(row.house);
    const houseInfo = houseId ? houseTable[houseId] : undefined;
    const checkin = parseCheckinDateJst(row.checkinJst);
    const nights = row.nights ?? 1;

    const fairPerNightJpy =
      houseInfo && checkin
        ? computeFairPerNightJpy(houseInfo, checkin, nights, cfg)
        : undefined;
    const actualPerNightJpy =
      row.priceEth && nights
        ? computeActualPerNightJpy(row.priceEth, nights, cfg)
        : undefined;
    const discountPct = computeDiscountPct(actualPerNightJpy, fairPerNightJpy);
    const label = labelByDiscount(discountPct);
    const maxBidEth25off = computeMaxBidEth(
      fairPerNightJpy,
      nights,
      targetDiscount,
      cfg,
    );

    const annotated: AnnotatedListing = {
      ...row,
      houseId,
      area: houseInfo?.area,
      capacity: houseInfo?.capacity,
      baselinePerNightJpy: houseInfo?.baselinePerNightJpy,
      officialUrl: houseInfo?.officialUrl,
      officialThumbUrl: houseInfo?.officialThumbUrl,
      fairPerNightJpy,
      actualPerNightJpy,
      discountPct,
      label,
      maxBidEth25off,
    };
    return annotated;
  });
}

// Convenience: group by house
export function groupByHouse(
  rows: AnnotatedListing[],
): Record<string, AnnotatedListing[]> {
  const map: Record<string, AnnotatedListing[]> = {};
  for (const r of rows) {
    const key = r.houseId ?? r.house ?? "UNKNOWN";
    if (!map[key]) map[key] = [];
    map[key].push(r);
  }
  return map;
}

// Convenience: group by token (contract:tokenId)
export function groupByToken(
  rows: AnnotatedListing[],
): Record<string, AnnotatedListing[]> {
  const map: Record<string, AnnotatedListing[]> = {};
  for (const r of rows) {
    const key = `${r.contract}:${r.tokenId}`;
    if (!map[key]) map[key] = [];
    map[key].push(r);
  }
  return map;
}

export type AnnotatedWithCount = AnnotatedListing & { listingsCount: number };

export function pickMostUndervalued(arr: AnnotatedListing[]): AnnotatedListing {
  return (
    arr
      .slice()
      .sort((a, b) => (b.discountPct ?? -999) - (a.discountPct ?? -999))[0] ||
    arr[0]
  );
}

export function selectBestPerToken(
  rows: AnnotatedListing[],
): AnnotatedWithCount[] {
  const groups = groupByToken(rows);
  const picked: AnnotatedWithCount[] = [];
  for (const arr of Object.values(groups)) {
    const best = pickMostUndervalued(arr);
    picked.push({ ...best, listingsCount: arr.length });
  }
  return picked;
}

export function sortByDiscountDesc<T extends { discountPct?: number }>(
  arr: T[],
): T[] {
  return arr
    .slice()
    .sort((a, b) => (b.discountPct ?? -999) - (a.discountPct ?? -999));
}

export function sortByPriceAsc<T extends { priceEth?: number }>(arr: T[]): T[] {
  return arr.slice().sort((a, b) => (a.priceEth ?? 0) - (b.priceEth ?? 0));
}
