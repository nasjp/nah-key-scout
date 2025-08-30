import type { Metadata } from "next";
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
