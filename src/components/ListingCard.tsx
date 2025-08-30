import Image from "next/image";
import Link from "next/link";

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

function jpy(n?: number) {
  if (n == null) return "-";
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(n as number);
}

function pct(n?: number) {
  if (n == null) return "-";
  const s = n >= 0 ? `+${n}` : String(n);
  return `${s}%`;
}

function eth(n?: number) {
  if (n == null) return "-";
  return `${n.toFixed(4)} ETH`;
}

export default function ListingCard({ item: it, title, img, computed }: Props) {
  const fair = it.fairPerNightJpy;
  const actual = it.actualPerNightJpy;
  const disc = it.discountPct;
  const label = it.label ?? "";
  const nights = it.nights ?? 1;
  // Prefer locally cached image if present (saved by prebuild script)
  const localPath = computed?.localImg ?? localHouseImagePath(it.houseId, img);

  const WEEK_JP = ["日", "月", "火", "水", "木", "金", "土"] as const;
  function formatCheckin(dateStr: string): string {
    const s = dateStr.replaceAll("/", "-");
    let d: Date | undefined;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`);
    if (!d) {
      const t = new Date(s);
      d = Number.isNaN(t.getTime()) ? undefined : t;
    }
    if (!d) return dateStr;
    const j = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const y = j.getUTCFullYear();
    const mo = String(j.getUTCMonth() + 1).padStart(2, "0");
    const da = String(j.getUTCDate()).padStart(2, "0");
    const w = WEEK_JP[j.getUTCDay()];
    return `${y}-${mo}-${da}(${w})`;
  }

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
              ? `${computed?.checkin ?? formatCheckin(it.checkinJst)} / ${nights}泊`
              : `${nights}泊`}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex flex-col">
              <span className="opacity-60">実効（JPY/泊）</span>
              <span className="font-medium">
                {computed?.actualJpyPerNight ?? jpy(actual)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">公正（JPY/泊）</span>
              <span className="font-medium">
                {computed?.fairJpyPerNight ?? jpy(fair)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">割安度</span>
              <span className="font-medium">
                {computed?.discountPct ?? pct(disc)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">買値</span>
              <span className="font-medium">
                {computed?.priceEth ?? eth(it.priceEth)}
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
