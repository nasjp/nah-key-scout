export declare function safeHouseId(id: string): string;
export declare function extFromUrl(url: string | undefined): string;
export declare function localHouseImagePath(houseId: string | undefined, imgUrl: string | undefined): string | undefined;
export type HouseImageMeta = {
    files: Record<string, string>;
    blurDataURL?: string;
};
export declare function readHouseImageMeta(houseId: string | undefined): Promise<HouseImageMeta | undefined>;
export declare function getHouseImageVariant(houseId: string | undefined, preferredWidth?: number): Promise<{
    src?: string;
    blurDataURL?: string;
}>;
