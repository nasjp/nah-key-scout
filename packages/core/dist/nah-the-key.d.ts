import { parseCheckinDateJst } from "./date-utils";
import { DEFAULT_PRICING_CONFIG, HOUSE_TABLE, hydrateThumbnails, resolveLeadtimeMargin, resolveOgImage, resolveSpecialDayFactor } from "./nah-the-key.seed";
import type { Area, Capacity, Dow, HouseId, HouseInfo, PricingConfig, Uncertainty } from "./nah-the-key.types";
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
export { HOUSE_TABLE, DEFAULT_PRICING_CONFIG, hydrateThumbnails, resolveOgImage, resolveSpecialDayFactor, resolveLeadtimeMargin, parseCheckinDateJst, };
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
export declare function computeNightFactors(house: HouseInfo, checkin: Date, nights: number, cfg?: PricingConfig): NightFactor[];
/**
 * 公正価格（1泊あたり）。
 *
 *   公正 = baseline × avg(夜ごとの 月×曜日×特異日) × 連泊係数
 *
 * リードタイムはここには入らない。「直前だから安い」は公正価値の話ではなく
 * 買い手が要求すべき安全マージンの話なので computeMaxBidEth 側で扱う。
 * この関数は now を参照しないため、同じ入力なら常に同じ値を返す。
 */
export declare function computeFairPerNightJpy(house: HouseInfo, checkin: Date, nights: number, cfg?: PricingConfig): number;
export type FairBreakdown = {
    baselinePerNightJpy: number;
    nightFactors: NightFactor[];
    /** 夜ごと合成係数の平均 */
    demandAvg: number;
    longStay: {
        nights: number;
        factor: number;
    };
    fairPerNightJpy: number;
};
export declare function computeFairBreakdown(house: HouseInfo, checkin: Date, nights: number, cfg?: PricingConfig): FairBreakdown;
/**
 * 実効単価（JPY/泊）。
 * レート未取得・価格0・泊数不明のいずれでも undefined を返し、推測で埋めない。
 */
export declare function computeActualPerNightJpy(priceEth: number | undefined, nights: number | undefined, cfg?: PricingConfig): number | undefined;
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
export declare function computeDiscount(actualPerNightJpy: number | undefined, fairPerNightJpy: number | undefined, uncertainty: Uncertainty | undefined, cfg?: PricingConfig): DiscountEstimate | undefined;
/**
 * 上限入札（ETH）。
 * 目標割引率に加えて、チェックインが近いほど安全マージンを上乗せする。
 * 「直前だから公正価格が下がる」ではなく「直前だから安く買わないと割に合わない」
 * という向きで扱うことで、公正価格の意味と流動性リスクを混ぜない。
 */
export declare function computeMaxBidEth(fairPerNightJpy: number | undefined, nights: number | undefined, targetDiscountRate: number, cfg?: PricingConfig, daysUntil?: number): number | undefined;
export type HouseIndex = {
    /** `${area}|${nameKey}` -> HouseId */
    byAreaAndName: Map<string, HouseId>;
    /** nameKey -> HouseId[]（エリア表記が無いときのフォールバック用） */
    byName: Map<string, HouseId[]>;
};
export declare function buildHouseIndex(table?: Record<HouseId, HouseInfo>): HouseIndex;
/**
 * トレイトのハウス名を HouseId に解決する。
 *
 * 単語の部分一致で先勝ちさせると `CLUB SUITE TOKYO` が `THE NIGO HOUSE` に、
 * `GARDEN NASU` が `GARDEN AOSHIMA` に化ける。ここでは名前とエリアの
 * 両方が一致したときだけ解決し、決められないときは undefined を返す。
 */
export declare function resolveHouseId(houseRaw: string | undefined, index?: HouseIndex): HouseId | undefined;
/**
 * THE KEY の tokenId は先頭 6 桁が YYMMDD（例: 261027000000 → 2026-10-27）。
 * トレイト欠落時の復元と、トレイトとの突き合わせに使う。
 * 解釈できない形式は素直に undefined を返す。
 */
export declare function checkinIsoFromTokenId(tokenId: string | undefined): string | undefined;
export type ListingStatus = "ok" | "expired" | "unknown-house" | "unknown-checkin" | "unknown-nights" | "no-rate";
export type AnnotateOptions = {
    config?: PricingConfig;
    houses?: Partial<Record<HouseId, HouseInfo>>;
    targetDiscountRate?: number;
    /** 失効判定・リードタイム計算の基準時刻。省略時は現在時刻 */
    now?: Date;
};
export declare function annotateListingsWithFairness(rows: JoinedRow[], opts?: AnnotateOptions): AnnotatedListing[];
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
export declare function summarizeDiagnostics(rows: AnnotatedListing[]): ListingDiagnostics;
export declare function groupByHouse(rows: AnnotatedListing[]): Record<string, AnnotatedListing[]>;
export declare function groupByToken(rows: AnnotatedListing[]): Record<string, AnnotatedListing[]>;
export type AnnotatedWithCount = AnnotatedListing & {
    listingsCount: number;
};
export declare function pickMostUndervalued(arr: AnnotatedListing[]): AnnotatedListing;
export declare function selectBestPerToken(rows: AnnotatedListing[]): AnnotatedWithCount[];
export declare function sortByDiscountDesc<T extends {
    discountPctLower?: number;
}>(arr: T[]): T[];
export declare function sortByPriceAsc<T extends {
    priceEth?: number;
}>(arr: T[]): T[];
