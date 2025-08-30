import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type {
  Area,
  Capacity,
  HouseId,
  HouseInfo,
  PricingConfig,
} from "../lib/nah-the-key.types";

const ORIGIN = "https://notahotel.com";

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (seed-bot)",
      Accept: "text/html,application/xhtml+xml,application/xml",
    },
  });
  if (!res.ok)
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  return await res.text();
}

function extractShopLinks(html: string): string[] {
  const set = new Set<string>();
  const re = /href\s*=\s*"(\/shop\/[^"#?]+)"/gi;
  for (const m of html.matchAll(re)) set.add(m[1]);
  return Array.from(set);
}

function toAbs(url: string): string {
  if (url.startsWith("http")) return url;
  return ORIGIN + url;
}

function extractBaselinePriceJpy(html: string): number | undefined {
  const re = /[¥￥]\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*~\s*\/?\s*1\s*night/i;
  const m = html.match(re);
  if (!m) return undefined;
  const num = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(num) ? num : undefined;
}

function extractOgImage(html: string): string | undefined {
  const m =
    html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    );
  return m?.[1];
}

function defaultCapacity(area: string, slug: string): Capacity {
  const a = area.toLowerCase();
  if (a.includes("kitakaruizawa")) {
    if (slug.includes("base-s"))
      return { standard: 2, max: 2, coSleepingMax: 2 };
    return { standard: 4, max: 8, coSleepingMax: 2 };
  }
  return { standard: 4, max: 8, coSleepingMax: 2 };
}

function areaFromPath(path: string): Area {
  const seg = path.split("/").filter(Boolean);
  const area = (seg[1] || "").toUpperCase().replaceAll("-", "_");
  if (area === "KITAKARUIZAWA") return "KITA_KARUIZAWA";
  return area || "FUKUOKA";
}

function idAndNameFromPath(path: string): {
  id: HouseId;
  name: string;
  slug: string;
} {
  const seg = path.split("/").filter(Boolean);
  const slug = (seg[2] || "").toLowerCase();
  const area = areaFromPath(path);
  if (area === "FUKUOKA" && ["desk", "chef", "atelier"].includes(slug)) {
    const up = slug.toUpperCase();
    return { id: `+${up}_FUKUOKA` as HouseId, name: `+${up} FUKUOKA`, slug };
  }
  if (area === "KITA_KARUIZAWA" && slug.startsWith("base-s")) {
    return {
      id: "BASE_S_KITA_KARUIZAWA" as HouseId,
      name: "BASE S 北軽井沢",
      slug,
    };
  }
  if (area === "AOSHIMA" && slug.includes("masterpiece")) {
    return {
      id: "AOSHIMA_EXCLUSIVE" as HouseId,
      name: "AOSHIMA MASTERPIECE",
      slug,
    };
  }
  const id = `${slug}_${area}`.toUpperCase().replaceAll("-", "_") as HouseId;
  const name = `${slug.replaceAll("-", " ").toUpperCase()} ${area}`;
  return { id, name, slug };
}

async function main() {
  // Crawl /shop root and recursively fetch /shop/{area} pages to capture all /shop/{area}/{slug}
  const visited = new Set<string>();
  const queue: string[] = [
    "/shop",
    "/shop/tokyo",
    "/shop/rusutsu",
    "/shop/setouchi",
  ];
  const itemPaths = new Set<string>();

  while (queue.length) {
    const path = queue.shift();
    if (!path) break;
    if (visited.has(path)) continue;
    visited.add(path);
    let html = "";
    try {
      html = await fetchText(ORIGIN + path);
    } catch {
      continue;
    }
    const links = extractShopLinks(html);
    for (const href of links) {
      const abs = toAbs(href);
      const u = new URL(abs);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] !== "shop") continue;
      if (parts.length === 2) {
        if (!visited.has(u.pathname)) queue.push(u.pathname);
      } else if (parts.length >= 3) {
        itemPaths.add(u.pathname);
      }
    }
  }

  const mapping: Record<
    HouseId,
    { url: string; area: Area; slug: string; name: string }
  > = {};
  for (const pathname of itemPaths) {
    const u = new URL(ORIGIN + pathname);
    const area = areaFromPath(u.pathname);
    const { id, name, slug } = idAndNameFromPath(u.pathname);
    mapping[id] = { url: u.toString(), area, slug, name };
  }

  const infos: Partial<Record<HouseId, HouseInfo>> = {};
  for (const [hid, meta] of Object.entries(mapping)) {
    const html = await fetchText(meta.url);
    const og = extractOgImage(html);
    const baseline = extractBaselinePriceJpy(html);
    const cap = defaultCapacity(String(meta.area), meta.slug);
    const fallback =
      meta.area === "AOSHIMA"
        ? 450_000
        : meta.area === "KITA_KARUIZAWA"
          ? 120_000
          : 180_000;
    infos[hid as HouseId] = {
      id: hid as HouseId,
      displayName: meta.name,
      area: meta.area,
      capacity: cap,
      baselinePerNightJpy: baseline ?? fallback,
      officialUrl: meta.url,
      officialThumbUrl: og,
    } as HouseInfo;
  }

  const houseTableTs =
    `// This file is generated by src/scripts/build-seed-from-shop.ts
` +
    `import type { HouseId, HouseInfo, PricingConfig } from "./nah-the-key.types";

` +
    `export const HOUSE_TABLE: Record<HouseId, HouseInfo> = ${JSON.stringify(infos, null, 2)};

` +
    `export const DEFAULT_PRICING_CONFIG: PricingConfig = ${JSON.stringify(defaultPricingConfig(), null, 2)} as PricingConfig;

` +
    resolveHelpersTs();

  const outPath = resolve(process.cwd(), "src/lib/nah-the-key.seed.ts");
  await writeFile(outPath, houseTableTs, "utf8");
  console.error(`[generated] ${outPath}`);
}

function defaultPricingConfig(): PricingConfig {
  return {
    ethJpy: 660000,
    monthFactor: {
      FUKUOKA: {
        "1": 0.9,
        "2": 0.9,
        "3": 1.0,
        "4": 1.05,
        "5": 1.1,
        "6": 1.0,
        "7": 1.05,
        "8": 1.05,
        "9": 1.05,
        "10": 1.1,
        "11": 1.0,
        "12": 0.95,
      },
      KITA_KARUIZAWA: {
        "1": 1.0,
        "2": 1.0,
        "3": 0.95,
        "4": 1.0,
        "5": 1.05,
        "6": 1.0,
        "7": 1.3,
        "8": 1.3,
        "9": 1.1,
        "10": 1.2,
        "11": 0.95,
        "12": 0.95,
      },
      AOSHIMA: {
        "1": 1.0,
        "2": 1.0,
        "3": 1.0,
        "4": 1.05,
        "5": 1.1,
        "6": 1.1,
        "7": 1.2,
        "8": 1.2,
        "9": 1.1,
        "10": 1.1,
        "11": 1.0,
        "12": 1.0,
      },
    },
    dowFactor: {
      Mon: 0.9,
      Tue: 0.9,
      Wed: 0.95,
      Thu: 1.0,
      Fri: 1.15,
      Sat: 1.25,
      Sun: 1.05,
    },
    longStayFactor: { "1": 1.0, "2": 0.95, "3": 0.9 },
    leadtimeFactor: [
      { days_lt: 7, factor: 0.8 },
      { days_lt: 14, factor: 0.9 },
      { days_lt: 30, factor: 0.95 },
      { days_lt: 365, factor: 1.0 },
    ],
  };
}

function resolveHelpersTs(): string {
  return (
    `// ===== helper: 公式ページからOG画像を解決 =====
` +
    `export async function resolveOgImage(url: string): Promise<string | undefined> {
` +
    `  const res = await fetch(url, {
` +
    `    headers: { 'User-Agent': 'Mozilla/5.0 (+https://github.com/whatwg/fetch)' },
` +
    `  });
` +
    `  const html = await res.text();
` +
    `  const m =
` +
    `    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"]+)["']/i) ||
` +
    `    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"]+)["']/i);
` +
    `  return m?.[1];
` +
    `}

` +
    `/** サムネ未設定の項目にOG画像URLを流し込む */
` +
    `export async function hydrateThumbnails(
` +
    `  table: Record<HouseId, HouseInfo> = HOUSE_TABLE,
` +
    `) {
` +
    `  const ids = Object.keys(table) as HouseId[];
` +
    `  for (const id of ids) {
` +
    `    const item = table[id];
` +
    `    if (!item.officialThumbUrl) {
` +
    `      try {
` +
    `        const og = await resolveOgImage(item.officialUrl);
` +
    `        if (og) item.officialThumbUrl = og;
` +
    `      } catch {
` +
    `        // ignore
` +
    `      }
` +
    `    }
` +
    `  }
` +
    `  return table;
` +
    `}
`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
