export type PriceCurrent = {
    currency: string;
    decimals: number;
    value: string;
};
export type ListingPrice = {
    current: PriceCurrent;
};
export type OfferItem = {
    itemType: number;
    token: string;
    identifierOrCriteria: string;
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
    startTime: string;
    endTime: string;
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
    chain: string;
    protocol_address: string;
    price: ListingPrice;
    protocol_data: ProtocolData;
    type: string;
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
    place?: string;
    nights?: number;
    checkinJst?: string;
    openseaAssetUrl: string;
};
export type Mode = "best" | "all";
export declare function buildListingsUrl(slug: string, mode: Mode, limit?: number, next?: string): string;
export declare function fetchAllListings(slug: string, apiKey: string, mode?: Mode): Promise<Listing[]>;
export declare function fetchNftMeta(contract: string, tokenId: string, apiKey: string): Promise<NftApiResponse>;
export declare function joinListingWithTraits(listing: Listing, meta: NftApiResponse | null): JoinedRow;
export declare function fetchOpenseaListingsJoined(slug: string, apiKey: string, mode?: Mode): Promise<JoinedRow[]>;
export type UniqueToken = {
    contract: string;
    tokenId: string;
};
export declare function uniqTokens(rows: JoinedRow[]): UniqueToken[];
