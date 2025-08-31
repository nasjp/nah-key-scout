import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import Link from "next/link";
import { getEthJpy } from "@nah/core/eth-jpy";
import { formatJpyCompactMillions, jstNowParts } from "@nah/core/format";

export const metadata: Metadata = {
  title: "NOT A HOTEL - KEY SCOUT",
  description: "NOT A HOTEL - KEY SCOUT",
};

type Props = {
  ethJpyDisplay: string;
  ethJpyTitle: string;
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ethJpy = await getEthJpy();
  const fetchedAt = jstNowParts();
  const ethJpyDisplay = formatJpyCompactMillions(ethJpy);
  const ethJpyTitle = `1 ETH = 約${ethJpyDisplay} / 取得: ${fetchedAt.full}`;
  return (
    <html lang="ja">
      <body className="antialiased">
        <AppHeader ethJpyDisplay={ethJpyDisplay} ethJpyTitle={ethJpyTitle} />
        <main className="pt-14 md:pt-6">{children}</main>
        <Analytics />
      </body>
    </html>
  );
}

function AppHeader({ ethJpyDisplay, ethJpyTitle }: Props) {
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
            className="text-[11px] opacity-80 whitespace-nowrap rounded border px-2 py-0.5 bg-white/40"
            title={ethJpyTitle}
          >
            ETH/JPY {ethJpyDisplay}
          </span>
        </nav>
      </div>
    </header>
  );
}

