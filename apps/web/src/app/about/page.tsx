import { formatJpy } from "@nah/core/format";
import { HOUSE_TABLE } from "@nah/core/nah-the-key";

export default function About() {
  const entries = Object.entries(HOUSE_TABLE).sort(
    (a, b) => b[1].baselinePerNightJpy - a[1].baselinePerNightJpy,
  );
  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-10 flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">NOT A HOTEL - KEY SCOUT</h1>
        <p>
          project by{" "}
          <a
            className="underline"
            href="https://github.com/nasjp"
            target="_blank"
            rel="noreferrer"
          >
            nasjp
          </a>
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">算出ロジック</h2>
        <div className="text-sm opacity-80 rounded border p-3 bg-black/5 font-mono">
          公正(JPY/泊) = baseline × avg(夜ごと 月×曜日×特異日) × 連泊
          <br />
          実効(JPY/泊) = 買値(ETH) × ETH/JPY ÷ 泊数
          <br />
          割安度 = 1 − 実効 ÷ 公正
        </div>
        <ul className="list-disc pl-6 text-sm opacity-80 space-y-1">
          <li>
            <strong>baseline は「年内で最も安い1泊」</strong>
            （公式の「¥◯◯◯,◯◯◯〜/1 night」）。需要係数はすべて 1.0
            以上に正規化してあるため、公正価格が公表最安値を下回ることはありません。
          </li>
          <li>
            月係数は<strong>夜ごと</strong>
            に評価します（月をまたぐ滞在でも正しく効きます）。曜日・特異日も同じく夜ごと。
          </li>
          <li>
            年末年始・GW・お盆・連休は月係数では平準化されて消えるため、
            <strong>特異日係数</strong>として別に持っています。
          </li>
          <li>
            <strong>リードタイムは公正価格に含めません。</strong>
            直前は「価値が下がる」のではなく「安く買わないと割に合わない」ので、
            上限入札に上乗せする安全マージンとして扱います。
          </li>
          <li>
            <strong>割安度には信頼区間を併記</strong>します。baseline の確度
            (Low/Med/High) に対応する相対誤差 (±10% / ±25% / ±50%)
            を公正価格に当て、 ラベルと並び順は保守側の下限で決めます。推定
            baseline
            のハウスが「割安に見えるだけ」で上位を占めるのを防ぐためです。
          </li>
          <li>
            チェックイン日が過ぎたキー、ハウス・日付・泊数が特定できないリスティングは
            <strong>推測で埋めず一覧から除外</strong>
            し、件数をトップに表示します。
          </li>
          <li>
            ETH/JPY
            が取得できないときは既定値で代用せず、実効単価と割安度を出しません。
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Policy</h2>
        <ul className="list-disc pl-6 text-sm opacity-80 space-y-1">
          <li>
            検証可能な一次ソース（app.notahotel.com の Places/House Group
            の表記）を最上位ソースとして、公開確認できたものから順次置換。
          </li>
          <li>
            販売価格÷泊数は賃料の提示ではありません（需要期・清掃/運営費・オーナー特典等を含まないため）。上限感・相対比較の材料としてのみ使用。
          </li>
          <li>
            不確実性の等級（High/Med/Low）を併記。公開価格が出たら即 Low
            に置換します。
          </li>
          <li>
            割安度は<strong>公式定価に対する乖離率</strong>
            であって期待利益ではありません。
            キーは日付固定・変更/キャンセル不可である一方、満室日は定価では買えません。
            どちらの向きにも効く非対称はモデルに入っていません。
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Baseline</h2>
        <div className="text-sm opacity-70">物件数: {entries.length}</div>
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Baseline</th>
                <th className="px-3 py-2 text-left">Uncertainty</th>
                <th className="px-3 py-2 text-left">Reason</th>
                <th className="px-3 py-2 text-left">Official</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([id, h]) => (
                <tr key={id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap align-top">
                    {h.displayName}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap align-top">
                    {formatJpy(h.baselinePerNightJpy)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap align-top">
                    {h.uncertainty ?? "-"}
                  </td>
                  <td className="px-3 py-2 align-top min-w-[18rem]">
                    <div className="max-w-[36rem] whitespace-normal break-words opacity-80">
                      {h.baselineReason ?? "-"}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap align-top">
                    <a
                      className="underline"
                      href={h.officialUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Link
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
