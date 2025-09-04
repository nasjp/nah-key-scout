import { OPENSEA_COLLECTION_SLUG, THE_KEY_CONTRACT } from "./constants";
import { getEthJpy } from "./eth-jpy";
import { formatCheckinJst, formatEth, formatJpy, formatPct } from "./format";
import { getHouseImageVariant, localHouseImagePath } from "./image-cache";
import {
  type AnnotatedWithCount,
  annotateListingsWithFairness,
  computeFairBreakdown,
  DEFAULT_PRICING_CONFIG,
  HOUSE_TABLE,
  parseCheckinDateJst,
  selectBestPerToken,
  sortByDiscountDesc,
} from "./nah-the-key";
import {
  fetchNftMeta,
  fetchOpenseaListingsJoined,
  type Mode,
} from "./opensea-listings";

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

export async function buildHomeViewModel(
  apiKey: string,
  opts: { limit?: number; slug?: string; mode?: Mode } = {},
): Promise<HomeViewModel> {
  const limit = opts.limit ?? 24;
  const slug = opts.slug ?? OPENSEA_COLLECTION_SLUG;
  const mode: Mode = opts.mode ?? "all";

  const rows = await fetchOpenseaListingsJoined(slug, apiKey, mode);
  const totalListings = rows.length;

  const ethJpy = await getEthJpy();
  const annotated = annotateListingsWithFairness(rows, {
    config: { ...DEFAULT_PRICING_CONFIG, ethJpy },
  });
  const picked = selectBestPerToken(annotated);
  const itemsSorted = sortByDiscountDesc(picked).slice(0, limit);

  const items: HomeCardVM[] = await Promise.all(
    itemsSorted.map(async (it) => {
      const house = it.houseId ? HOUSE_TABLE[it.houseId] : undefined;
      const title = house?.displayName ?? it.house ?? "UNKNOWN";
      const img = it.officialThumbUrl;
      const localImg = localHouseImagePath(it.houseId, img);
      const variant = await getHouseImageVariant(it.houseId, 800);
      const imageUrl = variant.src ?? localImg ?? img;
      const display = {
        actualJpyPerNight: formatJpy(it.actualPerNightJpy),
        fairJpyPerNight: formatJpy(it.fairPerNightJpy),
        discountPct: formatPct(it.discountPct),
        priceEth: formatEth(it.priceEth),
        checkin: it.checkinJst ? formatCheckinJst(it.checkinJst) : undefined,
        imageUrl,
        blurDataURL: variant.blurDataURL,
        label: it.label ?? "",
        nights: it.nights ?? 1,
      } as const;
      return { item: it, title, display };
    }),
  );

  return { totalListings, items };
}

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
  month: { area: string; month: number; factor: number };
  dowLines: string[];
  dowAvg: string; // e.g., 1.23
  longStay: { nights: number; factor: number };
  leadtime: { daysUntil: number; factor: number };
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
    equation: { priceEth?: string; ethJpy: string; nights: number };
    breakdown?: ItemPricingBreakdownVM;
  };
  otherListings: ItemOtherListingVM[];
  traits: Array<{ trait_type: string; value: string | number }>;
};

export async function buildItemViewModel(
  apiKey: string,
  tokenId: string,
  opts: { slug?: string } = {},
): Promise<ItemDetailVM> {
  const slug = opts.slug ?? OPENSEA_COLLECTION_SLUG;
  const rows = await fetchOpenseaListingsJoined(slug, apiKey, "all");
  const inToken = rows.filter(
    (r) =>
      r.contract.toLowerCase() === THE_KEY_CONTRACT && r.tokenId === tokenId,
  );

  const ethJpy = await getEthJpy();
  const annotated = annotateListingsWithFairness(inToken, {
    config: { ...DEFAULT_PRICING_CONFIG, ethJpy },
  });
  const best =
    annotated.length > 0 ? selectBestPerToken(annotated)[0] : undefined;
  const others =
    annotated.length > 0 ? sortByDiscountDesc(annotated).slice(1) : [];

  // houseId は先頭に'+'が付くことがあるため、シードのキー（'+'なし）にもフォールバック
  const house = best?.houseId
    ? (HOUSE_TABLE[best.houseId] ??
      HOUSE_TABLE[best.houseId.replace(/^\+/, "")])
    : undefined;
  const title = best?.house ?? tokenId;
  const localImg = best?.houseId
    ? localHouseImagePath(best.houseId, best.officialThumbUrl)
    : undefined;
  const variant = await getHouseImageVariant(best?.houseId, 1200);
  const imageUrl = variant.src ?? localImg ?? best?.officialThumbUrl;

  const d = best?.checkinJst ? parseCheckinDateJst(best.checkinJst) : undefined;
  // breakdown は泊数トレイト欠落時でも 1泊扱いで表示する
  const fair =
    house && d ? computeFairBreakdown(house, d, best?.nights ?? 1) : undefined;

  const header = {
    checkin: best?.checkinJst ? formatCheckinJst(best.checkinJst) : undefined,
    nights: best?.nights ?? 1,
    priceEth: best?.priceEth != null ? formatEth(best.priceEth) : undefined,
    discountPct:
      best?.discountPct != null ? formatPct(best.discountPct) : undefined,
    officialUrl: best?.officialUrl,
    openseaAssetUrl: best?.openseaAssetUrl,
  } as const;

  const pricing = {
    actualPerNight:
      best?.actualPerNightJpy != null
        ? formatJpy(best.actualPerNightJpy)
        : undefined,
    fairPerNight:
      (best?.fairPerNightJpy ?? fair?.fairPerNightJpy) != null
        ? formatJpy((best?.fairPerNightJpy ?? fair?.fairPerNightJpy) as number)
        : undefined,
    equation: {
      priceEth: best?.priceEth != null ? formatEth(best.priceEth) : undefined,
      ethJpy: formatJpy(ethJpy),
      nights: best?.nights ?? 1,
    },
    breakdown: fair
      ? {
          baselineJpy: formatJpy(fair.baselinePerNightJpy),
          month: fair.month,
          dowLines: fair.dowFactors.map(
            (x) => `${x.dateIso}(${x.dowJp}) × ${x.factor}`,
          ),
          dowAvg: fair.dowAvg.toFixed(2),
          longStay: fair.longStay,
          leadtime: fair.leadtime,
        }
      : undefined,
  } as const;

  const otherListings: ItemOtherListingVM[] = others.map((l) => ({
    orderHash: l.orderHash,
    priceEth: l.priceEth != null ? formatEth(l.priceEth) : undefined,
    actualPerNight:
      l.actualPerNightJpy != null ? formatJpy(l.actualPerNightJpy) : undefined,
    fairPerNight:
      l.fairPerNightJpy != null ? formatJpy(l.fairPerNightJpy) : undefined,
    discountPct: l.discountPct != null ? formatPct(l.discountPct) : undefined,
    start: l.startTimeIso?.slice(0, 10) ?? "",
    end: l.endTimeIso?.slice(0, 10) ?? "",
    url: l.openseaAssetUrl,
  }));

  const meta = await fetchNftMeta(THE_KEY_CONTRACT, tokenId, apiKey);
  const traits =
    (meta.nft?.traits as Array<{
      trait_type: string;
      value: string | number;
    }>) ?? [];

  return {
    title,
    imageUrl,
    blurDataURL: variant.blurDataURL,
    header,
    pricing,
    otherListings,
    traits,
  };
}
