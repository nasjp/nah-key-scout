import Image from "next/image";
import Link from "next/link";

import {
  annotateListingsWithFairness,
  computeFairBreakdown,
  DEFAULT_PRICING_CONFIG,
  type FairBreakdown,
  HOUSE_TABLE,
  parseCheckinDateJst,
} from "@/lib/nah-the-key";
import {
  fetchNftMeta,
  fetchOpenseaListingsJoined,
} from "@/lib/opensea-listings";

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

type P = { contract: string; tokenId: string };
export default async function ItemDetail({ params }: { params: Promise<P> }) {
  const apiKey = process.env.OPENSEA_API_KEY;
  const { contract, tokenId } = await params;

  // 基本情報: リスティングから対象を抽出
  let listing = undefined as
    | Awaited<ReturnType<typeof fetchOpenseaListingsJoined>>[number]
    | undefined;
  let annotated = undefined as
    | ReturnType<typeof annotateListingsWithFairness>[number]
    | undefined;
  let fair: FairBreakdown | undefined;
  let traits: Array<{ trait_type: string; value: string | number }> | undefined;
  if (apiKey) {
    const rows = await fetchOpenseaListingsJoined("the-key-nah", apiKey, "all");
    const target = rows.find(
      (r) =>
        r.contract.toLowerCase() === contract.toLowerCase() &&
        r.tokenId === tokenId,
    );
    if (target) {
      listing = target;
      annotated = annotateListingsWithFairness([target])[0];
      const houseInfo = annotated.houseId
        ? HOUSE_TABLE[annotated.houseId]
        : undefined;
      if (houseInfo && annotated.checkinJst && annotated.nights) {
        const d = parseCheckinDateJst(annotated.checkinJst);
        if (d) fair = computeFairBreakdown(houseInfo, d, annotated.nights);
      }
    }

    // トレイトは別途取得して全量表示
    const meta = await fetchNftMeta(contract, tokenId, apiKey);
    traits = meta.nft?.traits;
  }

  const title = annotated?.house ?? `${contract} #${tokenId}`;
  const img = annotated?.officialThumbUrl;
  const nights = annotated?.nights ?? 1;
  const actualPerNight = annotated?.actualPerNightJpy;
  const fairPerNight = annotated?.fairPerNightJpy ?? fair?.fairPerNightJpy;
  const discount = annotated?.discountPct;

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-10 flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">{title}</h1>
          <div className="text-sm opacity-70">
            <span>Token: </span>
            <code className="break-all">
              {contract}:{tokenId}
            </code>
          </div>
        </div>
        <div className="flex gap-3 text-sm">
          {annotated?.officialUrl && (
            <a
              className="underline"
              href={annotated.officialUrl}
              target="_blank"
              rel="noreferrer"
            >
              公式ページ
            </a>
          )}
          <a
            className="underline"
            href={listing?.openseaAssetUrl}
            target="_blank"
            rel="noreferrer"
          >
            OpenSea
          </a>
          <Link className="underline" href="/">
            一覧へ
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        <div className="rounded-lg overflow-hidden border bg-white/5">
          {img ? (
            <Image
              src={img}
              alt={title}
              width={1200}
              height={600}
              className="w-full h-64 object-cover"
            />
          ) : (
            <div className="w-full h-64 bg-black/10 flex items-center justify-center text-xs opacity-60">
              No Image
            </div>
          )}
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div className="flex flex-col">
              <span className="opacity-60">チェックイン</span>
              <span className="font-medium">
                {annotated?.checkinJst ?? "-"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">泊数</span>
              <span className="font-medium">{nights}泊</span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">買値</span>
              <span className="font-medium">{eth(annotated?.priceEth)}</span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">割安度</span>
              <span className="font-medium">{pct(discount)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-4 bg-white/5 flex flex-col gap-3 text-sm">
          <h2 className="font-semibold">価格ロジック（1泊あたり）</h2>
          <div className="flex flex-col gap-2">
            <div>
              <div className="opacity-60">実効（JPY/泊）</div>
              <div className="font-medium">{jpy(actualPerNight)}</div>
              <div className="opacity-70 mt-1">
                実効 = 買値(ETH) × ETH/JPY ÷ 泊数
                <br />= {eth(annotated?.priceEth)} ×{" "}
                {jpy(DEFAULT_PRICING_CONFIG.ethJpy)} ÷ {nights}
              </div>
            </div>
            <div className="pt-2">
              <div className="opacity-60">公正（JPY/泊）</div>
              <div className="font-medium">{jpy(fairPerNight)}</div>
              <div className="opacity-70 mt-1">
                公正 = baseline × 季節(月×エリア) × 曜日平均 × 連泊 ×
                リードタイム
              </div>
              {fair && (
                <ul className="mt-2 grid grid-cols-2 gap-2">
                  <li>
                    <span className="opacity-60">baseline</span>
                    <div>{jpy(fair.baselinePerNightJpy)}</div>
                  </li>
                  <li>
                    <span className="opacity-60">季節（月×エリア）</span>
                    <div>
                      {fair.month.area} {fair.month.month}月 ×{" "}
                      {fair.month.factor}
                    </div>
                  </li>
                  <li className="col-span-2">
                    <span className="opacity-60">曜日平均</span>
                    <div>
                      {fair.dowFactors
                        .map((d) => `${d.dateIso}(${d.dow}): ×${d.factor}`)
                        .join(" / ")}{" "}
                      ⇒ 平均 ×{fair.dowAvg.toFixed(2)}
                    </div>
                  </li>
                  <li>
                    <span className="opacity-60">連泊</span>
                    <div>
                      {fair.longStay.nights}泊 × {fair.longStay.factor}
                    </div>
                  </li>
                  <li>
                    <span className="opacity-60">リードタイム</span>
                    <div>
                      {fair.leadtime.daysUntil}日先 × {fair.leadtime.factor}
                    </div>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border p-4 bg-white/5 text-sm">
          <h2 className="font-semibold mb-2">物件情報</h2>
          <ul className="grid grid-cols-2 gap-2">
            <li>
              <span className="opacity-60">エリア</span>
              <div>{annotated?.area ?? "-"}</div>
            </li>
            <li>
              <span className="opacity-60">定員</span>
              <div>
                {annotated?.capacity
                  ? `標準${annotated.capacity.standard} / 最大${annotated.capacity.max}（添い寝${annotated.capacity.coSleepingMax}）`
                  : "-"}
              </div>
            </li>
            <li>
              <span className="opacity-60">baseline</span>
              <div>{jpy(annotated?.baselinePerNightJpy)}</div>
            </li>
            <li>
              <span className="opacity-60">ラベル</span>
              <div>{annotated?.label ?? "-"}</div>
            </li>
            <li className="col-span-2">
              <span className="opacity-60">販売期間</span>
              <div>
                {listing?.startTimeIso} 〜 {listing?.endTimeIso}
              </div>
            </li>
          </ul>
        </div>
        <div className="rounded-lg border p-4 bg-white/5 text-sm">
          <h2 className="font-semibold mb-2">NFT Traits</h2>
          {traits && traits.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {traits.map((t, i) => (
                <div
                  key={`${t.trait_type}-${i}`}
                  className="rounded border px-2 py-1 bg-white/3 flex items-center justify-between gap-2"
                >
                  <span className="opacity-70 text-xs">{t.trait_type}</span>
                  <span className="text-sm font-medium">{String(t.value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="opacity-70">
              トレイト情報が見つかりませんでした。
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
