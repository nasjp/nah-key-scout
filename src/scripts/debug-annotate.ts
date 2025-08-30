import { annotateListingsWithFairness } from "../lib/nah-the-key";
import { fetchOpenseaListingsJoined } from "../lib/opensea-listings";

function resolveApiKey(): string {
  const v = process.env.OPENSEA_API_KEY;
  if (!v) throw new Error("Missing env: OPENSEA_API_KEY");
  return v;
}

async function main() {
  const apiKey = resolveApiKey();
  const rows = await fetchOpenseaListingsJoined("the-key-nah", apiKey, "best");
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
