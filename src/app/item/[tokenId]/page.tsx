import Image from "next/image";
import { OPENSEA_COLLECTION_SLUG, THE_KEY_CONTRACT } from "@/lib/constants";
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
  computeFairBreakdown,
  DEFAULT_PRICING_CONFIG,
  type FairBreakdown,
  HOUSE_TABLE,
  parseCheckinDateJst,
  pickMostUndervalued,
  sortByPriceAsc,
} from "@/lib/nah-the-key";
import {
  fetchNftMeta,
  fetchOpenseaListingsJoined,
} from "@/lib/opensea-listings";

export const revalidate = 7200; // 120分ごとにISR更新
const OPENSEA_API_KEY = requireEnv("OPENSEA_API_KEY");

export default async function ItemDetail({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId } = await params;
  let ethJpy = DEFAULT_PRICING_CONFIG.ethJpy;

  const rows = await fetchOpenseaListingsJoined(
    OPENSEA_COLLECTION_SLUG,
    OPENSEA_API_KEY,
    "all",
  );
  const inToken = rows.filter(
    (r) =>
      r.contract.toLowerCase() === THE_KEY_CONTRACT && r.tokenId === tokenId,
  );
  ethJpy = await getEthJpy();
  const annAll = annotateListingsWithFairness(inToken, {
    config: { ...DEFAULT_PRICING_CONFIG, ethJpy },
  });
  const annotated: AnnotatedListing | undefined =
    annAll.length > 0 ? pickMostUndervalued(annAll) : undefined;
  const otherListings: AnnotatedListing[] =
    annAll.length > 0 ? sortByPriceAsc(annAll) : [];
  const houseInfo = annotated?.houseId
    ? HOUSE_TABLE[annotated.houseId]
    : undefined;
  const d = annotated?.checkinJst
    ? parseCheckinDateJst(annotated.checkinJst)
    : undefined;
  const fair: FairBreakdown | undefined =
    houseInfo && d && annotated?.nights
      ? computeFairBreakdown(houseInfo, d, annotated.nights)
      : undefined;
  const meta = await fetchNftMeta(THE_KEY_CONTRACT, tokenId, OPENSEA_API_KEY);
  const _traits = meta.nft?.traits as
    | Array<{ trait_type: string; value: string | number }>
    | undefined;

  const title = annotated?.house ?? `${tokenId}`;
  const img = annotated?.officialThumbUrl;
  const localImg = localHouseImagePath(annotated?.houseId, img);
  const nights = annotated?.nights ?? 1;
  const actualPerNight = annotated?.actualPerNightJpy;
  const fairPerNight = annotated?.fairPerNightJpy ?? fair?.fairPerNightJpy;
  const discount = annotated?.discountPct;

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-10 flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
        <h1 className="text-lg sm:text-xl font-bold leading-tight break-words">
          {title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm mt-1 sm:mt-0 sm:justify-end">
          {annotated?.officialUrl && (
            <a
              className="underline whitespace-nowrap"
              href={annotated.officialUrl}
              target="_blank"
              rel="noreferrer"
            >
              公式ページ
            </a>
          )}
          {annotated?.openseaAssetUrl && (
            <a
              className="underline whitespace-nowrap"
              href={annotated.openseaAssetUrl}
              target="_blank"
              rel="noreferrer"
            >
              OpenSea
            </a>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        <div className="rounded-lg overflow-hidden border bg-white/5">
          {localImg ? (
            <Image
              src={localImg}
              alt={title}
              width={1200}
              height={600}
              className="w-full h-64 object-cover"
            />
          ) : img ? (
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
                {formatCheckinJst(annotated?.checkinJst)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">泊数</span>
              <span className="font-medium">{nights}泊</span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">買値</span>
              <span className="font-medium">
                {formatEth(annotated?.priceEth)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">割安度</span>
              <span className="font-medium">{formatPct(discount)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-4 bg-white/5 flex flex-col gap-3 text-sm">
          <h2 className="font-semibold">価格ロジック（1泊あたり）</h2>
          <div className="flex flex-col gap-2">
            <div>
              <div className="opacity-60">実効（JPY/泊）</div>
              <div className="font-medium">{formatJpy(actualPerNight)}</div>
              <div className="opacity-70 mt-1">
                実効 = 買値(ETH) × ETH/JPY ÷ 泊数
                <br />= {formatEth(annotated?.priceEth)} × {formatJpy(ethJpy)} ÷{" "}
                {nights}
              </div>
            </div>
            <div className="pt-2">
              <div className="opacity-60">公正（JPY/泊）</div>
              <div className="font-medium">{formatJpy(fairPerNight)}</div>
              {fair && (
                <div className="opacity-70 mt-1">
                  公正 = ベースライン × 季節 × 曜日平均 × 連泊 × リードタイム
                  <br />= {formatJpy(fair.baselinePerNightJpy)} ×{" "}
                  {fair.month.factor} × {fair.dowAvg.toFixed(2)} ×{" "}
                  {fair.longStay.factor} × {fair.leadtime.factor}
                </div>
              )}
              {fair && (
                <ul className="mt-2 grid grid-cols-2 gap-2">
                  <li>
                    <span className="opacity-60">baseline</span>
                    <div>{formatJpy(fair.baselinePerNightJpy)}</div>
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
                        .map((d) => `${d.dateIso}(${d.dowJp}) × ${d.factor}`)
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

      {otherListings.length > 0 && (
        <section className="rounded-lg border p-4 bg-white/5 text-sm">
          <h2 className="font-semibold mb-2">
            他のリスティング（同一トークン）
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left opacity-70">
                <tr>
                  <th className="py-1 pr-4">価格(ETH)</th>
                  <th className="py-1 pr-4">実効(JPY/泊)</th>
                  <th className="py-1 pr-4">公正(JPY/泊)</th>
                  <th className="py-1 pr-4">割安度</th>
                  <th className="py-1 pr-4">期間</th>
                  <th className="py-1 pr-4">リンク</th>
                </tr>
              </thead>
              <tbody>
                {otherListings.map((l) => (
                  <tr key={l.orderHash} className="border-t">
                    <td className="py-1 pr-4">{formatEth(l.priceEth)}</td>
                    <td className="py-1 pr-4">
                      {formatJpy(l.actualPerNightJpy)}
                    </td>
                    <td className="py-1 pr-4">
                      {formatJpy(l.fairPerNightJpy)}
                    </td>
                    <td className="py-1 pr-4">{formatPct(l.discountPct)}</td>
                    <td className="py-1 pr-4 text-xs">
                      {l.startTimeIso?.slice(0, 10)} →{" "}
                      {l.endTimeIso?.slice(0, 10)}
                    </td>
                    <td className="py-1 pr-4">
                      <a
                        className="underline"
                        href={l.openseaAssetUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        OpenSea
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {/* NFT Traits */}
      <section className="rounded-lg border p-4 bg-white/5 text-sm">
        <h2 className="font-semibold mb-2">NFT Traits</h2>
        {_traits && _traits.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {_traits.map((t, i) => (
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
          <div className="opacity-70">トレイト情報が見つかりませんでした。</div>
        )}
      </section>
    </div>
  );
}
