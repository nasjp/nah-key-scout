import { type EthJpyResult } from "./eth-jpy";
import {
  type AnnotatedListing,
  type AnnotatedWithCount,
  type ListingDiagnostics,
} from "./nah-the-key";
import type { PricingConfig, Uncertainty } from "./nah-the-key.types";
import { type JoinedRow, type Mode } from "./opensea-listings";
export type RateVM = {
  jpy?: number;
  jpyText?: string;
  source: EthJpyResult["source"];
  fetchedAtIso: string;
  /** レートが取れておらず割安度を算出できない状態か */
  unavailable: boolean;
  failures: EthJpyResult["failures"];
};
export type HomeCardVM = {
  item: AnnotatedWithCount;
  title: string;
  display: {
    actualJpyPerNight?: string;
    fairJpyPerNight?: string;
    /** 割安度の点推定 */
    discountPct?: string;
    /** 保守側の下限（ラベルと並び順はこちらで決まる） */
    discountPctLower?: string;
    /** "±12" のような誤差幅 */
    discountRange?: string;
    uncertainty?: Uncertainty;
    uncertaintyNote?: string;
    baselineReason?: string;
    maxBidEth?: string;
    priceEth?: string;
    checkin?: string;
    daysUntilCheckin?: number;
    imageUrl?: string;
    blurDataURL?: string;
    label: string;
    nights?: number;
  };
};
export type HomeViewModel = {
  /** 取得したリスティングの総数（除外前） */
  totalListings: number;
  items: HomeCardVM[];
  rate: RateVM;
  diagnostics: ListingDiagnostics;
};
export type ComposeHomeOptions = {
  limit?: number;
  now?: Date;
  config?: PricingConfig;
};
/**
 * 取得済みの行から画面用モデルを組み立てる純関数（ネットワーク・I/O なし）。
 */
export declare function composeHomeViewModel(
  rows: JoinedRow[],
  rate: EthJpyResult,
  opts?: ComposeHomeOptions,
): HomeViewModel;
/** ビルド済みの画像バリアント（webp/blur）を後段で流し込む */
export declare function hydrateHomeImages(
  vm: HomeViewModel,
): Promise<HomeViewModel>;
export declare function buildHomeViewModel(
  apiKey: string,
  opts?: {
    limit?: number;
    slug?: string;
    mode?: Mode;
  },
): Promise<HomeViewModel>;
export type ItemOtherListingVM = {
  orderHash: string;
  priceEth?: string;
  actualPerNight?: string;
  fairPerNight?: string;
  discountPct?: string;
  start: string;
  end: string;
  url: string;
};
export type ItemNightLineVM = {
  dateIso: string;
  dowJp: string;
  monthFactor: number;
  dowFactor: number;
  specialFactor: number;
  factor: number;
};
export type ItemPricingBreakdownVM = {
  baselineJpy: string;
  baselineReason?: string;
  uncertainty?: Uncertainty;
  uncertaintyNote?: string;
  nights: ItemNightLineVM[];
  demandAvg: string;
  longStay: {
    nights: number;
    factor: number;
  };
};
export type ItemDetailVM = {
  title: string;
  houseId?: string;
  imageUrl?: string;
  blurDataURL?: string;
  status?: AnnotatedListing["status"];
  statusNote?: string;
  rate: RateVM;
  header: {
    checkin?: string;
    checkinSource?: AnnotatedListing["checkinSource"];
    checkinMismatch?: boolean;
    daysUntilCheckin?: number;
    nights?: number;
    priceEth?: string;
    discountPct?: string;
    discountRange?: string;
    officialUrl?: string;
    openseaAssetUrl?: string;
  };
  pricing: {
    actualPerNight?: string;
    fairPerNight?: string;
    equation: {
      priceEth?: string;
      ethJpy?: string;
      nights?: number;
    };
    maxBid?: {
      eth: string;
      targetDiscountRate: number;
      leadtimeMargin: number;
    };
    breakdown?: ItemPricingBreakdownVM;
  };
  otherListings: ItemOtherListingVM[];
  traits: Array<{
    trait_type: string;
    value: string | number;
  }>;
};
export declare function composeItemViewModel(
  rows: JoinedRow[],
  tokenId: string,
  rate: EthJpyResult,
  traits: Array<{
    trait_type: string;
    value: string | number;
  }>,
  opts?: {
    now?: Date;
    config?: PricingConfig;
  },
): ItemDetailVM;
export declare function buildItemViewModel(
  apiKey: string,
  tokenId: string,
  opts?: {
    slug?: string;
  },
): Promise<ItemDetailVM>;
