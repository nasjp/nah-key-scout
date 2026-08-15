import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getEthJpy } from "./eth-jpy";

const NOW = new Date("2026-08-15T12:00:00+09:00");
const ok = (name: string, jpy: number) => ({
  name,
  fetch: async () => jpy,
});
const dead = (name: string) => ({
  name,
  fetch: async () => {
    throw new Error("boom");
  },
});

describe("getEthJpy", () => {
  test("最初に成功したプロバイダのレートと出所を返す", async () => {
    const r = await getEthJpy({
      providers: [ok("coinbase", 299235), ok("coingecko", 300000)],
      now: NOW,
    });
    assert.equal(r.jpy, 299235);
    assert.equal(r.source, "coinbase");
    assert.equal(r.fetchedAtIso, NOW.toISOString());
  });

  test("先頭が落ちたら次のプロバイダに切り替える", async () => {
    const r = await getEthJpy({
      providers: [dead("coinbase"), ok("coingecko", 300000)],
      now: NOW,
    });
    assert.equal(r.jpy, 300000);
    assert.equal(r.source, "coingecko");
  });

  test("全滅したら推測値で埋めず unavailable を返す", async () => {
    const r = await getEthJpy({
      providers: [dead("coinbase"), dead("coingecko")],
      now: NOW,
    });
    assert.equal(r.jpy, undefined);
    assert.equal(r.source, "unavailable");
  });

  test("明らかに壊れた値は採用しない", async () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 12, 1e12]) {
      const r = await getEthJpy({
        providers: [ok("coinbase", bad)],
        now: NOW,
      });
      assert.equal(r.jpy, undefined, `${bad} を採用してしまった`);
      assert.equal(r.source, "unavailable");
    }
  });
});
