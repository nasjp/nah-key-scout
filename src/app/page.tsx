import ListingCard from "@/components/ListingCard";
import { OPENSEA_COLLECTION_SLUG } from "@/lib/constants";
import { requireEnv } from "@/lib/env";
import { getEthJpy } from "@/lib/eth-jpy";
import {
  formatCheckinJst,
  formatEth,
  formatJpy,
  formatPct,
} from "@/lib/format";
import { localHouseImagePath } from "@/lib/image-cache";
import {
  type AnnotatedListing,
  annotateListingsWithFairness,
  DEFAULT_PRICING_CONFIG,
  HOUSE_TABLE,
  selectBestPerToken,
  sortByDiscountDesc,
} from "@/lib/nah-the-key";
import { fetchOpenseaListingsJoined } from "@/lib/opensea-listings";

export const revalidate = 7200; // 120分ごとにISR更新

const OPENSEA_API_KEY = requireEnv("OPENSEA_API_KEY");

export default async function Home() {
  const rows = await fetchOpenseaListingsJoined(
    OPENSEA_COLLECTION_SLUG,
    OPENSEA_API_KEY,
    "all",
  );
  const totalListings = rows.length;
  const ethJpy = await getEthJpy();
  const annotated = annotateListingsWithFairness(rows, {
    config: { ...DEFAULT_PRICING_CONFIG, ethJpy },
  });
  const picked = selectBestPerToken(annotated);
  const itemsSorted = sortByDiscountDesc(picked).slice(0, 24);

  return (
    <div className="font-sans max-w-5xl mx-auto min-h-screen p-6 sm:p-10 flex flex-col gap-4">
      <main className="flex flex-col gap-4">
        <div className="text-sm opacity-70">
          リスティング総数: {totalListings} / 表示アイテム数:{" "}
          {itemsSorted.length}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {itemsSorted.map((it) => {
            const house = it.houseId ? HOUSE_TABLE[it.houseId] : undefined;
            const title = house?.displayName ?? it.house ?? "UNKNOWN";
            const img = it.officialThumbUrl;
            const localImg = localHouseImagePath(it.houseId, img);
            const computed = {
              actualJpyPerNight: formatJpy(it.actualPerNightJpy),
              fairJpyPerNight: formatJpy(it.fairPerNightJpy),
              discountPct: formatPct(it.discountPct),
              priceEth: formatEth(it.priceEth),
              checkin: it.checkinJst
                ? formatCheckinJst(it.checkinJst)
                : undefined,
              localImg,
            } as const;
            return (
              <ListingCard
                key={it.orderHash}
                item={it as AnnotatedListing & { listingsCount: number }}
                title={title}
                img={img}
                computed={computed}
              />
            );
          })}
        </div>
      </main>
    </div>
  );
}
