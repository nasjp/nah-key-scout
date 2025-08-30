import Image from "next/image";
import Link from "next/link";
import {
  type AnnotatedListing,
  annotateListingsWithFairness,
  HOUSE_TABLE,
} from "@/lib/nah-the-key";
import { fetchOpenseaListingsJoined } from "@/lib/opensea-listings";

function jpy(n?: number) {
  if (n == null) return "-";
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(n);
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

export const revalidate = 300; // 5分ごとにISR更新

export default async function Home() {
  const apiKey = process.env.OPENSEA_API_KEY;
  const missingApiKey = !apiKey;
  let items: AnnotatedListing[] = [];
  if (apiKey) {
    const rows = await fetchOpenseaListingsJoined(
      "the-key-nah",
      apiKey,
      "best",
    );
    const annotated = annotateListingsWithFairness(rows);
    // ソート：割安度の高い順 → fallbackで新しい順（endTime 降順）
    items = annotated
      .slice()
      .sort((a, b) => (b.discountPct ?? -999) - (a.discountPct ?? -999))
      .slice(0, 24);
  }

  return (
    <div className="font-sans grid grid-rows-[auto_1fr_auto] items-start justify-items-stretch min-h-screen p-6 sm:p-10 gap-6">
      <header className="row-start-1 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">NOT A HOTEL - THE KEY SCOUT</h1>
          <p className="text-sm opacity-70">
            project by{" "}
            <a className="underline" href="http://github.com/kolumoana/nasjp">
              nasjp
            </a>
          </p>
        </div>
      </header>

      {missingApiKey ? (
        <main className="row-start-2">
          <div className="rounded-md border p-4">
            <p className="font-medium">
              環境変数 OPENSEA_API_KEY が未設定です。
            </p>
            <p className="text-sm opacity-80">
              .env.local に OPENSEA_API_KEY を設定してください。
            </p>
          </div>
        </main>
      ) : (
        <main className="row-start-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it) => {
            const house = it.houseId ? HOUSE_TABLE[it.houseId] : undefined;
            const title = house?.displayName ?? it.house ?? "UNKNOWN";
            const img = it.officialThumbUrl;
            const fair = it.fairPerNightJpy;
            const actual = it.actualPerNightJpy;
            const disc = it.discountPct;
            const label = it.label ?? "";
            const nights = it.nights ?? 1;
            return (
              <article
                key={it.orderHash}
                className="rounded-lg overflow-hidden border bg-white/5"
              >
                {img ? (
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
                  <div className="text-sm opacity-80">
                    {it.checkinJst
                      ? `${it.checkinJst} / ${nights}泊`
                      : `${nights}泊`}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex flex-col">
                      <span className="opacity-60">実効（JPY/泊）</span>
                      <span className="font-medium">{jpy(actual)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="opacity-60">公正（JPY/泊）</span>
                      <span className="font-medium">{jpy(fair)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="opacity-60">割安度</span>
                      <span className="font-medium">{pct(disc)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="opacity-60">買値</span>
                      <span className="font-medium">{eth(it.priceEth)}</span>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2 text-sm">
                    {it.officialUrl && (
                      <a
                        className="underline"
                        href={it.officialUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        公式ページ
                      </a>
                    )}
                    <a
                      className="underline"
                      href={it.openseaAssetUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      OpenSea
                    </a>
                    <Link
                      className="underline"
                      href={`/item/${it.contract}/${it.tokenId}`}
                    >
                      詳細
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </main>
      )}

      <footer className="row-start-3 text-center text-xs opacity-60">
        このサイトは非公式のファンプロジェクトです。
      </footer>
    </div>
  );
}
