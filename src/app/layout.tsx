import type { Metadata } from "next";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import { getEthJpy } from "@/lib/eth-jpy";
import { formatJpyCompactMillions, jstNowParts } from "@/lib/format";

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
  const fetchedAt = jstNowParts();
  const ethJpyDisplay = formatJpyCompactMillions(ethJpy);
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
