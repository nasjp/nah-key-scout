import { OPENSEA_COLLECTION_SLUG } from "@nah/core/constants";
import { requireEnv } from "@nah/core/env";
import { getEthJpy } from "@nah/core/eth-jpy";
import {
  annotateListingsWithFairness,
  DEFAULT_PRICING_CONFIG,
  sortByDiscountDesc,
  summarizeDiagnostics,
} from "@nah/core/nah-the-key";
import { fetchOpenseaListingsJoined } from "@nah/core/opensea-listings";

async function main() {
  const apiKey = requireEnv("OPENSEA_API_KEY");
  const rows = await fetchOpenseaListingsJoined(
    OPENSEA_COLLECTION_SLUG,
    apiKey,
    "all",
  );
  const rate = await getEthJpy();
  const annotated = annotateListingsWithFairness(rows, {
    config: { ...DEFAULT_PRICING_CONFIG, ethJpy: rate.jpy },
  });

  console.log(
    `ETH/JPY: ${rate.jpy ?? "取得失敗"} (${rate.source})`,
    rate.failures.length > 0 ? JSON.stringify(rate.failures) : "",
  );
  console.log("diagnostics:", summarizeDiagnostics(annotated));

  for (const a of sortByDiscountDesc(annotated)) {
    console.log({
      house: a.house,
      houseId: a.houseId,
      status: a.status,
      checkin: a.checkinJst,
      checkinSource: a.checkinSource,
      nights: a.nights,
      daysUntil: a.daysUntilCheckin,
      fair: a.fairPerNightJpy,
      actual: a.actualPerNightJpy,
      discount: a.discountPct,
      lower: a.discountPctLower,
      uncertainty: a.uncertainty,
      label: a.label,
      maxBidEth: a.maxBidEth,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
