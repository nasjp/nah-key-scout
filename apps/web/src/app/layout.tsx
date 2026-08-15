import type { Metadata } from "next";
import "./globals.css";
import { getEthJpy } from "@nah/core/eth-jpy";
import { formatJpyCompactMillions } from "@nah/core/format";
import { Analytics } from "@vercel/analytics/next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "NOT A HOTEL - KEY SCOUT",
  description: "NOT A HOTEL - KEY SCOUT",
};

type Props = {
  ethJpyDisplay: string;
  ethJpyTitle: string;
  ethJpyUnavailable: boolean;
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const rate = await getEthJpy();
  const ethJpyUnavailable = rate.jpy === undefined;
  const ethJpyDisplay = ethJpyUnavailable
    ? "取得失敗"
    : formatJpyCompactMillions(rate.jpy as number);
  const ethJpyTitle = ethJpyUnavailable
    ? `ETH/JPY を取得できませんでした（${rate.failures
        .map((f) => `${f.name}: ${f.reason}`)
        .join(" / ")}）。実効単価と割安度は表示しません。`
    : `1 ETH = 約${ethJpyDisplay} / 出所: ${rate.source} / 取得: ${rate.fetchedAtIso}`;
  return (
    <html lang="ja">
      <body className="antialiased">
        <AppHeader
          ethJpyDisplay={ethJpyDisplay}
          ethJpyTitle={ethJpyTitle}
          ethJpyUnavailable={ethJpyUnavailable}
        />
        <main className="pt-14 md:pt-6">{children}</main>
        <Analytics />
      </body>
    </html>
  );
}

function AppHeader({ ethJpyDisplay, ethJpyTitle, ethJpyUnavailable }: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50">
      <div className="max-w-5xl mx-auto px-4 h-auto min-h-[56px] md:min-h-[44px] py-0 flex items-center justify-between gap-4">
        <Link href="/" className="font-semibold leading-tight">
          <span>NOT A HOTEL</span>
          <span className="mx-1 hidden md:inline">-</span>
          <br className="md:hidden" />
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
            className={`text-[11px] whitespace-nowrap rounded border px-2 py-0.5 ${
              ethJpyUnavailable
                ? "border-amber-500 bg-amber-100 text-amber-900"
                : "opacity-80 bg-white/40"
            }`}
            title={ethJpyTitle}
          >
            ETH/JPY {ethJpyDisplay}
          </span>
        </nav>
      </div>
    </header>
  );
}
