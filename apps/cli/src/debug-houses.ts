import { stat } from "node:fs/promises";
import { join } from "node:path";

import { OPENSEA_COLLECTION_SLUG } from "@nah/core/constants";
import { requireEnv } from "@nah/core/env";
import { safeHouseId } from "@nah/core/image-cache";
import {
  type AnnotatedListing,
  annotateListingsWithFairness,
  computeFairPerNightJpy,
  DEFAULT_PRICING_CONFIG,
  HOUSE_TABLE,
} from "@nah/core/nah-the-key";
import {
  fetchOpenseaListingsJoined,
  type JoinedRow,
} from "@nah/core/opensea-listings";

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function offlineChecks() {
  const targets = ["+CHEF FUKUOKA", "+ATELIER FUKUOKA"] as const;
  const results: Array<Record<string, unknown>> = [];
  for (const label of targets) {
    // HOUSE_TABLE存在確認（シードのキーは先頭の+を含まない）
    const houseKey = label
      .replace(/\+/g, "")
      .replace(/\s+/g, "_")
      .toUpperCase() as keyof typeof HOUSE_TABLE;
    const inSeed = Object.hasOwn(HOUSE_TABLE, houseKey);
    const houseId = label.replace(/\s+/g, "_").toUpperCase();
    const safeId = safeHouseId(label.replace(/\s+/g, "_").toUpperCase());
    const metaPath = join(
      process.cwd(),
      "..",
      "web",
      "public",
      "house-images",
      `${safeId}.meta.json`,
    );
    const hasImageMeta = await exists(metaPath);

    // 公正価格のオフライン計算（シードがある場合のみ）
    let fairSample: number | undefined;
    if (inSeed) {
      const h = HOUSE_TABLE[houseKey];
      const today = new Date();
      const sample = new Date(today.getTime() + 60 * 24 * 3600 * 1000); // +60日
      fairSample = computeFairPerNightJpy(h, sample, 1, DEFAULT_PRICING_CONFIG);
    }
    results.push({
      label,
      houseId,
      inSeed,
      hasImageMeta,
      fairSample,
      metaPath,
    });
  }
  return results;
}

async function syntheticAnnotateCheck() {
  const samples: JoinedRow[] = [
    {
      orderHash: "0xsample1",
      chain: "ethereum",
      contract: "0xdeadbeef",
      tokenId: "1",
      priceEth: 1.0,
      sellerNetEth: 0.9,
      feesEth: 0.1,
      startTimeIso: new Date().toISOString(),
      endTimeIso: new Date(Date.now() + 3600_000).toISOString(),
      house: "+ATELIER FUKUOKA",
      place: "FUKUOKA",
      nights: 1,
      checkinJst: "2025-10-10",
      openseaAssetUrl: "https://example.com/asset/1",
    },
    {
      orderHash: "0xsample2",
      chain: "ethereum",
      contract: "0xdeadbeef",
      tokenId: "2",
      priceEth: 1.0,
      sellerNetEth: 0.9,
      feesEth: 0.1,
      startTimeIso: new Date().toISOString(),
      endTimeIso: new Date(Date.now() + 3600_000).toISOString(),
      house: "+CHEF FUKUOKA",
      place: "FUKUOKA",
      nights: 1,
      checkinJst: "2025-10-10",
      openseaAssetUrl: "https://example.com/asset/2",
    },
  ];
  const annotated = annotateListingsWithFairness(samples);
  return annotated.map((a) => ({
    house: a.house,
    resolvedHouseId: a.houseId,
    inSeed: a.houseId
      ? Object.hasOwn(HOUSE_TABLE, a.houseId.replace(/^\+/, ""))
      : false,
    fairPerNightJpy: a.fairPerNightJpy ?? null,
  }));
}

async function onlineChecks() {
  const apiKey = requireEnv("OPENSEA_API_KEY");
  const rows: JoinedRow[] = await fetchOpenseaListingsJoined(
    OPENSEA_COLLECTION_SLUG,
    apiKey,
    "all",
  );
  const filtered = rows.filter(
    (r) =>
      (r.house || "").toUpperCase().includes("CHEF") ||
      (r.house || "").toUpperCase().includes("ATELIER"),
  );
  const annotated: AnnotatedListing[] = annotateListingsWithFairness(filtered);
  return annotated.map((a) => ({
    house: a.house,
    houseId: a.houseId,
    place: a.place,
    nights: a.nights,
    checkinJst: a.checkinJst,
    fairPerNightJpy: a.fairPerNightJpy,
    actualPerNightJpy: a.actualPerNightJpy,
    label: a.label,
    officialThumbUrl: a.officialThumbUrl,
  }));
}

async function main() {
  const args = process.argv.slice(2);
  const doFetch = args.includes("--fetch");

  console.error("[debug-houses] offline checks: seeds & images");
  const offline = await offlineChecks();
  for (const r of offline) console.log(JSON.stringify(r));

  console.error("[debug-houses] synthetic annotate check (+-ID mismatch)");
  const synth = await syntheticAnnotateCheck();
  for (const r of synth) console.log(JSON.stringify(r));

  if (doFetch) {
    console.error("[debug-houses] online checks: OpenSea + fairness");
    const online = await onlineChecks();
    for (const r of online) console.log(JSON.stringify(r));
  } else {
    console.error("[debug-houses] skip online checks (pass --fetch to enable)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
