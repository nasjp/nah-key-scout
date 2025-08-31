import { OPENSEA_COLLECTION_SLUG } from "@nah/core/constants";
import { requireEnv } from "@nah/core/env";
import {
  fetchOpenseaListingsJoined,
  type JoinedRow,
  type Mode,
} from "@nah/core/opensea-listings";

async function main(): Promise<void> {
  const apiKey = requireEnv("OPENSEA_API_KEY");

  // CLI引数
  const args = process.argv.slice(2);
  const slugArgIdx = args.indexOf("--slug");
  const modeIdx = args.indexOf("--mode");
  const slug = slugArgIdx >= 0 ? args[slugArgIdx + 1] : OPENSEA_COLLECTION_SLUG;
  const mode: Mode = modeIdx >= 0 ? (args[modeIdx + 1] as Mode) : "all";

  console.error(`[info] fetching listings: slug=${slug}, mode=${mode}`);
  const joined: JoinedRow[] = await fetchOpenseaListingsJoined(
    slug,
    apiKey,
    mode,
  );
  console.error(`[info] joined rows: ${joined.length}`);

  // 出力：NDJSON（1行1JSON）
  for (const row of joined) {
    console.log(JSON.stringify(row));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
