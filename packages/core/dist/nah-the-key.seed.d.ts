import type { HouseId, HouseInfo, PricingConfig } from "./nah-the-key.types";
export declare const HOUSE_TABLE: Record<HouseId, HouseInfo>;
export declare const DEFAULT_PRICING_CONFIG: PricingConfig;
/**
 * 年末年始・GW・お盆・連休といった特異日の割増係数。
 * 必ず 1.0 以上を返す（baseline = 年内最安 という定義を壊さないため）。
 * 複数の条件に当たる場合は掛け合わせず最大値を採る。
 */
export declare function resolveSpecialDayFactor(
  dateIso: string,
  cfg?: PricingConfig,
): number;
/** チェックイン日までの残日数から、上限入札に上乗せする安全マージンを返す */
export declare function resolveLeadtimeMargin(
  daysUntil: number | undefined,
  cfg?: PricingConfig,
): number;
export declare function resolveOgImage(
  url: string,
): Promise<string | undefined>;
/** サムネ未設定の項目にOG画像URLを流し込む */
export declare function hydrateThumbnails(
  table?: Record<HouseId, HouseInfo>,
): Promise<Record<string, HouseInfo>>;
