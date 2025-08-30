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
        <AppHeader ethJpy={ethJpy} fetchedAtFull={fetchedAt.full} />
        <main style={{ paddingTop: "var(--app-header-h, 56px)" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
