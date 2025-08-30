import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // より高圧縮のAVIF/WEBPを優先（配信サイズ削減→体感高速化）
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "notahotel.com" },
      { protocol: "https", hostname: "i2.seadn.io" },
      { protocol: "https", hostname: "images.microcms-assets.io" },
    ],
  },
};

export default nextConfig;
