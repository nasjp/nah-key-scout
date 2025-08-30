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

function formatJpy(n: number): string {
  try {
    return `¥${n.toLocaleString("ja-JP")}`;
  } catch {
    const s = String(n);
    return `¥${s.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  }
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
  // Handle area root pages like /shop/tokyo or /shop/rusutsu as single items
  if (!slug && seg.length === 2) {
    const areaSlug = (seg[1] || "").toLowerCase();
    // Use area name as temporary display name; will refine from og:title later
    return { id: area as HouseId, name: area, slug: areaSlug };
  }
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

function extractOgTitle(html: string): string | undefined {
  const m = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  );
  return m?.[1];
}

function deriveNameFromOgTitle(
  title: string | undefined,
  _area: string,
): string | undefined {
  if (!title) return undefined;
  // Examples:
  //  - "THE NIGO HOUSE - NOT A HOTEL TOKYO" => "THE NIGO HOUSE"
  //  - "NOT A HOTEL RUSUTSU" => "RUSUTSU"
  const sep = title.match(/\s[-–—]\sNOT A HOTEL\s+/i);
  if (sep) {
    const head = title.split(sep[0])[0]?.trim();
    if (head) return head;
  }
  const nahPrefix = title.match(/^NOT A HOTEL\s+/i);
  if (nahPrefix) {
    return title.replace(/^NOT A HOTEL\s+/i, "").trim();
  }
  return title.trim();
}

// ===== 手動オーバーライド（公式ヘルプ・物件ページ準拠） =====
const CAPACITY_OVERRIDES: Partial<Record<HouseId, Capacity>> = {
  // ISHIGAKI
  EARTH_ISHIGAKI: { standard: null, max: 10, coSleepingMax: 6 },
  TOJI_MINAKAMI: { standard: 4, max: 8, coSleepingMax: 4 },
  CLUB_SUITE_MIURA: { standard: null, max: 4, coSleepingMax: null },
  CLUB_VILLA_MIURA: { standard: null, max: 8, coSleepingMax: null },
  BASE_L_KITA_KARUIZAWA: { standard: 4, max: 8, coSleepingMax: 4 },
  BASE_M_KITA_KARUIZAWA: { standard: 4, max: 4, coSleepingMax: 4 },
  BASE_S_KITA_KARUIZAWA: { standard: 2, max: 2, coSleepingMax: 2 },
  IRORI_KITA_KARUIZAWA: { standard: 4, max: 8, coSleepingMax: 4 },
  MASU_KITA_KARUIZAWA: { standard: null, max: 4, coSleepingMax: null },
  // AOSHIMA
  AOSHIMA_EXCLUSIVE: { standard: 4, max: 10, coSleepingMax: 2 },
  CHILL_AOSHIMA: { standard: 2, max: 4, coSleepingMax: 2 },
  SURF_AOSHIMA: { standard: 2, max: 4, coSleepingMax: 2 },
  GARDEN_AOSHIMA: { standard: 2, max: 4, coSleepingMax: 2 },
  CHILL_2_AOSHIMA: { standard: null, max: 6, coSleepingMax: null },
  COAST_AOSHIMA: { standard: null, max: 4, coSleepingMax: null },
  MASTERPIECE_NASU: { standard: 4, max: 10, coSleepingMax: 4 },
  // NASU
  CAVE_NASU: { standard: 6, max: 6, coSleepingMax: null },
  THINK_NASU: { standard: 4, max: 4, coSleepingMax: 3 },
  PENTHOUSE_FUKUOKA: { standard: 4, max: 8, coSleepingMax: 2 },
  SOUND_FUKUOKA: { standard: 4, max: 8, coSleepingMax: 2 },
  BAR_FUKUOKA: { standard: 4, max: 8, coSleepingMax: 2 },
  RETREAT_FUKUOKA: { standard: 4, max: 8, coSleepingMax: 2 },
  "+ATELIER_FUKUOKA": { standard: 4, max: 8, coSleepingMax: 2 },
  "+CHEF_FUKUOKA": { standard: 4, max: 8, coSleepingMax: 2 },
  "+DESK_FUKUOKA": { standard: 4, max: 8, coSleepingMax: 2 },
  DOMA_FUKUOKA: { standard: 4, max: 8, coSleepingMax: 2 },
  // SETOUCHI
  "180_SETOUCHI": { standard: null, max: 8, coSleepingMax: null },
  "270_SETOUCHI": { standard: null, max: 10, coSleepingMax: null },
  "360_SETOUCHI": { standard: null, max: 10, coSleepingMax: null },
  TOKYO: { standard: null, max: 12, coSleepingMax: null },
  RUSUTSU: { standard: null, max: 8, coSleepingMax: null },
};

const BASELINE_OVERRIDES: Partial<Record<HouseId, number>> = {
  // ISHIGAKI / MINAKAMI
  EARTH_ISHIGAKI: 1_000_000,
  TOJI_MINAKAMI: 400_000,

  // MIURA
  CLUB_SUITE_MIURA: 330_000,
  CLUB_VILLA_MIURA: 450_000,

  // KITA_KARUIZAWA
  BASE_L_KITA_KARUIZAWA: 280_000,
  BASE_M_KITA_KARUIZAWA: 180_000,
  BASE_S_KITA_KARUIZAWA: 100_000,
  IRORI_KITA_KARUIZAWA: 450_000,
  MASU_KITA_KARUIZAWA: 300_000,

  // AOSHIMA
  AOSHIMA_EXCLUSIVE: 450_000,
  CHILL_AOSHIMA: 350_000,
  SURF_AOSHIMA: 250_000,
  GARDEN_AOSHIMA: 150_000,
  COAST_AOSHIMA: 300_000,
  CHILL_2_AOSHIMA: 400_000,

  // NASU
  MASTERPIECE_NASU: 500_000,
  CAVE_NASU: 500_000,
  THINK_NASU: 500_000,

  // FUKUOKA
  PENTHOUSE_FUKUOKA: 180_000,
  SOUND_FUKUOKA: 120_000,
  BAR_FUKUOKA: 120_000,
  RETREAT_FUKUOKA: 120_000,
  "+ATELIER_FUKUOKA": 120_000,
  "+CHEF_FUKUOKA": 120_000,
  "+DESK_FUKUOKA": 120_000,
  DOMA_FUKUOKA: 120_000,

  // SETOUCHI
  "180_SETOUCHI": 500_000,
  "270_SETOUCHI": 550_000,
  "360_SETOUCHI": 600_000,

  // TOKYO / RUSUTSU
  TOKYO: 3_000_000,
  RUSUTSU: 1_200_000,
};

const BASELINE_REASON_OVERRIDES: Partial<Record<HouseId, string>> = {
  // ISHIGAKI / MINAKAMI
  EARTH_ISHIGAKI: "推定: フラッグシップ（面積/販売価格）から100万円/泊",
  TOJI_MINAKAMI: "公式定価: 40万円〜/泊（掲載情報ベース）",

  // MIURA
  CLUB_SUITE_MIURA: "推定: 販売価格(年10泊)と青島層との相対比較 →33万円",
  CLUB_VILLA_MIURA: "推定: 規模・プール付・販売価格から →45万円",

  // KITA_KARUIZAWA
  BASE_L_KITA_KARUIZAWA: "公式アプリ: ¥280,000~/1 night",
  BASE_M_KITA_KARUIZAWA: "推定: BASE S(10万)とL(28万)の中間 →18万円",
  BASE_S_KITA_KARUIZAWA: "推定: 同シリーズの価格帯とサイズ比から →10万円",
  IRORI_KITA_KARUIZAWA: "公式アプリ: ¥450,000~/1 night",
  MASU_KITA_KARUIZAWA: "推定: 面積・仕様でBASE L/IRORIの中間 →30万円",

  // AOSHIMA
  AOSHIMA_EXCLUSIVE: "公式アプリ: ¥450,000~/1 night",
  CHILL_AOSHIMA: "公式アプリ: ¥350,000~/1 night",
  SURF_AOSHIMA: "公式アプリ: ¥250,000~/1 night",
  GARDEN_AOSHIMA: "公式アプリ: ¥150,000~/1 night",
  COAST_AOSHIMA: "推定: 販売価格と青島内の序列から →30万円",
  CHILL_2_AOSHIMA: "推定: CHILL(35万)とMASTERPIECE(45万)の中間 →40万円",

  // NASU
  MASTERPIECE_NASU: "媒体: 1棟1泊¥500,000〜",
  CAVE_NASU: "推定: NASUの上位水準に合わせて50万円",
  THINK_NASU: "公式アプリ: ¥500,000~/1 night",

  // FUKUOKA
  PENTHOUSE_FUKUOKA: "公式アプリ: ¥180,000~/1 night",
  SOUND_FUKUOKA: "公式/媒体: 定価¥120,000~/1 night（部屋により異なる）",
  BAR_FUKUOKA: "公式/媒体: 定価¥120,000~/1 night（部屋により異なる）",
  RETREAT_FUKUOKA: "公式/媒体: 定価¥120,000~/1 night（部屋により異なる）",
  "+ATELIER_FUKUOKA": "公式/媒体: 定価¥120,000~/1 night（部屋により異なる）",
  "+CHEF_FUKUOKA": "公式/媒体: 定価¥120,000~/1 night（部屋により異なる）",
  "+DESK_FUKUOKA": "公式/媒体: 定価¥120,000~/1 night（部屋により異なる）",
  DOMA_FUKUOKA: "公式/媒体: 定価¥120,000~/1 night（部屋により異なる）",

  // SETOUCHI
  "180_SETOUCHI": "推定: 販売価格帯とシリーズ内ポジション →50万円",
  "270_SETOUCHI": "推定: 販売価格帯とシリーズ内ポジション →55万円",
  "360_SETOUCHI": "推定: 販売価格帯とシリーズ内ポジション →60万円",

  // TOKYO / RUSUTSU
  TOKYO: "推定: 公開宿泊価格なし。物件カテゴリ最上位水準としての仮置き",
  RUSUTSU: "推定: 販売水準(~11.85億/30泊)と規模から →120万円",
};

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

  // Explicitly include area root pages that are individual houses
  for (const p of ["/shop/tokyo", "/shop/rusutsu"]) {
    itemPaths.add(p);
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
    const ogTitle = extractOgTitle(html);
    const nameFromTitle = deriveNameFromOgTitle(ogTitle, String(meta.area));
    const baselineExtracted = extractBaselinePriceJpy(html);
    const cap =
      CAPACITY_OVERRIDES[hid as HouseId] ??
      defaultCapacity(String(meta.area), meta.slug);
    const fallback =
      meta.area === "AOSHIMA"
        ? 450_000
        : meta.area === "KITA_KARUIZAWA"
          ? 120_000
          : 180_000;
    const baselineManual = BASELINE_OVERRIDES[hid as HouseId];
    const baseline = baselineManual ?? baselineExtracted ?? fallback;
    const baselineReason =
      BASELINE_REASON_OVERRIDES[hid as HouseId] ??
      (baselineManual != null
        ? "手動設定: リサーチに基づく基準値"
        : baselineExtracted != null
          ? `公式ページ抽出: ${formatJpy(baselineExtracted)}~/1 night`
          : `フォールバック: ${String(meta.area)} の既定値`);
    infos[hid as HouseId] = {
      id: hid as HouseId,
      displayName: nameFromTitle || meta.name,
      area: meta.area,
      capacity: cap,
      baselinePerNightJpy: baseline,
      baselineReason,
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
