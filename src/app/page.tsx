import ListingCard from "@/components/ListingCard";
import { requireEnv } from "@/lib/env";
import type { HomeCardVM } from "@/lib/view-models";
import { buildHomeViewModel } from "@/lib/view-models";

export const revalidate = 7200; // 120分ごとにISR更新

const OPENSEA_API_KEY = requireEnv("OPENSEA_API_KEY");

export default async function Home() {
  const { totalListings, items } = await buildHomeViewModel(OPENSEA_API_KEY, {
    limit: 24,
  });

  return (
    <div className="font-sans max-w-5xl mx-auto min-h-screen p-6 sm:p-10 flex flex-col gap-4">
      <main className="flex flex-col gap-4">
        <div className="text-sm opacity-70">
          リスティング総数: {totalListings} / 表示アイテム数: {items.length}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((vm: HomeCardVM) => {
            const { item: it, title, img, computed } = vm;
            return (
              <ListingCard
                key={it.orderHash}
                item={it}
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
