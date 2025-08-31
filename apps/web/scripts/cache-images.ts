import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";
import { extFromUrl, safeHouseId } from "@nah/core/image-cache";
import { HOUSE_TABLE } from "@nah/core/nah-the-key.seed";

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

async function generateVariants(
  input: Buffer,
  outDir: string,
  base: string,
): Promise<{ files: Record<string, string>; blurDataURL?: string }> {
  const files: Record<string, string> = {};
  const widths = [400, 800, 1200];
  const pipeline = sharp(input).rotate();

  // LQIP (very small webp)
  try {
    const lq = await pipeline
      .clone()
      .resize({ width: 12 })
      .webp({ quality: 30 })
      .toBuffer();
    const blurDataURL = `data:image/webp;base64,${lq.toString("base64")}`;
    // generate size variants
    for (const w of widths) {
      const filename = `${base}-w${w}.webp`;
      const outPath = join(outDir, filename);
      await sharp(input)
        .rotate()
        .resize({ width: w })
        .webp({ quality: 72 })
        .toFile(outPath);
      files[String(w)] = `/house-images/${filename}`;
    }
    return { files, blurDataURL };
  } catch (e) {
    console.error(
      `[cache-images] sharp failed for ${base}:`,
      (e as Error).message,
    );
    return { files };
  }
}

async function main() {
  const outDir = join(process.cwd(), "public", "house-images");
  await mkdir(outDir, { recursive: true });

  const entries = Object.values(HOUSE_TABLE);
  for (const h of entries) {
    const url = h.officialThumbUrl;
    if (!url) continue;
    const ext = extFromUrl(url);
    const base = safeHouseId(h.id);
    const originalPath = join(outDir, `${base}${ext}`);

    try {
      const buf = await download(url);
      // Save original (once)
      if (!(await exists(originalPath))) {
        await writeFile(originalPath, buf);
        console.error(`[cache-images] saved original ${originalPath}`);
      }
      // Always ensure variants/meta exist
      const metaPath = join(outDir, `${base}.meta.json`);
      if (!(await exists(metaPath))) {
        const { files, blurDataURL } = await generateVariants(
          buf,
          outDir,
          base,
        );
        const meta = { files, blurDataURL };
        await writeFile(metaPath, JSON.stringify(meta));
        console.error(`[cache-images] wrote meta ${metaPath}`);
      }
    } catch (e) {
      console.error(`[cache-images] failed ${url}:`, (e as Error).message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 0; // do not fail build
});

