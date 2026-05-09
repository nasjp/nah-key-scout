import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  annotateListingsWithFairness,
  computeFairBreakdown,
  DEFAULT_PRICING_CONFIG,
  HOUSE_TABLE,
} from "./nah-the-key";
import type { JoinedRow } from "./opensea-listings";

function rowFor(house: string): JoinedRow {
  return {
    orderHash: house,
    chain: "ethereum",
    contract: "0x",
    tokenId: house,
    priceEth: 1,
    sellerNetEth: 1,
    feesEth: 0,
    startTimeIso: "",
    endTimeIso: "",
    house,
    nights: 1,
    checkinJst: "2026-08-15",
    openseaAssetUrl: "",
  };
}

describe("annotateListingsWithFairness", () => {
  test("resolves listed house names to their specific house ids", () => {
    const annotated = annotateListingsWithFairness(
      [
        "CHILL AOSHIMA",
        "SURF AOSHIMA",
        "GARDEN AOSHIMA",
        "MASTERPIECE AOSHIMA",
        "MASTERPIECE NASU",
        "CAVE NASU",
        "THINK NASU",
        "IRORI KITA KARUIZAWA",
        "BASE L KITA KARUIZAWA",
        "BASE M KITA KARUIZAWA",
        "BASE S KITA KARUIZAWA",
        "TOJI MINAKAMI",
        "EARTH ISHIGAKI",
        "CLUB SUITE MIURA",
        "CLUB VILLA MIURA",
        "IRORI 2.0 KITA KARUIZAWA",
        "NATURE WITHIN KITAKARUIZAWA",
        "RUSUTSU",
        "THE NIGO HOUSE TOKYO",
        "SETOUCHI 180",
        "SETOUCHI 270",
        "SETOUCHI 360",
        "+SOUND FUKUOKA",
        "+CHEF FUKUOKA",
        "+DESK FUKUOKA",
      ].map(rowFor),
    );

    assert.deepEqual(
      annotated.map((row) => [row.house, row.houseId]),
      [
        ["CHILL AOSHIMA", "CHILL_AOSHIMA"],
        ["SURF AOSHIMA", "SURF_AOSHIMA"],
        ["GARDEN AOSHIMA", "GARDEN_AOSHIMA"],
        ["MASTERPIECE AOSHIMA", "AOSHIMA_EXCLUSIVE"],
        ["MASTERPIECE NASU", "MASTERPIECE_NASU"],
        ["CAVE NASU", "CAVE_NASU"],
        ["THINK NASU", "THINK_NASU"],
        ["IRORI KITA KARUIZAWA", "IRORI_KITA_KARUIZAWA"],
        ["BASE L KITA KARUIZAWA", "BASE_L_KITA_KARUIZAWA"],
        ["BASE M KITA KARUIZAWA", "BASE_M_KITA_KARUIZAWA"],
        ["BASE S KITA KARUIZAWA", "BASE_S_KITA_KARUIZAWA"],
        ["TOJI MINAKAMI", "TOJI_MINAKAMI"],
        ["EARTH ISHIGAKI", "EARTH_ISHIGAKI"],
        ["CLUB SUITE MIURA", "CLUB_SUITE_MIURA"],
        ["CLUB VILLA MIURA", "CLUB_VILLA_MIURA"],
        ["IRORI 2.0 KITA KARUIZAWA", "IRORI_2_KITA_KARUIZAWA"],
        ["NATURE WITHIN KITAKARUIZAWA", "NATURE_WITHIN_KITA_KARUIZAWA"],
        ["RUSUTSU", "RUSUTSU"],
        ["THE NIGO HOUSE TOKYO", "THE_NIGO_HOUSE_TOKYO"],
        ["SETOUCHI 180", "SETOUCHI_180"],
        ["SETOUCHI 270", "SETOUCHI_270"],
        ["SETOUCHI 360", "SETOUCHI_360"],
        ["+SOUND FUKUOKA", "SOUND_FUKUOKA"],
        ["+CHEF FUKUOKA", "+CHEF_FUKUOKA"],
        ["+DESK FUKUOKA", "+DESK_FUKUOKA"],
      ],
    );
  });
});

describe("pricing seed data", () => {
  test("matches current public baseline corrections", () => {
    assert.equal(HOUSE_TABLE.MASTERPIECE_NASU.baselinePerNightJpy, 600000);
    assert.equal(HOUSE_TABLE.AOSHIMA_EXCLUSIVE.capacity.max, 8);
    assert.equal(HOUSE_TABLE.CAVE_NASU.uncertainty, "Low");
  });

  test("contains seasonal factors for active THE KEY areas", () => {
    for (const area of [
      "NASU",
      "MIURA",
      "MINAKAMI",
      "SETOUCHI",
      "TOKYO",
      "RUSUTSU",
    ]) {
      assert.ok(
        DEFAULT_PRICING_CONFIG.monthFactor[area],
        `${area} should have month factors`,
      );
    }
  });

  test("contains current public lineup additions and excludes stale pages", () => {
    for (const id of [
      "IRORI_2_KITA_KARUIZAWA",
      "NATURE_WITHIN_KITA_KARUIZAWA",
      "RUSUTSU",
      "THE_NIGO_HOUSE_TOKYO",
      "SETOUCHI_180",
      "SETOUCHI_270",
      "SETOUCHI_360",
    ]) {
      assert.ok(HOUSE_TABLE[id], `${id} should be in HOUSE_TABLE`);
      assert.ok(
        HOUSE_TABLE[id].baselinePerNightJpy > 0,
        `${id} should have a positive baseline`,
      );
    }

    assert.equal(HOUSE_TABLE.BASE_FUKUOKA, undefined);
    assert.equal(HOUSE_TABLE.CLUB_SUITE_TOKYO, undefined);
  });
});

describe("computeFairBreakdown", () => {
  test("uses the JST check-in month independent of process timezone", () => {
    const fair = computeFairBreakdown(
      HOUSE_TABLE.BASE_L_KITA_KARUIZAWA,
      new Date("2026-05-01T00:00:00+09:00"),
      1,
      DEFAULT_PRICING_CONFIG,
    );

    assert.equal(fair.month.month, 5);
    assert.equal(fair.month.factor, 1.15);
  });
});
