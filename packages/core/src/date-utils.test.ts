import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  addDays,
  dateIsoJst,
  daysUntilJst,
  parseCheckinDateJst,
} from "./date-utils";

describe("addDays", () => {
  test("advances exactly one JST day across a local DST transition", () => {
    // TZ=America/New_York では 2027-03-14 に DST が始まる。
    // setDate ベースの実装だと同じ JST 日付が 2 回出る。
    const start = parseCheckinDateJst("2027-03-13");
    assert.ok(start);
    const isos = [0, 1, 2].map((i) => dateIsoJst(addDays(start, i)));
    assert.deepEqual(isos, ["2027-03-13", "2027-03-14", "2027-03-15"]);
  });
});

describe("daysUntilJst", () => {
  test("counts whole JST days between today and a future check-in", () => {
    const now = new Date("2026-08-15T23:30:00+09:00");
    assert.equal(daysUntilJst("2026-08-18", now), 3);
  });

  test("returns 0 on the check-in day regardless of the time of day", () => {
    const now = new Date("2026-08-18T22:00:00+09:00");
    assert.equal(daysUntilJst("2026-08-18", now), 0);
  });

  test("returns a negative number once the check-in date has passed", () => {
    const now = new Date("2026-08-24T00:10:00+09:00");
    assert.equal(daysUntilJst("2026-08-23", now), -1);
  });
});
