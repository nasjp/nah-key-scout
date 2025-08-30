import Image from "next/image";

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

export const revalidate = 60; // 1分ごとにISR更新

const CONTRACT = "0xf3f8257fbcfdeff9354b6a0e1a948f7a5ff135a2";

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

export default async function ItemDetail({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const apiKey = process.env.OPENSEA_API_KEY;
  const { tokenId } = await params;

  let listing = undefined as
    | Awaited<ReturnType<typeof fetchOpenseaListingsJoined>>[number]
    | undefined;
  let annotated = undefined as
    | ReturnType<typeof annotateListingsWithFairness>[number]
    | undefined;
  let fair: FairBreakdown | undefined;
  let _traits:
    | Array<{ trait_type: string; value: string | number }>
    | undefined;
  let otherListings:
    | ReturnType<typeof annotateListingsWithFairness>
    | undefined;

  if (apiKey) {
    const rows = await fetchOpenseaListingsJoined("the-key-nah", apiKey, "all");
    const inToken = rows.filter(
      (r) => r.contract.toLowerCase() === CONTRACT && r.tokenId === tokenId,
    );
    listing = inToken[0];
    if (listing) {
      const annAll = annotateListingsWithFairness(inToken);
      annotated = annAll
        .slice()
        .sort((a, b) => (b.discountPct ?? -999) - (a.discountPct ?? -999))[0];
      otherListings = annAll
        .slice()
        .sort((a, b) => (a.priceEth ?? 0) - (b.priceEth ?? 0));
      const houseInfo = annotated.houseId
        ? HOUSE_TABLE[annotated.houseId]
        : undefined;
      if (houseInfo && annotated.checkinJst && annotated.nights) {
        const d = parseCheckinDateJst(annotated.checkinJst);
        if (d) fair = computeFairBreakdown(houseInfo, d, annotated.nights);
      }
    }
    const meta = await fetchNftMeta(CONTRACT, tokenId, apiKey);
    _traits = meta.nft?.traits;
  }

  const title = annotated?.house ?? `${tokenId}`;
  const img = annotated?.officialThumbUrl;
  const nights = annotated?.nights ?? 1;
  const actualPerNight = annotated?.actualPerNightJpy;
  const fairPerNight = annotated?.fairPerNightJpy ?? fair?.fairPerNightJpy;
  const discount = annotated?.discountPct;
  const WEEK_JP = ["日", "月", "火", "水", "木", "金", "土"] as const;
  function formatCheckin(dateStr?: string): string {
    if (!dateStr) return "-";
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
          {listing?.openseaAssetUrl && (
            <a
              className="underline whitespace-nowrap"
              href={listing.openseaAssetUrl}
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
                {formatCheckin(annotated?.checkinJst)}
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
                        .map((d) => `${d.dateIso}(${d.dowJp}): ×${d.factor}`)
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

      {otherListings && otherListings.length > 0 && (
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
                    <td className="py-1 pr-4">{eth(l.priceEth)}</td>
                    <td className="py-1 pr-4">{jpy(l.actualPerNightJpy)}</td>
                    <td className="py-1 pr-4">{jpy(l.fairPerNightJpy)}</td>
                    <td className="py-1 pr-4">{pct(l.discountPct)}</td>
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
