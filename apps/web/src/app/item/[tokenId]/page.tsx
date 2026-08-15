import { requireEnv } from "@nah/core/env";
import { buildItemViewModel } from "@nah/core/view-models";
import FadeImage from "@/components/FadeImage";

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

      {vm.statusNote && (
        <div className="rounded border border-amber-500 bg-amber-100 text-amber-900 text-sm p-3">
          {vm.statusNote}
        </div>
      )}
      {vm.header.checkinMismatch && (
        <div className="rounded border border-amber-500 bg-amber-50 text-amber-900 text-sm p-3">
          トレイトのチェックイン日と tokenId
          に埋まっている日付が食い違っています（トレイト側を採用）。
        </div>
      )}

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
              <span className="font-medium">
                {vm.header.nights != null ? `${vm.header.nights}泊` : "不明"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">買値</span>
              <span className="font-medium">{vm.header.priceEth ?? "-"}</span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">割安度</span>
              <span className="font-medium">
                {vm.header.discountPct ?? "-"}
                {vm.header.discountRange && (
                  <span className="ml-1 text-xs opacity-60">
                    {vm.header.discountRange}
                  </span>
                )}
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
                {vm.pricing.equation.ethJpy ?? "レート未取得"} ÷{" "}
                {vm.pricing.equation.nights ?? "?"}
                <span className="ml-1 opacity-70">
                  （出所: {vm.rate.source}）
                </span>
              </div>
            </div>

            <div className="pt-2">
              <div className="opacity-60">公正（JPY/泊）</div>
              <div className="font-medium">
                {vm.pricing.fairPerNight ?? "-"}
              </div>
              {vm.pricing.breakdown && (
                <div className="opacity-70 mt-1">
                  公正 = baseline × 夜ごと需要係数の平均 × 連泊
                  <br />= {vm.pricing.breakdown.baselineJpy} ×{" "}
                  {vm.pricing.breakdown.demandAvg} ×{" "}
                  {vm.pricing.breakdown.longStay.factor}
                  <br />
                  <span className="text-xs">
                    baseline は公式の「最安1泊」。需要係数はすべて 1.0
                    以上に正規化しているので、公正価格が baseline
                    を下回ることはありません。
                  </span>
                </div>
              )}
            </div>

            {vm.pricing.breakdown && (
              <div className="pt-2 flex flex-col gap-2">
                <div>
                  <span className="opacity-60">baseline の根拠</span>
                  <div>
                    {vm.pricing.breakdown.uncertainty && (
                      <span className="text-[10px] rounded px-1.5 py-0.5 border mr-1">
                        {vm.pricing.breakdown.uncertainty}
                      </span>
                    )}
                    {vm.pricing.breakdown.baselineReason ?? "-"}
                  </div>
                  {vm.pricing.breakdown.uncertaintyNote && (
                    <div className="text-xs opacity-70">
                      {vm.pricing.breakdown.uncertaintyNote}
                      {vm.header.discountRange &&
                        ` — 割安度の誤差幅 ${vm.header.discountRange}pt`}
                    </div>
                  )}
                </div>

                <div>
                  <div className="opacity-60">夜ごとの需要係数</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs mt-1">
                      <thead className="text-left opacity-70">
                        <tr>
                          <th className="py-1 pr-3">日付</th>
                          <th className="py-1 pr-3">月</th>
                          <th className="py-1 pr-3">曜日</th>
                          <th className="py-1 pr-3">特異日</th>
                          <th className="py-1 pr-3">合成</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vm.pricing.breakdown.nights.map((n) => (
                          <tr key={n.dateIso} className="border-t">
                            <td className="py-1 pr-3 whitespace-nowrap">
                              {n.dateIso}({n.dowJp})
                            </td>
                            <td className="py-1 pr-3">×{n.monthFactor}</td>
                            <td className="py-1 pr-3">×{n.dowFactor}</td>
                            <td className="py-1 pr-3">
                              {n.specialFactor > 1
                                ? `×${n.specialFactor}`
                                : "-"}
                            </td>
                            <td className="py-1 pr-3 font-medium">
                              ×{n.factor}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-1">
                    ⇒ 平均 ×{vm.pricing.breakdown.demandAvg}
                  </div>
                </div>

                <div>
                  <span className="opacity-60">連泊</span>
                  <div>
                    {vm.pricing.breakdown.longStay.nights}泊 ×{" "}
                    {vm.pricing.breakdown.longStay.factor}
                  </div>
                </div>
              </div>
            )}

            {vm.pricing.maxBid && (
              <div className="pt-2 border-t">
                <div className="opacity-60">
                  上限入札（この価格以下なら妙味）
                </div>
                <div className="font-medium">{vm.pricing.maxBid.eth}</div>
                <div className="opacity-70 text-xs mt-1">
                  目標割引{" "}
                  {Math.round(vm.pricing.maxBid.targetDiscountRate * 100)}% ＋
                  リードタイム安全マージン{" "}
                  {Math.round(vm.pricing.maxBid.leadtimeMargin * 100)}pt
                  {vm.header.daysUntilCheckin !== undefined &&
                    `（あと${vm.header.daysUntilCheckin}日）`}
                  <br />
                  直前ほど変更不可・流動性のリスクが上がるため、公正価格を下げるのではなく
                  買値に要求する割引を増やす形で織り込んでいます。
                </div>
              </div>
            )}
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
