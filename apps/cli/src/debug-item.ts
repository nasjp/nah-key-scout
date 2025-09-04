import { OPENSEA_COLLECTION_SLUG, THE_KEY_CONTRACT } from "@nah/core/constants";
import { requireEnv } from "@nah/core/env";
import {
  annotateListingsWithFairness,
  DEFAULT_PRICING_CONFIG,
  HOUSE_TABLE,
  parseCheckinDateJst,
  selectBestPerToken,
} from "@nah/core/nah-the-key";
import { fetchOpenseaListingsJoined } from "@nah/core/opensea-listings";
import { buildItemViewModel } from "@nah/core/view-models";

async function main() {
  const apiKey = requireEnv("OPENSEA_API_KEY");
  const tokenId = process.argv[2];
  if (!tokenId) {
    console.error("Usage: tsx src/debug-item.ts <tokenId>");
    process.exit(1);
  }
  const vm = await buildItemViewModel(apiKey, tokenId);
  // Deeper debug: reproduce internals
  const rows = await fetchOpenseaListingsJoined(
    OPENSEA_COLLECTION_SLUG,
    apiKey,
    "all",
  );
  const inToken = rows.filter(
    (r) =>
      r.contract.toLowerCase() === THE_KEY_CONTRACT && r.tokenId === tokenId,
  );
  const annotated = annotateListingsWithFairness(inToken, {
    config: { ...DEFAULT_PRICING_CONFIG },
  });
  const best =
    annotated.length > 0 ? selectBestPerToken(annotated)[0] : undefined;
  const d = best?.checkinJst ? parseCheckinDateJst(best.checkinJst) : undefined;
  const house = best?.houseId ? HOUSE_TABLE[best.houseId] : undefined;
  console.log(
    JSON.stringify(
      {
        header: vm.header,
        pricing: vm.pricing,
        debug: {
          best: {
            nights: best?.nights,
            checkinJst: best?.checkinJst,
            house: best?.house,
            houseId: best?.houseId,
          },
          parsed: {
            hasHouse: !!house,
            hasDate: !!d,
          },
        },
        otherCount: vm.otherListings.length,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
