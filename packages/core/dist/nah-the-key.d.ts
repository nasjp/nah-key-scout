import { parseCheckinDateJst } from "./date-utils";
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
  discountPct?: number;
  label?: "割安" | "やや割安" | "妥当" | "やや割高" | "割高";
  maxBidEth25off?: number;
  officialUrl?: string;
  officialThumbUrl?: string;
};
export {
  HOUSE_TABLE,
  DEFAULT_PRICING_CONFIG,
  hydrateThumbnails,
  resolveOgImage,
  parseCheckinDateJst,
};
export declare function computeFairPerNightJpy(
  house: HouseInfo,
  checkin: Date,
  nights: number,
  cfg?: PricingConfig,
): number;
export type FairBreakdown = {
  baselinePerNightJpy: number;
  month: {
    month: number;
    area: Area;
    factor: number;
  };
  dowFactors: Array<{
    dateIso: string;
    dow: "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
    dowJp: string;
    factor: number;
  }>;
  dowAvg: number;
  longStay: {
    nights: number;
    factor: number;
  };
  leadtime: {
    daysUntil: number;
    factor: number;
  };
  fairPerNightJpy: number;
};
export declare function computeFairBreakdown(
  house: HouseInfo,
  checkin: Date,
  nights: number,
  cfg?: PricingConfig,
): FairBreakdown;
export declare function computeActualPerNightJpy(
  priceEth: number,
  nights: number,
  cfg?: PricingConfig,
): number;
export declare function computeDiscountPct(
  actualPerNightJpy: number | undefined,
  fairPerNightJpy: number | undefined,
): number | undefined;
export declare function computeMaxBidEth(
  fairPerNightJpy: number | undefined,
  nights: number | undefined,
  targetDiscountRate: number, // 0.25 → 25%
  cfg?: PricingConfig,
): number | undefined;
export type AnnotateOptions = {
  config?: PricingConfig;
  houses?: Partial<Record<HouseId, HouseInfo>>;
  targetDiscountRate?: number;
};
export declare function annotateListingsWithFairness(
  rows: JoinedRow[],
  opts?: AnnotateOptions,
): AnnotatedListing[];
export declare function groupByHouse(
  rows: AnnotatedListing[],
): Record<string, AnnotatedListing[]>;
export declare function groupByToken(
  rows: AnnotatedListing[],
): Record<string, AnnotatedListing[]>;
export type AnnotatedWithCount = AnnotatedListing & {
  listingsCount: number;
};
export declare function pickMostUndervalued(
  arr: AnnotatedListing[],
): AnnotatedListing;
export declare function selectBestPerToken(
  rows: AnnotatedListing[],
): AnnotatedWithCount[];
export declare function sortByDiscountDesc<
  T extends {
    discountPct?: number;
  },
>(arr: T[]): T[];
export declare function sortByPriceAsc<
  T extends {
    priceEth?: number;
  },
>(arr: T[]): T[];
