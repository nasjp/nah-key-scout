import { HOUSE_TABLE } from "@/lib/nah-the-key";

function jpy(n: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(n);
}

export default function About() {
  const entries = Object.entries(HOUSE_TABLE);
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
        <p className="text-sm opacity-70">
          このサイトは非公式のファンプロジェクトです。
        </p>
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
                    {jpy(h.baselinePerNightJpy)}
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
