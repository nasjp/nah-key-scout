import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { EthJpyResult } from "./eth-jpy";
import type { JoinedRow } from "./opensea-listings";
import { composeHomeViewModel } from "./view-models";

const NOW = new Date("2026-08-15T12:00:00+09:00");
const RATE: EthJpyResult = {
  jpy: 300000,
  source: "coinbase",
  fetchedAtIso: NOW.toISOString(),
  failures: [],
};
const NO_RATE: EthJpyResult = {
  source: "unavailable",
  fetchedAtIso: NOW.toISOString(),
  failures: [{ name: "coinbase", reason: "HTTP 500" }],
};

function row(over: Partial<JoinedRow> = {}): JoinedRow {
  return {
    orderHash: "0xhash",
    chain: "ethereum",
    contract: "0xf3f8257fbcfdeff9354b6a0e1a948f7a5ff135a2",
    tokenId: "261027000000",
    priceEth: 0.2,
    sellerNetEth: 0.198,
    feesEth: 0.002,
    startTimeIso: "",
    endTimeIso: "",
    house: "GARDEN AOSHIMA",
    nights: 1,
    checkinJst: "2026-10-27",
    openseaAssetUrl: "",
    ...over,
  };
}

describe("composeHomeViewModel", () => {
  test("失効・判定不能のリスティングはカードに出さない", () => {
    const vm = composeHomeViewModel(
      [
        row({ orderHash: "ok", tokenId: "261027000000" }),
        row({
          orderHash: "expired",
          tokenId: "260801000000",
          checkinJst: "2026-08-01",
        }),
        row({
          orderHash: "nohouse",
          tokenId: "261028000000",
          checkinJst: "2026-10-28",
          house: "+BASE FUKUOKA",
        }),
      ],
      RATE,
      { now: NOW },
    );

    assert.deepEqual(
      vm.items.map((i) => i.item.orderHash),
      ["ok"],
    );
    assert.equal(vm.diagnostics.expired, 1);
    assert.equal(vm.diagnostics.unknownHouse, 1);
    assert.deepEqual(vm.diagnostics.unresolvedHouseNames, ["+BASE FUKUOKA"]);
    assert.equal(vm.totalListings, 3);
  });

  test("レートが取れないときは割安度を出さずに警告を返す", () => {
    const vm = composeHomeViewModel([row()], NO_RATE, { now: NOW });
    assert.equal(vm.rate.source, "unavailable");
    assert.equal(vm.rate.jpy, undefined);
    assert.equal(vm.items.length, 1, "公正価格だけでも一覧には出す");
    assert.equal(vm.items[0].display.discountPct, undefined);
    assert.equal(vm.items[0].display.fairJpyPerNight !== undefined, true);
    assert.equal(vm.diagnostics.noRate, 1);
  });

  test("使用したレートと出所を持ち出す", () => {
    const vm = composeHomeViewModel([row()], RATE, { now: NOW });
    assert.equal(vm.rate.jpy, 300000);
    assert.equal(vm.rate.source, "coinbase");
  });

  test("同一トークンでは最も安いリスティングだけを残す", () => {
    const vm = composeHomeViewModel(
      [
        row({ orderHash: "cheap", priceEth: 0.2 }),
        row({ orderHash: "pricey", priceEth: 0.5 }),
      ],
      RATE,
      { now: NOW },
    );
    assert.equal(vm.items.length, 1);
    assert.equal(vm.items[0].item.orderHash, "cheap");
    assert.equal(vm.items[0].item.listingsCount, 2);
  });

  test("不確実性と誤差幅をカードに載せる", () => {
    const vm = composeHomeViewModel([row()], RATE, { now: NOW });
    const d = vm.items[0].display;
    assert.equal(d.uncertainty, "Low");
    assert.match(d.discountPct ?? "", /^[+-]\d+%$/);
    assert.match(d.discountRange ?? "", /±/);
  });

  test("limit を超える件数は切り詰めるが、総数と診断は全件ぶん返す", () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      row({
        orderHash: `o${i}`,
        tokenId: `26102${i}000000`,
        checkinJst: `2026-10-2${i}`,
      }),
    );
    const vm = composeHomeViewModel(rows, RATE, { now: NOW, limit: 2 });
    assert.equal(vm.items.length, 2);
    assert.equal(vm.totalListings, 5);
    assert.equal(vm.diagnostics.total, 5);
  });
});
