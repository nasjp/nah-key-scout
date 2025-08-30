import { OPENSEA_COLLECTION_SLUG } from "@/lib/constants";
import { getEthJpy } from "@/lib/eth-jpy";
import {
  formatCheckinJst,
  formatEth,
  formatJpy,
  formatPct,
} from "@/lib/format";
import { localHouseImagePath } from "@/lib/image-cache";
import {
  type AnnotatedWithCount,
  annotateListingsWithFairness,
  DEFAULT_PRICING_CONFIG,
  HOUSE_TABLE,
  selectBestPerToken,
  sortByDiscountDesc,
} from "@/lib/nah-the-key";
import { fetchOpenseaListingsJoined, type Mode } from "@/lib/opensea-listings";

export type HomeCardVM = {
  item: AnnotatedWithCount;
  title: string;
  img?: string;
  computed: {
    actualJpyPerNight?: string;
    fairJpyPerNight?: string;
    discountPct?: string;
    priceEth?: string;
    checkin?: string;
    localImg?: string;
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

  const items: HomeCardVM[] = itemsSorted.map((it) => {
    const house = it.houseId ? HOUSE_TABLE[it.houseId] : undefined;
    const title = house?.displayName ?? it.house ?? "UNKNOWN";
    const img = it.officialThumbUrl;
    const localImg = localHouseImagePath(it.houseId, img);
    const computed = {
      actualJpyPerNight: formatJpy(it.actualPerNightJpy),
      fairJpyPerNight: formatJpy(it.fairPerNightJpy),
      discountPct: formatPct(it.discountPct),
      priceEth: formatEth(it.priceEth),
      checkin: it.checkinJst ? formatCheckinJst(it.checkinJst) : undefined,
      localImg,
    } as const;
    return { item: it, title, img, computed };
  });

  return { totalListings, items };
}
