import FadeImage from "@/components/FadeImage";
import { requireEnv } from "@nah/core/env";
import { buildItemViewModel } from "@nah/core/view-models";

export const revalidate = 7200; // 120分ごとにISR更新

const OPENSEA_API_KEY = requireEnv("OPENSEA_API_KEY");

export default async function ItemDetail({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId } = await params;
  const vm = await buildItemViewModel(OPENSEA_API_KEY, tokenId);

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-10 flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
        <h1 className="text-lg sm:text-xl font-bold leading-tight break-words">
          {vm.title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm mt-1 sm:mt-0 sm:justify-end">
          {vm.header.officialUrl && (
            <a
              className="underline whitespace-nowrap"
              href={vm.header.officialUrl}
              target="_blank"
              rel="noreferrer"
            >
              公式ページ
            </a>
          )}
          {vm.header.openseaAssetUrl && (
            <a
              className="underline whitespace-nowrap"
              href={vm.header.openseaAssetUrl}
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
          {vm.imageUrl ? (
            <FadeImage
              src={vm.imageUrl}
              alt={vm.title}
              width={1200}
              height={600}
              className="w-full h-64 object-cover"
              // ヒーロー画像は優先読み込みでLCP改善
              priority
              sizes="(min-width: 1024px) 60vw, 100vw"
            />
          ) : (
            <div className="w-full h-64 bg-black/10 flex items-center justify-center text-xs opacity-60">
              No Image
            </div>
          )}
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div className="flex flex-col">
              <span className="opacity-60">チェックイン</span>
              <span className="font-medium">{vm.header.checkin ?? "-"}</span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">泊数</span>
              <span className="font-medium">{vm.header.nights}泊</span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">買値</span>
              <span className="font-medium">{vm.header.priceEth ?? "-"}</span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">割安度</span>
              <span className="font-medium">
                {vm.header.discountPct ?? "-"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-4 bg-white/5 flex flex-col gap-3 text-sm">
          <h2 className="font-semibold">価格ロジック（1泊あたり）</h2>
          <div className="flex flex-col gap-2">
            <div>
              <div className="opacity-60">実効（JPY/泊）</div>
              <div className="font-medium">
                {vm.pricing.actualPerNight ?? "-"}
              </div>
              <div className="opacity-70 mt-1">
                実効 = 買値(ETH) × ETH/JPY ÷ 泊数
                <br />= {vm.pricing.equation.priceEth ?? "-"} ×{" "}
                {vm.pricing.equation.ethJpy} ÷ {vm.pricing.equation.nights}
              </div>
            </div>
            <div className="pt-2">
              <div className="opacity-60">公正（JPY/泊）</div>
              <div className="font-medium">
                {vm.pricing.fairPerNight ?? "-"}
              </div>
              {vm.pricing.breakdown && (
                <div className="opacity-70 mt-1">
                  公正 = ベースライン × 季節 × 曜日平均 × 連泊 × リードタイム
                  <br />= {vm.pricing.breakdown.baselineJpy} ×{" "}
                  {vm.pricing.breakdown.month.factor} ×{" "}
                  {vm.pricing.breakdown.dowAvg} ×{" "}
                  {vm.pricing.breakdown.longStay.factor} ×{" "}
                  {vm.pricing.breakdown.leadtime.factor}
                </div>
              )}
              {vm.pricing.breakdown && (
                <ul className="mt-2 grid grid-cols-2 gap-2">
                  <li>
                    <span className="opacity-60">baseline</span>
                    <div>{vm.pricing.breakdown.baselineJpy}</div>
                  </li>
                  <li>
                    <span className="opacity-60">季節（月×エリア）</span>
                    <div>
                      {vm.pricing.breakdown.month.area}{" "}
                      {vm.pricing.breakdown.month.month}月 ×{" "}
                      {vm.pricing.breakdown.month.factor}
                    </div>
                  </li>
                  <li className="col-span-2">
                    <span className="opacity-60">曜日平均</span>
                    <div>
                      {vm.pricing.breakdown.dowLines.join(" / ")} ⇒ 平均 ×
                      {vm.pricing.breakdown.dowAvg}
                    </div>
                  </li>
                  <li>
                    <span className="opacity-60">連泊</span>
                    <div>
                      {vm.pricing.breakdown.longStay.nights}泊 ×{" "}
                      {vm.pricing.breakdown.longStay.factor}
                    </div>
                  </li>
                  <li>
                    <span className="opacity-60">リードタイム</span>
                    <div>
                      {vm.pricing.breakdown.leadtime.daysUntil}日先 ×{" "}
                      {vm.pricing.breakdown.leadtime.factor}
                    </div>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {vm.otherListings.length > 0 && (
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
                {vm.otherListings.map((l) => (
                  <tr key={l.orderHash} className="border-t">
                    <td className="py-1 pr-4">{l.priceEth ?? "-"}</td>
                    <td className="py-1 pr-4">{l.actualPerNight ?? "-"}</td>
                    <td className="py-1 pr-4">{l.fairPerNight ?? "-"}</td>
                    <td className="py-1 pr-4">{l.discountPct ?? "-"}</td>
                    <td className="py-1 pr-4 text-xs">
                      {l.start} → {l.end}
                    </td>
                    <td className="py-1 pr-4">
                      <a
                        className="underline"
                        href={l.url}
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

      <section className="rounded-lg border p-4 bg-white/5 text-sm">
        <h2 className="font-semibold mb-2">NFT Traits</h2>
        {vm.traits && vm.traits.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {vm.traits.map((t, i) => (
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
