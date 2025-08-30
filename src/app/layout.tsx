import type { Metadata } from "next";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
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
  // 表示用の整形はここで完了させる（AppHeaderは表示専用）
  function jpyCompact(n: number): string {
    try {
      const m = n / 1_000_000;
      const s = m.toLocaleString("en-US", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      });
      return `${s}M`;
    } catch {
      const m = Math.round((n / 1_000_000) * 1000) / 1000;
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
  const ethJpyDisplay = jpyCompact(ethJpy);
  const ethJpyTitle = `1 ETH = 約${ethJpyDisplay} / 取得: ${fetchedAt.full}`;
  return (
    <html lang="ja">
      <body className="antialiased">
        <AppHeader ethJpyDisplay={ethJpyDisplay} ethJpyTitle={ethJpyTitle} />
        <main className="pt-14 md:pt-6">{children}</main>
      </body>
    </html>
  );
}
