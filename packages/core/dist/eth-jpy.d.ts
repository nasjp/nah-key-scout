export type EthJpySource = "coinbase" | "coingecko" | "unavailable";
export type EthJpyResult = {
  /** 取得できなかった場合は undefined（推測値では埋めない） */
  jpy?: number;
  source: EthJpySource;
  fetchedAtIso: string;
  /** 失敗したプロバイダと理由（UI/ログ用） */
  failures: Array<{
    name: string;
    reason: string;
  }>;
};
export type EthJpyProvider = {
  name: string;
  fetch: () => Promise<number>;
};
export declare const DEFAULT_ETH_JPY_PROVIDERS: EthJpyProvider[];
export type GetEthJpyOptions = {
  providers?: EthJpyProvider[];
  now?: Date;
};
export declare function getEthJpy(
  options?: GetEthJpyOptions,
): Promise<EthJpyResult>;
