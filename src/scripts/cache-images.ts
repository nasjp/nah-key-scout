import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { extFromUrl, safeHouseId } from "@/lib/image-cache";
import { HOUSE_TABLE } from "../lib/nah-the-key.seed";

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
    const file = `${safeHouseId(h.id)}${ext}`;
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
