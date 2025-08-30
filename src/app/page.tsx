import ListingCard from "@/components/ListingCard";
import { getEthJpy } from "@/lib/eth-jpy";
import {
  type AnnotatedListing,
  annotateListingsWithFairness,
  DEFAULT_PRICING_CONFIG,
  HOUSE_TABLE,
} from "@/lib/nah-the-key";
import { fetchOpenseaListingsJoined } from "@/lib/opensea-listings";

export const revalidate = 7200; // 120分ごとにISR更新

export default async function Home() {
  const apiKey = process.env.OPENSEA_API_KEY;
  const missingApiKey = !apiKey;
  let items: (AnnotatedListing & { listingsCount: number })[] = [];
  let totalListings = 0;
  if (apiKey) {
    const rows = await fetchOpenseaListingsJoined("the-key-nah", apiKey, "all");
    totalListings = rows.length;
    const ethJpy = await getEthJpy();
    const annotated = annotateListingsWithFairness(rows, {
      config: { ...DEFAULT_PRICING_CONFIG, ethJpy },
    });
    const groups = new Map<string, AnnotatedListing[]>();
    for (const r of annotated) {
      const key = `${r.contract}:${r.tokenId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(r);
    }
    const pickMostUndervalued = (arr: AnnotatedListing[]): AnnotatedListing =>
      arr
        .slice()
        .sort((a, b) => (b.discountPct ?? -999) - (a.discountPct ?? -999))[0] ||
      arr[0];

    const picked: (AnnotatedListing & { listingsCount: number })[] = [];
    for (const arr of groups.values()) {
      const best = pickMostUndervalued(arr);
      picked.push({ ...best, listingsCount: arr.length });
    }
    items = picked
      .slice()
      .sort((a, b) => (b.discountPct ?? -999) - (a.discountPct ?? -999))
      .slice(0, 24);
  }

  return (
    <div className="font-sans max-w-5xl mx-auto min-h-screen p-6 sm:p-10 flex flex-col gap-4">
      {missingApiKey ? (
        <main>
          <div className="rounded-md border p-4">WIP...</div>
        </main>
      ) : (
        <main className="flex flex-col gap-4">
          <div className="text-sm opacity-70">
            リスティング総数: {totalListings} / 表示アイテム数: {items.length}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((it) => {
              const house = it.houseId ? HOUSE_TABLE[it.houseId] : undefined;
              const title = house?.displayName ?? it.house ?? "UNKNOWN";
              const img = it.officialThumbUrl;
              return (
                <ListingCard
                  key={it.orderHash}
                  item={it as AnnotatedListing & { listingsCount: number }}
                  title={title}
                  img={img}
                />
              );
            })}
          </div>
        </main>
      )}
    </div>
  );
}
