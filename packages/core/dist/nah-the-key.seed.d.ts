import type { HouseId, HouseInfo, PricingConfig } from "./nah-the-key.types";
export declare const HOUSE_TABLE: Record<HouseId, HouseInfo>;
export declare const DEFAULT_PRICING_CONFIG: PricingConfig;
export declare function resolveOgImage(url: string): Promise<string | undefined>;
/** サムネ未設定の項目にOG画像URLを流し込む */
export declare function hydrateThumbnails(table?: Record<HouseId, HouseInfo>): Promise<Record<string, HouseInfo>>;
