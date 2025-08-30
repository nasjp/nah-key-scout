import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getEthJpy } from "@/lib/eth-jpy";

export const metadata: Metadata = {
  title: "NOT A HOTEL - KEY SCOUT",
  description: "NOT A HOTEL - KEY SCOUT",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ethJpy = await getEthJpy();
  function jpyCompact(n: number): string {
    // Show in millions with "M" suffix, e.g. 647,000 -> 0.647M
    try {
      const m = n / 1_000_000;
      const s = m.toLocaleString("en-US", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      });
      return `${s}M`;
    } catch {
      const m = Math.round((n / 1_000_000) * 1000) / 1000; // 3 decimals
      return `${m.toFixed(3)}M`;
    }
  }
  function jstNowParts(): { full: string; hm: string } {
    const now = new Date();
    const j = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = j.getUTCFullYear();
    const mo = String(j.getUTCMonth() + 1).padStart(2, "0");
    const da = String(j.getUTCDate()).padStart(2, "0");
    const hh = String(j.getUTCHours()).padStart(2, "0");
    const mm = String(j.getUTCMinutes()).padStart(2, "0");
    return { full: `${y}-${mo}-${da} ${hh}:${mm} JST`, hm: `${hh}:${mm}` };
  }
  const fetchedAt = jstNowParts();
  return (
    <html lang="ja">
      <body className="antialiased">
        <header className="sticky top-0 z-50 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <Link href="/" className="font-semibold leading-tight">
              <span>NOT A HOTEL</span>
              <span className="mx-1 hidden sm:inline">-</span>
              <br className="sm:hidden" />
              <span>KEY SCOUT</span>
            </Link>
            <nav className="flex items-center gap-3 text-sm flex-wrap justify-end">
              <Link href="/about" className="underline">
                About
              </Link>
              <a
                href="https://github.com/nasjp/nah-key-scout"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                GitHub
              </a>
              <span
                className="text-[11px] opacity-80 whitespace-nowrap rounded border px-2 py-0.5 bg-white/40"
                title={`1 ETH = 約${jpyCompact(ethJpy)} / 取得: ${fetchedAt.full}`}
              >
                ETH/JPY {jpyCompact(ethJpy)}
              </span>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
