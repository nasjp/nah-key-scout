import { requireEnv } from "@nah/core/env";
import type { HomeCardVM, HomeViewModel } from "@nah/core/view-models";
import { buildHomeViewModel } from "@nah/core/view-models";
import Link from "next/link";
import FadeImage from "@/components/FadeImage";

export const revalidate = 7200; // 120分ごとにISR更新

const OPENSEA_API_KEY = requireEnv("OPENSEA_API_KEY");

export default async function Home() {
  const vm = await buildHomeViewModel(OPENSEA_API_KEY, { limit: 24 });
  const { totalListings, items, rate, diagnostics } = vm;

  return (
    <div className="font-sans max-w-5xl mx-auto min-h-screen p-6 sm:p-10 flex flex-col gap-4">
      <main className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="text-sm opacity-70">
            リスティング総数: {totalListings} / 表示アイテム数: {items.length}
          </div>
          <div className="text-sm">
            <a
              className="underline"
              href="https://opensea.io/ja/collection/the-key-nah?status=listed"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenSea
            </a>
          </div>
        </div>

        {rate.unavailable && (
          <div className="rounded border border-amber-500 bg-amber-100 text-amber-900 text-sm p-3">
            <strong>ETH/JPY レートを取得できませんでした。</strong>
            実効単価と割安度は算出していません（推測レートで計算すると盤面全体が反転するため）。
            {rate.failures.length > 0 && (
              <span className="block opacity-80 text-xs mt-1">
                {rate.failures.map((f) => `${f.name}: ${f.reason}`).join(" / ")}
              </span>
            )}
          </div>
        )}

        <DiagnosticsBar vm={vm} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((card, i) => (
            <HomeListingCard
              key={card.item.orderHash}
              vm={card}
              // ファーストビュー付近は優先読み込みでチラつきを軽減
              priority={i < 6}
            />
          ))}
        </div>

        {diagnostics.unresolvedHouseNames.length > 0 && (
          <div className="text-xs opacity-70">
            ハウス未解決の表記: {diagnostics.unresolvedHouseNames.join(" / ")}
          </div>
        )}
      </main>
    </div>
  );
}

function DiagnosticsBar({ vm }: { vm: HomeViewModel }) {
  const d = vm.diagnostics;
  const excluded =
    d.expired + d.unknownHouse + d.unknownCheckin + d.unknownNights;
  if (excluded === 0) return null;
  const parts = [
    d.expired > 0 ? `失効 ${d.expired}` : null,
    d.unknownHouse > 0 ? `ハウス不明 ${d.unknownHouse}` : null,
    d.unknownCheckin > 0 ? `日付不明 ${d.unknownCheckin}` : null,
    d.unknownNights > 0 ? `泊数不明 ${d.unknownNights}` : null,
  ].filter(Boolean);
  return (
    <div className="rounded border text-sm p-3 bg-black/5">
      判定できず一覧から除外: {excluded}件（{parts.join(" / ")}）
    </div>
  );
}

const UNCERTAINTY_STYLE: Record<string, string> = {
  Low: "border-emerald-600 text-emerald-800 bg-emerald-50",
  Med: "border-amber-600 text-amber-800 bg-amber-50",
  High: "border-rose-600 text-rose-800 bg-rose-50",
};

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
          <FadeImage
            src={display.imageUrl}
            alt={title}
            width={800}
            height={320}
            className="w-full h-40 object-cover"
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            priority={priority}
          />
        ) : (
          <div className="w-full h-40 bg-black/10 flex items-center justify-center text-xs opacity-60">
            No Image
          </div>
        )}
        <div className="p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-base underline">{title}</h2>
            <div className="flex items-center gap-1 shrink-0">
              {display.uncertainty && (
                <span
                  className={`text-[10px] rounded px-1.5 py-0.5 border ${
                    UNCERTAINTY_STYLE[display.uncertainty] ?? ""
                  }`}
                  title={`baseline の確度: ${display.uncertaintyNote ?? ""}${
                    display.baselineReason ? ` — ${display.baselineReason}` : ""
                  }`}
                >
                  {display.uncertainty}
                </span>
              )}
              <span className="text-xs rounded px-2 py-0.5 border">
                {label || "-"}
              </span>
            </div>
          </div>
          <div className="text-xs opacity-70">{it.place ?? ""}</div>
          <div className="text-sm opacity-80">
            {display.checkin
              ? `${display.checkin} / ${nights ?? "?"}泊`
              : `${nights ?? "?"}泊`}
            {display.daysUntilCheckin !== undefined && (
              <span className="opacity-60">
                {" "}
                ・あと{display.daysUntilCheckin}日
              </span>
            )}
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
              <span className="font-medium">
                {display.discountPct ?? "-"}
                {display.discountRange && (
                  <span className="ml-1 text-xs opacity-60">
                    {display.discountRange}
                  </span>
                )}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">買値</span>
              <span className="font-medium">{display.priceEth ?? "-"}</span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-60">上限入札</span>
              <span className="font-medium">{display.maxBidEth ?? "-"}</span>
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
