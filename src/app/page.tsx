import Image from "next/image";
import Link from "next/link";
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
          {items.map((vm, i) => (
            <HomeListingCard
              key={vm.item.orderHash}
              vm={vm}
              // ファーストビュー付近は優先読み込みでチラつきを軽減
              priority={i < 6}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function HomeListingCard({
  vm,
  priority = false,
}: {
  vm: HomeCardVM;
  priority?: boolean;
}) {
  const { item: it, title, display } = vm;
  const label = display.label;
  const nights = display.nights;
  return (
    <article className="rounded-lg overflow-hidden border bg-white/5 transition-colors">
      <Link
        href={`/item/${it.tokenId}`}
        className="block hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        {display.imageUrl ? (
          <Image
            src={display.imageUrl}
            alt={title}
            width={800}
            height={320}
            className="w-full h-40 object-cover"
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            priority={priority}
            placeholder={display.blurDataURL ? "blur" : "empty"}
            blurDataURL={display.blurDataURL}
          />
        ) : (
          <div className="w-full h-40 bg-black/10 flex items-center justify-center text-xs opacity-60">
            No Image
          </div>
        )}
        <div className="p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">{title}</h2>
            <span className="text-xs rounded px-2 py-0.5 border">
              {label || "-"}
            </span>
          </div>
          <div className="text-xs opacity-70">{it.place ?? ""}</div>
          <div className="text-sm opacity-80">
            {display.checkin
              ? `${display.checkin} / ${nights}泊`
              : `${nights}泊`}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex flex-col">
              <span className="opacity-60">実効（JPY/泊）</span>
              <span className="font-medium">
                {display.actualJpyPerNight ?? "-"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">公正（JPY/泊）</span>
              <span className="font-medium">
                {display.fairJpyPerNight ?? "-"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">割安度</span>
              <span className="font-medium">{display.discountPct ?? "-"}</span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">買値</span>
              <span className="font-medium">{display.priceEth ?? "-"}</span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">リスティング数</span>
              <span className="font-medium">{it.listingsCount}</span>
            </div>
          </div>
        </div>
      </Link>
      <div className="p-4 pt-0 flex gap-3 text-sm">
        {it.officialUrl && (
          <a
            className="underline"
            href={it.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            公式ページ
          </a>
        )}
        <a
          className="underline"
          href={it.openseaAssetUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          OpenSea
        </a>
      </div>
    </article>
  );
}
