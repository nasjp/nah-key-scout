import { OPENSEA_COLLECTION_SLUG } from "@nah/core/constants";
import { requireEnv } from "@nah/core/env";
import { annotateListingsWithFairness } from "@nah/core/nah-the-key";
import { fetchOpenseaListingsJoined } from "@nah/core/opensea-listings";

async function main() {
  const apiKey = requireEnv("OPENSEA_API_KEY");
  const rows = await fetchOpenseaListingsJoined(
    OPENSEA_COLLECTION_SLUG,
    apiKey,
    "best",
  );
  const annotated = annotateListingsWithFairness(rows);
  for (const a of annotated) {
    console.log({
      house: a.house,
      houseId: a.houseId,
      area: a.area,
      fair: a.fairPerNightJpy,
      img: a.officialThumbUrl,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
