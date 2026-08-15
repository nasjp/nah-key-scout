// Utilities for THE KEY: enrich OpenSea listings with per-house info
// and compute fair price metrics based on configurable coefficients.

import {
  addDays,
  dateIsoJst,
  daysUntilJst,
  getJstDowIndex,
  getJstMonthIndex,
  parseCheckinDateJst,
} from "./date-utils";
import {
  DEFAULT_PRICING_CONFIG,
  HOUSE_TABLE,
  hydrateThumbnails,
  resolveLeadtimeMargin,
  resolveOgImage,
  resolveSpecialDayFactor,
} from "./nah-the-key.seed";
import type {
  Area,
  Capacity,
  Dow,
  HouseId,
  HouseInfo,
  PricingConfig,
  Uncertainty,
} from "./nah-the-key.types";
import type { JoinedRow } from "./opensea-listings";

export type AnnotatedListing = JoinedRow & {
  houseId?: HouseId;
  area?: Area;
  capacity?: Capacity;
  baselinePerNightJpy?: number;
  /** baseline の根拠と確度。割安度の読み方が変わるので必ず一緒に運ぶ */
  baselineReason?: string;
  uncertainty?: Uncertainty;
  fairPerNightJpy?: number;
  actualPerNightJpy?: number;
  /** 割安度の点推定（正の値で割安） */
  discountPct?: number;
  /** baseline の推定誤差を織り込んだ下限・上限と、± の幅 */
  discountPctLower?: number;
  discountPctUpper?: number;
  discountMarginPct?: number;
  label?: "割安" | "やや割安" | "妥当" | "やや割高" | "割高";
  /** 目標割引率 + リードタイム安全マージンを満たす上限入札（ETH） */
  maxBidEth?: number;
  targetDiscountRate?: number;
  leadtimeMargin?: number;
  /** JST 暦日で見た残日数。負なら失効済み */
  daysUntilCheckin?: number;
  /** チェックイン日をどこから取ったか */
  checkinSource?: "trait" | "tokenId";
  checkinFromTokenId?: string;
  /** トレイトと tokenId の日付が食い違っている */
  checkinMismatch?: boolean;
  /** 判定できたか、できなかったなら理由 */
  status: ListingStatus;
  officialUrl?: string;
  officialThumbUrl?: string;
};

// Re-export seeds for convenience (public API compatibility)
export {
  HOUSE_TABLE,
  DEFAULT_PRICING_CONFIG,
  hydrateThumbnails,
  resolveOgImage,
  resolveSpecialDayFactor,
  resolveLeadtimeMargin,
  parseCheckinDateJst,
};

// ===================== Helpers =====================
const DOW: Dow[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_JP = ["日", "月", "火", "水", "木", "金", "土"] as const;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// dateIsoJst is imported from date-utils

function labelByDiscount(pct: number | undefined): AnnotatedListing["label"] {
  if (pct === undefined) return undefined;
  if (pct >= 30) return "割安";
  if (pct >= 15) return "やや割安";
  if (pct >= -5) return "妥当";
  if (pct >= -30) return "やや割高";
  return "割高";
}

function resolveLongStayFactor(nights: number, cfg: PricingConfig): number {
  const capped = clamp(nights, 1, 30);
  const exact = cfg.longStayFactor[String(capped)];
  if (exact !== undefined) return exact;

  const floorKey = Object.keys(cfg.longStayFactor)
    .map((key) => Number.parseInt(key, 10))
    .filter((key) => Number.isFinite(key) && key <= capped)
    .sort((a, b) => b - a)[0];

  return floorKey ? (cfg.longStayFactor[String(floorKey)] ?? 1.0) : 1.0;
}

// ===================== Core calculations =====================

export type NightFactor = {
  dateIso: string;
  dow: Dow;
  dowJp: string;
  month: number;
  monthFactor: number;
  dowFactor: number;
  specialFactor: number;
  /** その夜の合成係数（月 × 曜日 × 特異日） */
  factor: number;
};

/**
 * 泊数ぶんの「夜ごとの需要係数」を返す。
 * 月係数も曜日係数と同じく夜ごとに評価するので、月をまたぐ滞在も正しく効く。
 */
export function computeNightFactors(
  house: HouseInfo,
  checkin: Date,
  nights: number,
  cfg: PricingConfig = DEFAULT_PRICING_CONFIG,
): NightFactor[] {
  const n = Math.max(1, Math.floor(nights));
  return Array.from({ length: n }, (_, i) => {
    const d = addDays(checkin, i);
    const dowIdx = getJstDowIndex(d);
    const dow = DOW[dowIdx];
    const month = getJstMonthIndex(d) + 1;
    const dateIso = dateIsoJst(d);
    const monthFactor = cfg.monthFactor[house.area]?.[String(month)] ?? 1.0;
    const dowFactor = cfg.dowFactor[dow];
    const specialFactor = resolveSpecialDayFactor(dateIso, cfg);
    return {
      dateIso,
      dow,
      dowJp: DOW_JP[dowIdx],
      month,
      monthFactor,
      dowFactor,
      specialFactor,
      factor: monthFactor * dowFactor * specialFactor,
    };
  });
}

/**
 * 公正価格（1泊あたり）。
 *
 *   公正 = baseline × avg(夜ごとの 月×曜日×特異日) × 連泊係数
 *
 * リードタイムはここには入らない。「直前だから安い」は公正価値の話ではなく
 * 買い手が要求すべき安全マージンの話なので computeMaxBidEth 側で扱う。
 * この関数は now を参照しないため、同じ入力なら常に同じ値を返す。
 */
export function computeFairPerNightJpy(
  house: HouseInfo,
  checkin: Date,
  nights: number,
  cfg: PricingConfig = DEFAULT_PRICING_CONFIG,
): number {
  const factors = computeNightFactors(house, checkin, nights, cfg);
  const lNights = resolveLongStayFactor(nights, cfg);
  const fair =
    house.baselinePerNightJpy * avg(factors.map((f) => f.factor)) * lNights;
  return Math.round(fair);
}

export type FairBreakdown = {
  baselinePerNightJpy: number;
  nightFactors: NightFactor[];
  /** 夜ごと合成係数の平均 */
  demandAvg: number;
  longStay: { nights: number; factor: number };
  fairPerNightJpy: number;
};

export function computeFairBreakdown(
  house: HouseInfo,
  checkin: Date,
  nights: number,
  cfg: PricingConfig = DEFAULT_PRICING_CONFIG,
): FairBreakdown {
  const nightFactors = computeNightFactors(house, checkin, nights, cfg);
  const demandAvg = avg(nightFactors.map((f) => f.factor));
  const lNights = resolveLongStayFactor(nights, cfg);
  return {
    baselinePerNightJpy: house.baselinePerNightJpy,
    nightFactors,
    demandAvg,
    longStay: { nights: Math.max(1, Math.floor(nights)), factor: lNights },
    fairPerNightJpy: Math.round(
      house.baselinePerNightJpy * demandAvg * lNights,
    ),
  };
}

// ===================== 実効単価・割安度 =====================

/**
 * 実効単価（JPY/泊）。
 * レート未取得・価格0・泊数不明のいずれでも undefined を返し、推測で埋めない。
 */
export function computeActualPerNightJpy(
  priceEth: number | undefined,
  nights: number | undefined,
  cfg: PricingConfig = DEFAULT_PRICING_CONFIG,
): number | undefined {
  if (!priceEth || priceEth <= 0) return undefined;
  if (!nights || nights <= 0) return undefined;
  if (!cfg.ethJpy || cfg.ethJpy <= 0) return undefined;
  return Math.round((priceEth * cfg.ethJpy) / nights);
}

export type DiscountEstimate = {
  /** 点推定（％、正で割安） */
  discountPct: number;
  /** baseline の推定誤差を織り込んだ保守側の下限 */
  discountPctLower: number;
  /** 楽観側の上限 */
  discountPctUpper: number;
  /** 点推定から下限までの幅（＝表示する ± の大きさ） */
  discountMarginPct: number;
};

/**
 * 割安度と、その信頼区間。
 * baseline が推定値のハウスほど区間が広がるので、
 * ラベル付けとランキングは下限側で行う（推定誤差が大きいものが上位に来る現象を抑える）。
 */
export function computeDiscount(
  actualPerNightJpy: number | undefined,
  fairPerNightJpy: number | undefined,
  uncertainty: Uncertainty | undefined,
  cfg: PricingConfig = DEFAULT_PRICING_CONFIG,
): DiscountEstimate | undefined {
  if (actualPerNightJpy === undefined || actualPerNightJpy <= 0) {
    return undefined;
  }
  if (fairPerNightJpy === undefined || fairPerNightJpy <= 0) return undefined;

  // 等級が無いものは最も不確かなものとして扱う
  const relError = cfg.baselineRelError[uncertainty ?? "High"];
  const pct = (fair: number) =>
    Math.round((1 - actualPerNightJpy / fair) * 100);

  const discountPct = pct(fairPerNightJpy);
  const discountPctLower = pct(fairPerNightJpy * (1 - relError));
  const discountPctUpper = pct(fairPerNightJpy * (1 + relError));
  return {
    discountPct,
    discountPctLower,
    discountPctUpper,
    discountMarginPct: discountPct - discountPctLower,
  };
}

/**
 * 上限入札（ETH）。
 * 目標割引率に加えて、チェックインが近いほど安全マージンを上乗せする。
 * 「直前だから公正価格が下がる」ではなく「直前だから安く買わないと割に合わない」
 * という向きで扱うことで、公正価格の意味と流動性リスクを混ぜない。
 */
export function computeMaxBidEth(
  fairPerNightJpy: number | undefined,
  nights: number | undefined,
  targetDiscountRate: number,
  cfg: PricingConfig = DEFAULT_PRICING_CONFIG,
  daysUntil?: number,
): number | undefined {
  if (!fairPerNightJpy || !nights || nights <= 0) return undefined;
  if (!cfg.ethJpy || cfg.ethJpy <= 0) return undefined;
  const required = clamp(
    targetDiscountRate + resolveLeadtimeMargin(daysUntil, cfg),
    0,
    0.95,
  );
  const maxJpy = fairPerNightJpy * nights * (1 - required);
  return Math.round((maxJpy / cfg.ethJpy) * 1e6) / 1e6; // 6 decimals
}

// ===================== ハウス名寄せ =====================

/** エリア判定に使う別名。トークン列で持ち、長いものから順に照合する */
const AREA_ALIASES: Array<{ area: Area; tokens: string[] }> = [
  { area: "KITA_KARUIZAWA", tokens: ["KITA", "KARUIZAWA"] },
  { area: "KITA_KARUIZAWA", tokens: ["KITAKARUIZAWA"] },
  { area: "KITA_KARUIZAWA", tokens: ["KARUIZAWA"] },
  { area: "AOSHIMA", tokens: ["AOSHIMA"] },
  { area: "FUKUOKA", tokens: ["FUKUOKA"] },
  { area: "NASU", tokens: ["NASU"] },
  { area: "MIURA", tokens: ["MIURA"] },
  { area: "MINAKAMI", tokens: ["MINAKAMI"] },
  { area: "SETOUCHI", tokens: ["SETOUCHI"] },
  { area: "ISHIGAKI", tokens: ["ISHIGAKI"] },
  { area: "RUSUTSU", tokens: ["RUSUTSU"] },
  { area: "TOKYO", tokens: ["TOKYO"] },
];

/** 自動導出（id / displayName）だけでは拾えない表記ゆれ */
const EXTRA_NAME_ALIASES: Record<HouseId, string[]> = {
  AOSHIMA_EXCLUSIVE: ["MASTERPIECE", "AOSHIMAEXCLUSIVE"],
  THE_NIGO_HOUSE_TOKYO: ["NIGO", "NIGOHOUSE", "THENIGOHOUSE"],
  IRORI_2_KITA_KARUIZAWA: ["IRORI2", "IRORI20"],
  CHILL_2_AOSHIMA: ["CHILL2", "CHILL20"],
  RUSUTSU: ["RUSUTSU", ""],
};

function tokenize(raw: string): string[] {
  return raw
    .toUpperCase()
    .replace(/\+/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** トークン列から既知のエリアを 1 つ切り出す（残りが名前トークンになる） */
function extractArea(tokens: string[]): { area?: Area; rest: string[] } {
  for (const alias of AREA_ALIASES) {
    const rest = [...tokens];
    let matched = true;
    for (const t of alias.tokens) {
      const i = rest.indexOf(t);
      if (i < 0) {
        matched = false;
        break;
      }
      rest.splice(i, 1);
    }
    if (matched) return { area: alias.area, rest };
  }
  return { rest: tokens };
}

function nameKeysFor(house: HouseInfo): string[] {
  const areaTokens = new Set(tokenize(house.area));
  const fromId = tokenize(house.id)
    .filter((t) => !areaTokens.has(t))
    .join("");
  const fromDisplay = tokenize(house.displayName)
    .filter((t) => !areaTokens.has(t))
    .join("");
  const extra = EXTRA_NAME_ALIASES[house.id] ?? [];
  return [...new Set([fromId, fromDisplay, ...extra])];
}

export type HouseIndex = {
  /** `${area}|${nameKey}` -> HouseId */
  byAreaAndName: Map<string, HouseId>;
  /** nameKey -> HouseId[]（エリア表記が無いときのフォールバック用） */
  byName: Map<string, HouseId[]>;
};

export function buildHouseIndex(
  table: Record<HouseId, HouseInfo> = HOUSE_TABLE,
): HouseIndex {
  const byAreaAndName = new Map<string, HouseId>();
  const byName = new Map<string, HouseId[]>();
  for (const house of Object.values(table)) {
    if (!house) continue;
    for (const key of nameKeysFor(house)) {
      byAreaAndName.set(`${house.area}|${key}`, house.id);
      const list = byName.get(key) ?? [];
      if (!list.includes(house.id)) list.push(house.id);
      byName.set(key, list);
    }
  }
  return { byAreaAndName, byName };
}

const DEFAULT_HOUSE_INDEX = buildHouseIndex();

/**
 * トレイトのハウス名を HouseId に解決する。
 *
 * 単語の部分一致で先勝ちさせると `CLUB SUITE TOKYO` が `THE NIGO HOUSE` に、
 * `GARDEN NASU` が `GARDEN AOSHIMA` に化ける。ここでは名前とエリアの
 * 両方が一致したときだけ解決し、決められないときは undefined を返す。
 */
export function resolveHouseId(
  houseRaw: string | undefined,
  index: HouseIndex = DEFAULT_HOUSE_INDEX,
): HouseId | undefined {
  if (!houseRaw) return undefined;
  const tokens = tokenize(houseRaw);
  if (tokens.length === 0) return undefined;
  const { area, rest } = extractArea(tokens);
  const nameKey = rest.join("");

  if (area) return index.byAreaAndName.get(`${area}|${nameKey}`);

  // エリア表記が無い場合は、その名前が一意に決まるときだけ採用する
  const candidates = index.byName.get(nameKey);
  return candidates && candidates.length === 1 ? candidates[0] : undefined;
}

// ===================== tokenId のチェックイン日 =====================

/**
 * THE KEY の tokenId は先頭 6 桁が YYMMDD。
 * 実データは 17 桁（例: 26102700000010100 = 2026-10-27 + 11 桁の連番）で、
 * 取得できた全件で先頭 6 桁がチェックイン日トレイトと一致している。
 *
 * トレイト欠落時の復元と、トレイトとの突き合わせに使う。
 * 桁数はコレクションによって変わりうるので固定せず、
 * 「数字のみ・6 桁以上・先頭 6 桁が実在する日付・年が 2020-2039」を条件にする。
 * 誤検出しても影響が出ないよう、あくまでトレイトが無いときの代替であり、
 * 食い違いは checkinMismatch として画面に出す。
 */
const TOKEN_ID_YEAR_MIN = 2020;
const TOKEN_ID_YEAR_MAX = 2039;

export function checkinIsoFromTokenId(
  tokenId: string | undefined,
): string | undefined {
  if (!tokenId || !/^\d{6,}$/.test(tokenId)) return undefined;
  const year = 2000 + Number(tokenId.slice(0, 2));
  if (year < TOKEN_ID_YEAR_MIN || year > TOKEN_ID_YEAR_MAX) return undefined;
  const iso = `${year}-${tokenId.slice(2, 4)}-${tokenId.slice(4, 6)}`;
  const d = parseCheckinDateJst(iso);
  if (!d) return undefined;
  // 2026-02-31 のような繰り上がり（と 00 月 / 00 日）を弾く
  return dateIsoJst(d) === iso ? iso : undefined;
}

// ===================== Main entry =====================

export type ListingStatus =
  | "ok"
  | "expired"
  | "unknown-house"
  | "unknown-checkin"
  | "unknown-nights"
  | "no-rate";

export type AnnotateOptions = {
  config?: PricingConfig;
  houses?: Partial<Record<HouseId, HouseInfo>>; // overrideable per house
  targetDiscountRate?: number; // for maxBid calc; default 0.25
  /** 失効判定・リードタイム計算の基準時刻。省略時は現在時刻 */
  now?: Date;
};

export function annotateListingsWithFairness(
  rows: JoinedRow[],
  opts: AnnotateOptions = {},
): AnnotatedListing[] {
  const cfg = opts.config ?? DEFAULT_PRICING_CONFIG;
  const houseTable: Record<HouseId, HouseInfo> = {
    ...HOUSE_TABLE,
    ...(opts.houses as Record<HouseId, HouseInfo> | undefined),
  };
  const index = opts.houses ? buildHouseIndex(houseTable) : DEFAULT_HOUSE_INDEX;
  const targetDiscount = opts.targetDiscountRate ?? 0.25;
  const now = opts.now ?? new Date();

  return rows.map((row) => {
    const houseId = resolveHouseId(row.house, index);
    const houseInfo = houseId ? houseTable[houseId] : undefined;

    // チェックイン日: トレイト/名称優先、無ければ tokenId から復元
    const checkinFromTokenId = checkinIsoFromTokenId(row.tokenId);
    const checkinJst = row.checkinJst ?? checkinFromTokenId;
    const checkinSource: AnnotatedListing["checkinSource"] = row.checkinJst
      ? "trait"
      : checkinFromTokenId
        ? "tokenId"
        : undefined;
    const checkinMismatch =
      row.checkinJst !== undefined &&
      checkinFromTokenId !== undefined &&
      row.checkinJst !== checkinFromTokenId;

    const checkin = parseCheckinDateJst(checkinJst);
    const nights = row.nights;
    const daysUntilCheckin = daysUntilJst(checkin, now);

    const status: ListingStatus = !houseInfo
      ? "unknown-house"
      : !checkin
        ? "unknown-checkin"
        : !nights || nights <= 0
          ? "unknown-nights"
          : (daysUntilCheckin ?? 0) < 0
            ? "expired"
            : !cfg.ethJpy
              ? "no-rate"
              : "ok";

    const measurable =
      houseInfo !== undefined &&
      checkin !== undefined &&
      nights !== undefined &&
      nights > 0;

    const fairPerNightJpy = measurable
      ? computeFairPerNightJpy(houseInfo, checkin, nights, cfg)
      : undefined;
    const actualPerNightJpy = measurable
      ? computeActualPerNightJpy(row.priceEth, nights, cfg)
      : undefined;

    // 失効したキーの割安度は意味を持たないので出さない
    const discount =
      status === "ok"
        ? computeDiscount(
            actualPerNightJpy,
            fairPerNightJpy,
            houseInfo?.uncertainty,
            cfg,
          )
        : undefined;
    const label = labelByDiscount(discount?.discountPctLower);
    const maxBidEth =
      status === "ok"
        ? computeMaxBidEth(
            fairPerNightJpy,
            nights,
            targetDiscount,
            cfg,
            daysUntilCheckin,
          )
        : undefined;

    const annotated: AnnotatedListing = {
      ...row,
      checkinJst,
      checkinSource,
      checkinFromTokenId,
      checkinMismatch: checkinMismatch || undefined,
      houseId,
      area: houseInfo?.area,
      capacity: houseInfo?.capacity,
      baselinePerNightJpy: houseInfo?.baselinePerNightJpy,
      baselineReason: houseInfo?.baselineReason,
      uncertainty: houseInfo?.uncertainty,
      officialUrl: houseInfo?.officialUrl,
      officialThumbUrl: houseInfo?.officialThumbUrl,
      fairPerNightJpy,
      actualPerNightJpy,
      discountPct: discount?.discountPct,
      discountPctLower: discount?.discountPctLower,
      discountPctUpper: discount?.discountPctUpper,
      discountMarginPct: discount?.discountMarginPct,
      label,
      maxBidEth,
      targetDiscountRate: status === "ok" ? targetDiscount : undefined,
      leadtimeMargin:
        status === "ok"
          ? resolveLeadtimeMargin(daysUntilCheckin, cfg)
          : undefined,
      daysUntilCheckin,
      status,
    };
    return annotated;
  });
}

// ===================== 診断 =====================

export type ListingDiagnostics = {
  total: number;
  ok: number;
  expired: number;
  unknownHouse: number;
  unknownCheckin: number;
  unknownNights: number;
  noRate: number;
  /** 解決できなかったハウス名（重複除去） */
  unresolvedHouseNames: string[];
};

/** 「無言で除外された件数」を可視化するための集計 */
export function summarizeDiagnostics(
  rows: AnnotatedListing[],
): ListingDiagnostics {
  const d: ListingDiagnostics = {
    total: rows.length,
    ok: 0,
    expired: 0,
    unknownHouse: 0,
    unknownCheckin: 0,
    unknownNights: 0,
    noRate: 0,
    unresolvedHouseNames: [],
  };
  const names = new Set<string>();
  for (const r of rows) {
    switch (r.status) {
      case "ok":
        d.ok++;
        break;
      case "expired":
        d.expired++;
        break;
      case "unknown-house":
        d.unknownHouse++;
        if (r.house) names.add(r.house);
        break;
      case "unknown-checkin":
        d.unknownCheckin++;
        break;
      case "unknown-nights":
        d.unknownNights++;
        break;
      case "no-rate":
        d.noRate++;
        break;
    }
  }
  d.unresolvedHouseNames = [...names].sort();
  return d;
}

// ===================== 並べ替え・集約 =====================

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

/** 並べ替えの基準は点推定ではなく保守側の下限 */
function rankOf(x: { discountPctLower?: number }): number {
  return x.discountPctLower ?? Number.NEGATIVE_INFINITY;
}

export function pickMostUndervalued(arr: AnnotatedListing[]): AnnotatedListing {
  return arr.slice().sort((a, b) => rankOf(b) - rankOf(a))[0] || arr[0];
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

export function sortByDiscountDesc<T extends { discountPctLower?: number }>(
  arr: T[],
): T[] {
  return arr.slice().sort((a, b) => rankOf(b) - rankOf(a));
}

export function sortByPriceAsc<T extends { priceEth?: number }>(arr: T[]): T[] {
  return arr.slice().sort((a, b) => (a.priceEth ?? 0) - (b.priceEth ?? 0));
}
