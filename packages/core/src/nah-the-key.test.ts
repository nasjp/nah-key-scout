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
        ["+CHEF FUKUOKA", "CHEF_FUKUOKA"],
        ["+DESK FUKUOKA", "DESK_FUKUOKA"],
      ],
    );
  });
});

describe("pricing seed data", () => {
  test("matches current public baseline corrections", () => {
    assert.equal(HOUSE_TABLE.MASTERPIECE_NASU.baselinePerNightJpy, 600000);
    assert.equal(HOUSE_TABLE.AOSHIMA_EXCLUSIVE.capacity.max, 8);
    assert.equal(HOUSE_TABLE.CAVE_NASU.uncertainty, "Low");
    assert.equal(HOUSE_TABLE.TOJI_MINAKAMI.baselinePerNightJpy, 400000);
    assert.equal(HOUSE_TABLE.TOJI_MINAKAMI.uncertainty, "Low");
    assert.match(HOUSE_TABLE.TOJI_MINAKAMI.baselineReason ?? "", /公式LP/);
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

  test("uses current FUKUOKA public floor as an area-level estimate", () => {
    const fukuokaIds = [
      "PENTHOUSE_FUKUOKA",
      "SOUND_FUKUOKA",
      "BAR_FUKUOKA",
      "CHEF_FUKUOKA",
      "DESK_FUKUOKA",
      "ATELIER_FUKUOKA",
      "RETREAT_FUKUOKA",
      "DOMA_FUKUOKA",
    ];

    for (const id of fukuokaIds) {
      const house = HOUSE_TABLE[id];
      assert.equal(house.area, "FUKUOKA", `${id} should be FUKUOKA`);
      assert.equal(house.capacity.max, 8, `${id} should allow up to 8 guests`);
      assert.ok(
        house.baselinePerNightJpy >= 120000,
        `${id} should not be below the public FUKUOKA floor`,
      );
      assert.notEqual(
        house.uncertainty,
        "Low",
        `${id} should not be Low without an individual public price`,
      );
    }

    for (const id of [
      "SOUND_FUKUOKA",
      "BAR_FUKUOKA",
      "CHEF_FUKUOKA",
      "DESK_FUKUOKA",
      "ATELIER_FUKUOKA",
      "RETREAT_FUKUOKA",
      "DOMA_FUKUOKA",
    ]) {
      assert.equal(HOUSE_TABLE[id].baselinePerNightJpy, 120000);
      assert.equal(HOUSE_TABLE[id].uncertainty, "Med");
      assert.match(HOUSE_TABLE[id].baselineReason ?? "", /FUKUOKA全体/);
    }

    assert.equal(HOUSE_TABLE.PENTHOUSE_FUKUOKA.baselinePerNightJpy, 180000);
    assert.equal(HOUSE_TABLE.PENTHOUSE_FUKUOKA.uncertainty, "Med");
  });

  test("uses canonical house ids for FUKUOKA plus houses", () => {
    for (const id of ["CHEF_FUKUOKA", "DESK_FUKUOKA", "ATELIER_FUKUOKA"]) {
      assert.equal(HOUSE_TABLE[id].id, id);
    }
  });

  test("matches current public MASU capacity", () => {
    assert.equal(HOUSE_TABLE.MASU_KITA_KARUIZAWA.capacity.max, 6);
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

  test("continues long-stay discount for four nights and longer", () => {
    const fair = computeFairBreakdown(
      HOUSE_TABLE.SOUND_FUKUOKA,
      new Date("2026-06-01T00:00:00+09:00"),
      4,
      DEFAULT_PRICING_CONFIG,
    );

    assert.equal(fair.longStay.factor, 0.9);
  });
});
