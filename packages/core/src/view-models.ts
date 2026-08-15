import { OPENSEA_COLLECTION_SLUG, THE_KEY_CONTRACT } from "./constants";
import { type EthJpyResult, getEthJpy } from "./eth-jpy";
import { formatCheckinJst, formatEth, formatJpy, formatPct } from "./format";
import { getHouseImageVariant, localHouseImagePath } from "./image-cache";
import {
  type AnnotatedListing,
  type AnnotatedWithCount,
  annotateListingsWithFairness,
  computeFairBreakdown,
  DEFAULT_PRICING_CONFIG,
  HOUSE_TABLE,
  type ListingDiagnostics,
  parseCheckinDateJst,
  selectBestPerToken,
  sortByDiscountDesc,
  summarizeDiagnostics,
} from "./nah-the-key";
import type { PricingConfig, Uncertainty } from "./nah-the-key.types";
import {
  fetchNftMeta,
  fetchOpenseaListingsJoined,
  type JoinedRow,
  type Mode,
} from "./opensea-listings";

// ===================== 共通の表示ヘルパ =====================

const UNCERTAINTY_NOTE: Record<Uncertainty, string> = {
  Low: "公式の実額に準拠",
  Med: "媒体・エリア価格からの推定",
  High: "販売価格等からの推定（誤差大）",
};

export type RateVM = {
  jpy?: number;
  jpyText?: string;
  source: EthJpyResult["source"];
  fetchedAtIso: string;
  /** レートが取れておらず割安度を算出できない状態か */
  unavailable: boolean;
  failures: EthJpyResult["failures"];
};

function toRateVM(rate: EthJpyResult): RateVM {
  return {
    jpy: rate.jpy,
    jpyText: rate.jpy !== undefined ? formatJpy(rate.jpy) : undefined,
    source: rate.source,
    fetchedAtIso: rate.fetchedAtIso,
    unavailable: rate.jpy === undefined,
    failures: rate.failures,
  };
}

function pctText(n: number | undefined): string | undefined {
  return n === undefined ? undefined : formatPct(n);
}

// ===================== ホーム =====================

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

/** カードに載せる対象。失効・判定不能は一覧から外し、診断側で件数を出す */
const DISPLAYABLE = new Set(["ok", "no-rate"]);

/**
 * 取得済みの行から画面用モデルを組み立てる純関数（ネットワーク・I/O なし）。
 */
export function composeHomeViewModel(
  rows: JoinedRow[],
  rate: EthJpyResult,
  opts: ComposeHomeOptions = {},
): HomeViewModel {
  const limit = opts.limit ?? 24;
  const cfg: PricingConfig = {
    ...(opts.config ?? DEFAULT_PRICING_CONFIG),
    ethJpy: rate.jpy,
  };

  const annotated = annotateListingsWithFairness(rows, {
    config: cfg,
    now: opts.now,
  });
  const diagnostics = summarizeDiagnostics(annotated);

  const displayable = annotated.filter((a) => DISPLAYABLE.has(a.status));
  const picked = selectBestPerToken(displayable);
  const itemsSorted = sortByDiscountDesc(picked).slice(0, limit);

  const items = itemsSorted.map((it) => toHomeCard(it));
  return {
    totalListings: rows.length,
    items,
    rate: toRateVM(rate),
    diagnostics,
  };
}

function toHomeCard(it: AnnotatedWithCount): HomeCardVM {
  const house = it.houseId ? HOUSE_TABLE[it.houseId] : undefined;
  const title = house?.displayName ?? it.house ?? "UNKNOWN";
  const imageUrl = localHouseImagePath(it.houseId, it.officialThumbUrl);
  return {
    item: it,
    title,
    display: {
      actualJpyPerNight:
        it.actualPerNightJpy !== undefined
          ? formatJpy(it.actualPerNightJpy)
          : undefined,
      fairJpyPerNight:
        it.fairPerNightJpy !== undefined
          ? formatJpy(it.fairPerNightJpy)
          : undefined,
      discountPct: pctText(it.discountPct),
      discountPctLower: pctText(it.discountPctLower),
      discountRange:
        it.discountMarginPct !== undefined
          ? `±${it.discountMarginPct}`
          : undefined,
      uncertainty: it.uncertainty,
      uncertaintyNote: it.uncertainty
        ? UNCERTAINTY_NOTE[it.uncertainty]
        : undefined,
      baselineReason: it.baselineReason,
      maxBidEth:
        it.maxBidEth !== undefined ? formatEth(it.maxBidEth) : undefined,
      priceEth: it.priceEth !== undefined ? formatEth(it.priceEth) : undefined,
      checkin: it.checkinJst ? formatCheckinJst(it.checkinJst) : undefined,
      daysUntilCheckin: it.daysUntilCheckin,
      imageUrl: imageUrl ?? it.officialThumbUrl,
      label: it.label ?? "",
      nights: it.nights,
    },
  };
}

/** ビルド済みの画像バリアント（webp/blur）を後段で流し込む */
export async function hydrateHomeImages(
  vm: HomeViewModel,
): Promise<HomeViewModel> {
  const items = await Promise.all(
    vm.items.map(async (card) => {
      const variant = await getHouseImageVariant(card.item.houseId, 800);
      return {
        ...card,
        display: {
          ...card.display,
          imageUrl: variant.src ?? card.display.imageUrl,
          blurDataURL: variant.blurDataURL,
        },
      };
    }),
  );
  return { ...vm, items };
}

export async function buildHomeViewModel(
  apiKey: string,
  opts: { limit?: number; slug?: string; mode?: Mode } = {},
): Promise<HomeViewModel> {
  const slug = opts.slug ?? OPENSEA_COLLECTION_SLUG;
  const mode: Mode = opts.mode ?? "all";
  const rows = await fetchOpenseaListingsJoined(slug, apiKey, mode);
  const rate = await getEthJpy();
  return hydrateHomeImages(
    composeHomeViewModel(rows, rate, { limit: opts.limit }),
  );
}

// ===================== アイテム詳細 =====================

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
  longStay: { nights: number; factor: number };
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
    equation: { priceEth?: string; ethJpy?: string; nights?: number };
    maxBid?: {
      eth: string;
      targetDiscountRate: number;
      leadtimeMargin: number;
    };
    breakdown?: ItemPricingBreakdownVM;
  };
  otherListings: ItemOtherListingVM[];
  traits: Array<{ trait_type: string; value: string | number }>;
};

const STATUS_NOTE: Record<AnnotatedListing["status"], string> = {
  ok: "",
  expired:
    "チェックイン日を過ぎているため、このキーは使用できません（割安度は算出しません）",
  "unknown-house": "ハウスを特定できないため公正価格を算出できません",
  "unknown-checkin": "チェックイン日を特定できないため公正価格を算出できません",
  "unknown-nights": "泊数トレイトが無いため、1泊と仮定せず算出を見送ります",
  "no-rate": "ETH/JPY レートを取得できないため実効単価を算出できません",
};

export function composeItemViewModel(
  rows: JoinedRow[],
  tokenId: string,
  rate: EthJpyResult,
  traits: Array<{ trait_type: string; value: string | number }>,
  opts: { now?: Date; config?: PricingConfig } = {},
): ItemDetailVM {
  const cfg: PricingConfig = {
    ...(opts.config ?? DEFAULT_PRICING_CONFIG),
    ethJpy: rate.jpy,
  };
  const inToken = rows.filter(
    (r) =>
      r.contract.toLowerCase() === THE_KEY_CONTRACT && r.tokenId === tokenId,
  );
  const annotated = annotateListingsWithFairness(inToken, {
    config: cfg,
    now: opts.now,
  });
  const sorted = sortByDiscountDesc(annotated);
  const best = sorted[0];
  const others = sorted.slice(1);

  const house = best?.houseId ? HOUSE_TABLE[best.houseId] : undefined;
  const title = best?.house ?? tokenId;
  const imageUrl = localHouseImagePath(best?.houseId, best?.officialThumbUrl);

  const checkin = best?.checkinJst
    ? parseCheckinDateJst(best.checkinJst)
    : undefined;
  const fair =
    house && checkin && best?.nights
      ? computeFairBreakdown(house, checkin, best.nights, cfg)
      : undefined;

  return {
    title,
    houseId: best?.houseId,
    imageUrl: imageUrl ?? best?.officialThumbUrl,
    status: best?.status,
    statusNote: best ? STATUS_NOTE[best.status] : undefined,
    rate: toRateVM(rate),
    header: {
      checkin: best?.checkinJst ? formatCheckinJst(best.checkinJst) : undefined,
      checkinSource: best?.checkinSource,
      checkinMismatch: best?.checkinMismatch,
      daysUntilCheckin: best?.daysUntilCheckin,
      nights: best?.nights,
      priceEth: best?.priceEth != null ? formatEth(best.priceEth) : undefined,
      discountPct: pctText(best?.discountPct),
      discountRange:
        best?.discountMarginPct !== undefined
          ? `±${best.discountMarginPct}`
          : undefined,
      officialUrl: best?.officialUrl,
      openseaAssetUrl: best?.openseaAssetUrl,
    },
    pricing: {
      actualPerNight:
        best?.actualPerNightJpy != null
          ? formatJpy(best.actualPerNightJpy)
          : undefined,
      fairPerNight:
        best?.fairPerNightJpy != null
          ? formatJpy(best.fairPerNightJpy)
          : undefined,
      equation: {
        priceEth: best?.priceEth != null ? formatEth(best.priceEth) : undefined,
        ethJpy: rate.jpy !== undefined ? formatJpy(rate.jpy) : undefined,
        nights: best?.nights,
      },
      maxBid:
        best?.maxBidEth !== undefined
          ? {
              eth: formatEth(best.maxBidEth),
              targetDiscountRate: best.targetDiscountRate ?? 0,
              leadtimeMargin: best.leadtimeMargin ?? 0,
            }
          : undefined,
      breakdown: fair
        ? {
            baselineJpy: formatJpy(fair.baselinePerNightJpy),
            baselineReason: house?.baselineReason,
            uncertainty: house?.uncertainty,
            uncertaintyNote: house?.uncertainty
              ? UNCERTAINTY_NOTE[house.uncertainty]
              : undefined,
            nights: fair.nightFactors.map((n) => ({
              dateIso: n.dateIso,
              dowJp: n.dowJp,
              monthFactor: n.monthFactor,
              dowFactor: n.dowFactor,
              specialFactor: n.specialFactor,
              factor: Math.round(n.factor * 1000) / 1000,
            })),
            demandAvg: fair.demandAvg.toFixed(3),
            longStay: fair.longStay,
          }
        : undefined,
    },
    otherListings: others.map((l) => ({
      orderHash: l.orderHash,
      priceEth: l.priceEth != null ? formatEth(l.priceEth) : undefined,
      actualPerNight:
        l.actualPerNightJpy != null
          ? formatJpy(l.actualPerNightJpy)
          : undefined,
      fairPerNight:
        l.fairPerNightJpy != null ? formatJpy(l.fairPerNightJpy) : undefined,
      discountPct: pctText(l.discountPct),
      start: l.startTimeIso?.slice(0, 10) ?? "",
      end: l.endTimeIso?.slice(0, 10) ?? "",
      url: l.openseaAssetUrl,
    })),
    traits,
  };
}

export async function buildItemViewModel(
  apiKey: string,
  tokenId: string,
  opts: { slug?: string } = {},
): Promise<ItemDetailVM> {
  const slug = opts.slug ?? OPENSEA_COLLECTION_SLUG;
  const rows = await fetchOpenseaListingsJoined(slug, apiKey, "all");
  const rate = await getEthJpy();
  const meta = await fetchNftMeta(THE_KEY_CONTRACT, tokenId, apiKey);
  const traits =
    (meta.nft?.traits as Array<{
      trait_type: string;
      value: string | number;
    }>) ?? [];

  const vm = composeItemViewModel(rows, tokenId, rate, traits);
  const variant = await getHouseImageVariant(vm.houseId, 1200);
  return {
    ...vm,
    imageUrl: variant.src ?? vm.imageUrl,
    blurDataURL: variant.blurDataURL,
  };
}
