import { type AnnotatedWithCount } from "./nah-the-key";
import { type Mode } from "./opensea-listings";
export type HomeCardVM = {
    item: AnnotatedWithCount;
    title: string;
    display: {
        actualJpyPerNight?: string;
        fairJpyPerNight?: string;
        discountPct?: string;
        priceEth?: string;
        checkin?: string;
        imageUrl?: string;
        blurDataURL?: string;
        label: string;
        nights: number;
    };
};
export type HomeViewModel = {
    totalListings: number;
    items: HomeCardVM[];
};
export declare function buildHomeViewModel(apiKey: string, opts?: {
    limit?: number;
    slug?: string;
    mode?: Mode;
}): Promise<HomeViewModel>;
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
export type ItemPricingBreakdownVM = {
    baselineJpy: string;
    month: {
        area: string;
        month: number;
        factor: number;
    };
    dowLines: string[];
    dowAvg: string;
    longStay: {
        nights: number;
        factor: number;
    };
    leadtime: {
        daysUntil: number;
        factor: number;
    };
};
export type ItemDetailVM = {
    title: string;
    imageUrl?: string;
    blurDataURL?: string;
    header: {
        checkin?: string;
        nights: number;
        priceEth?: string;
        discountPct?: string;
        officialUrl?: string;
        openseaAssetUrl?: string;
    };
    pricing: {
        actualPerNight?: string;
        fairPerNight?: string;
        equation: {
            priceEth?: string;
            ethJpy: string;
            nights: number;
        };
        breakdown?: ItemPricingBreakdownVM;
    };
    otherListings: ItemOtherListingVM[];
    traits: Array<{
        trait_type: string;
        value: string | number;
    }>;
};
export declare function buildItemViewModel(apiKey: string, tokenId: string, opts?: {
    slug?: string;
}): Promise<ItemDetailVM>;
