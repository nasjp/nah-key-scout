// Fetch current ETH/JPY rate.
//
// 取得できなかったときに「それらしい既定値」で計算を続けると、
// 実効単価がまるごとずれて盤面の割安/割高が静かに反転する。
// そこで失敗は失敗として返し、呼び出し側に判断させる。

export type EthJpySource = "coinbase" | "coingecko" | "unavailable";

export type EthJpyResult = {
  /** 取得できなかった場合は undefined（推測値では埋めない） */
  jpy?: number;
  source: EthJpySource;
  fetchedAtIso: string;
  /** 失敗したプロバイダと理由（UI/ログ用） */
  failures: Array<{ name: string; reason: string }>;
};

export type EthJpyProvider = {
  name: string;
  fetch: () => Promise<number>;
};

/** 明らかな異常値を弾く。1 ETH が 1,000 円〜1 億円の外は壊れているとみなす */
const MIN_PLAUSIBLE_JPY = 1_000;
const MAX_PLAUSIBLE_JPY = 100_000_000;

function isPlausible(n: unknown): n is number {
  return (
    typeof n === "number" &&
    Number.isFinite(n) &&
    n >= MIN_PLAUSIBLE_JPY &&
    n <= MAX_PLAUSIBLE_JPY
  );
}

const coinbase: EthJpyProvider = {
  name: "coinbase",
  fetch: async () => {
    const res = await fetch(
      "https://api.coinbase.com/v2/exchange-rates?currency=ETH",
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      data?: { rates?: Record<string, string> };
    };
    return Number(data?.data?.rates?.JPY);
  },
};

const coingecko: EthJpyProvider = {
  name: "coingecko",
  fetch: async () => {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=jpy",
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { ethereum?: { jpy?: number } };
    return Number(data?.ethereum?.jpy);
  },
};

export const DEFAULT_ETH_JPY_PROVIDERS: EthJpyProvider[] = [
  coinbase,
  coingecko,
];

export type GetEthJpyOptions = {
  providers?: EthJpyProvider[];
  now?: Date;
};

export async function getEthJpy(
  options: GetEthJpyOptions = {},
): Promise<EthJpyResult> {
  const providers = options.providers ?? DEFAULT_ETH_JPY_PROVIDERS;
  const now = options.now ?? new Date();
  const failures: EthJpyResult["failures"] = [];

  for (const provider of providers) {
    try {
      const value = await provider.fetch();
      if (isPlausible(value)) {
        return {
          jpy: value,
          source: provider.name as EthJpySource,
          fetchedAtIso: now.toISOString(),
          failures,
        };
      }
      failures.push({ name: provider.name, reason: `implausible: ${value}` });
    } catch (e) {
      failures.push({
        name: provider.name,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    jpy: undefined,
    source: "unavailable",
    fetchedAtIso: now.toISOString(),
    failures,
  };
}
