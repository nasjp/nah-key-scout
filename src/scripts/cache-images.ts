import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import { HOUSE_TABLE } from "../lib/nah-the-key.seed";

function extFromUrl(url: string): string {
  const p = basename(new URL(url).pathname);
  const e = extname(p).toLowerCase();
  if (e === ".jpeg") return ".jpg";
  if ([".jpg", ".png", ".webp", ".gif", ".avif"].includes(e)) return e;
  return ".jpg";
}

function safeName(id: string): string {
  return id.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase();
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function main() {
  const outDir = join(process.cwd(), "public", "house-images");
  await mkdir(outDir, { recursive: true });

  const entries = Object.values(HOUSE_TABLE);
  for (const h of entries) {
    const url = h.officialThumbUrl;
    if (!url) continue;
    const ext = extFromUrl(url);
    const file = `${safeName(h.id)}${ext}`;
    const outPath = join(outDir, file);
    if (await exists(outPath)) continue;
    try {
      const buf = await download(url);
      await writeFile(outPath, buf);
      console.error(`[cache-images] saved ${outPath}`);
    } catch (e) {
      console.error(`[cache-images] failed ${url}:`, (e as Error).message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 0; // do not fail build
});
