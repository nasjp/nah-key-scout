import Image from "next/image";
import Link from "next/link";

import {
  formatCheckinJst,
  formatEth,
  formatJpy,
  formatPct,
} from "@/lib/format";
import { localHouseImagePath } from "@/lib/image-cache";
import type { AnnotatedListing } from "@/lib/nah-the-key";

type SSRComputed = {
  actualJpyPerNight?: string;
  fairJpyPerNight?: string;
  discountPct?: string;
  priceEth?: string;
  checkin?: string; // 例: 2025-01-01(水)
  localImg?: string; // SSRで解決したローカル画像パス
};

type Props = {
  item: AnnotatedListing & { listingsCount: number };
  title: string;
  img?: string;
  computed?: SSRComputed; // SSRで整形済みの表示用データ（任意）
};

export default function ListingCard({ item: it, title, img, computed }: Props) {
  const fair = it.fairPerNightJpy;
  const actual = it.actualPerNightJpy;
  const disc = it.discountPct;
  const label = it.label ?? "";
  const nights = it.nights ?? 1;
  // Prefer locally cached image if present (saved by prebuild script)
  const localPath = computed?.localImg ?? localHouseImagePath(it.houseId, img);

  // format helpers come from shared formatter

  return (
    <article className="rounded-lg overflow-hidden border bg-white/5 transition-colors">
      <Link
        href={`/item/${it.tokenId}`}
        className="block hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        {localPath ? (
          <Image
            src={localPath}
            alt={title}
            width={800}
            height={320}
            className="w-full h-40 object-cover"
          />
        ) : img ? (
          <Image
            src={img}
            alt={title}
            width={800}
            height={320}
            className="w-full h-40 object-cover"
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
            {it.checkinJst
              ? `${computed?.checkin ?? formatCheckinJst(it.checkinJst)} / ${nights}泊`
              : `${nights}泊`}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex flex-col">
              <span className="opacity-60">実効（JPY/泊）</span>
              <span className="font-medium">
                {computed?.actualJpyPerNight ?? formatJpy(actual)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">公正（JPY/泊）</span>
              <span className="font-medium">
                {computed?.fairJpyPerNight ?? formatJpy(fair)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">割安度</span>
              <span className="font-medium">
                {computed?.discountPct ?? formatPct(disc)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">買値</span>
              <span className="font-medium">
                {computed?.priceEth ?? formatEth(it.priceEth)}
              </span>
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
