import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "NOT A HOTEL - THE KEY SCOUT",
  description: "NOT A HOTEL - THE KEY SCOUT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <header className="sticky top-0 z-50 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold">
              NOT A HOTEL - KEY SCOUT
            </Link>
            <nav className="flex items-center gap-4 text-sm">
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
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
