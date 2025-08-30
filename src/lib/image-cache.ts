// Helpers to derive local cached image path for house thumbnails
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export function safeHouseId(id: string): string {
  return id.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase();
}

export function extFromUrl(url: string | undefined): string {
  if (!url) return ".jpg";
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".jpeg")) return ".jpg";
    if (pathname.endsWith(".jpg")) return ".jpg";
    if (pathname.endsWith(".png")) return ".png";
    if (pathname.endsWith(".webp")) return ".webp";
    if (pathname.endsWith(".gif")) return ".gif";
    if (pathname.endsWith(".avif")) return ".avif";
    return ".jpg";
  } catch {
    return ".jpg";
  }
}

export function localHouseImagePath(
  houseId: string | undefined,
  imgUrl: string | undefined,
): string | undefined {
  if (!houseId) return undefined;
  const base = safeHouseId(houseId);
  const ext = extFromUrl(imgUrl);
  return `/house-images/${base}${ext}`;
}

// Pre-optimized variant helpers
export type HouseImageMeta = {
  files: Record<string, string>; // width -> public path (e.g., "800" -> "/house-images/foo-w800.webp")
  blurDataURL?: string;
};

export async function readHouseImageMeta(
  houseId: string | undefined,
): Promise<HouseImageMeta | undefined> {
  if (!houseId) return undefined;
  const base = safeHouseId(houseId);
  const metaPath = join(
    process.cwd(),
    "public",
    "house-images",
    `${base}.meta.json`,
  );
  try {
    const buf = await readFile(metaPath, "utf8");
    const json = JSON.parse(buf) as HouseImageMeta;
    return json;
  } catch {
    return undefined;
  }
}

export async function getHouseImageVariant(
  houseId: string | undefined,
  preferredWidth = 1200,
): Promise<{ src?: string; blurDataURL?: string }> {
  const meta = await readHouseImageMeta(houseId);
  if (!meta) return {};
  const widths = Object.keys(meta.files)
    .map((w) => Number.parseInt(w, 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (widths.length === 0) return { blurDataURL: meta.blurDataURL };
  const picked =
    widths.find((w) => w >= preferredWidth) ?? widths[widths.length - 1];
  const src = meta.files[String(picked)];
  return { src, blurDataURL: meta.blurDataURL };
}
