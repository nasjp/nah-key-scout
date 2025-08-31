export declare function formatJpy(n?: number): string;
export declare function formatPct(n?: number): string;
export declare function formatEth(n?: number): string;
export declare function formatCheckinJst(dateStr?: string): string;
export declare function formatJpyCompactMillions(n: number): string;
export type JstNowParts = {
  full: string;
  hm: string;
};
export declare function jstNowParts(): JstNowParts;
