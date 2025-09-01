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
        <h2 className="text-lg font-semibold">Policy</h2>
        <ul className="list-disc pl-6 text-sm opacity-80 space-y-1">
          <li>
            baseline は各ハウスの「最安 ¥◯◯◯,◯◯◯~/1
            night」を基準。公開が無い場合は販売価格や規模から推定。
          </li>
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
