import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addDays, dateIsoJst, parseCheckinDateJst } from "./date-utils";
import { computeFairPerNightJpy } from "./nah-the-key";
import {
  DEFAULT_PRICING_CONFIG as CFG,
  HOUSE_TABLE,
  resolveSpecialDayFactor,
} from "./nah-the-key.seed";

describe("需要係数の正規化（baseline = 公表最安値 という定義を守る）", () => {
  test("どのエリアでも 月×曜日 の最小値がちょうど 1.0 になる", () => {
    for (const [area, months] of Object.entries(CFG.monthFactor)) {
      const minMonth = Math.min(...Object.values(months));
      const minDow = Math.min(...Object.values(CFG.dowFactor));
      assert.equal(
        Number((minMonth * minDow).toFixed(6)),
        1,
        `${area} の最小需要係数は 1.0 であるべき`,
      );
    }
  });

  test("曜日係数はすべて 1.0 以上で、最小がちょうど 1.0", () => {
    const values = Object.values(CFG.dowFactor);
    assert.ok(
      values.every((v) => v >= 1),
      "曜日係数が 1.0 を下回っている",
    );
    assert.equal(Math.min(...values), 1);
  });

  test("月係数はすべて 1.0 以上", () => {
    for (const [area, months] of Object.entries(CFG.monthFactor)) {
      for (const [m, v] of Object.entries(months)) {
        assert.ok(v >= 1, `${area}/${m}月 の係数 ${v} が 1.0 未満`);
      }
    }
  });

  test("正規化しても需要の相対的な形（順位）は変わらない", () => {
    // KITA_KARUIZAWA は 8月がピーク、1-2月が底
    const k = CFG.monthFactor.KITA_KARUIZAWA;
    assert.ok(k["8"] > k["7"], "8月 > 7月");
    assert.ok(k["1"] < k["4"], "1月 < 4月");
    assert.equal(Math.min(...Object.values(k)), 1);
    // 曜日は 土 > 金 > 水木 > 日 > 月火
    const d = CFG.dowFactor;
    assert.ok(d.Sat > d.Fri && d.Fri > d.Wed && d.Wed > d.Sun && d.Sun > d.Mon);
  });
});

describe("特異日係数", () => {
  test("平常日は 1.0（割増なし）", () => {
    assert.equal(resolveSpecialDayFactor("2027-02-02", CFG), 1);
  });

  test("年末年始・GW・お盆は必ず割増になる", () => {
    for (const iso of [
      "2026-12-31",
      "2027-01-02",
      "2027-05-03",
      "2027-08-14",
    ]) {
      assert.ok(
        resolveSpecialDayFactor(iso, CFG) > 1.2,
        `${iso} は特異日として割増されるべき`,
      );
    }
  });

  test("三連休の前夜（祝日の前日にあたる平日）は割増になる", () => {
    // 2027-01-11 は成人の日(月)。前夜の 1/10(日)ではなく、
    // 連休入りの 1/9(土) は曜日係数側で吸収されるため、ここでは 1/10 を見る
    assert.ok(resolveSpecialDayFactor("2027-01-10", CFG) > 1);
  });

  test("特異日係数は決して 1.0 を下回らない", () => {
    const start = parseCheckinDateJst("2026-01-01");
    assert.ok(start);
    for (let i = 0; i < 365 * 3; i++) {
      const iso = dateIsoJst(addDays(start, i));
      assert.ok(
        resolveSpecialDayFactor(iso, CFG) >= 1,
        `${iso} の特異日係数が 1.0 未満`,
      );
    }
  });
});

describe("連泊係数", () => {
  test("1泊は 1.0、泊数が増えても単調に減る", () => {
    assert.equal(CFG.longStayFactor["1"], 1);
    const keys = Object.keys(CFG.longStayFactor)
      .map(Number)
      .sort((a, b) => a - b);
    for (let i = 1; i < keys.length; i++) {
      const prev = CFG.longStayFactor[String(keys[i - 1])];
      const cur = CFG.longStayFactor[String(keys[i])];
      assert.ok(cur <= prev, `${keys[i]}泊の係数が ${keys[i - 1]}泊より大きい`);
    }
  });
});

describe("computeFairPerNightJpy の下限", () => {
  test("年内で最も安い平常日の1泊は baseline ちょうどになる", () => {
    // 2027-02-01(月) は KITA_KARUIZAWA の最閑月かつ最安曜日、祝日でもない
    const house = HOUSE_TABLE.BASE_L_KITA_KARUIZAWA;
    const d = parseCheckinDateJst("2027-02-01");
    assert.ok(d);
    assert.equal(
      computeFairPerNightJpy(house, d, 1),
      house.baselinePerNightJpy,
    );
  });

  test("どのハウス・どの日でも 1泊の公正価格が baseline を下回らない", () => {
    const start = parseCheckinDateJst("2026-01-01");
    assert.ok(start);
    for (const house of Object.values(HOUSE_TABLE)) {
      for (let i = 0; i < 365; i++) {
        const d = addDays(start, i);
        const fair = computeFairPerNightJpy(house, d, 1);
        assert.ok(
          fair >= house.baselinePerNightJpy,
          `${house.id} ${dateIsoJst(d)}: ${fair} < ${house.baselinePerNightJpy}`,
        );
      }
    }
  });

  test("ピーク日は baseline の 1.8 倍以上まで伸びる（旧モデルは 1.69 倍で頭打ちだった）", () => {
    const house = HOUSE_TABLE.BASE_L_KITA_KARUIZAWA;
    const start = parseCheckinDateJst("2026-01-01");
    assert.ok(start);
    let max = 0;
    for (let i = 0; i < 365; i++) {
      max = Math.max(max, computeFairPerNightJpy(house, addDays(start, i), 1));
    }
    assert.ok(
      max / house.baselinePerNightJpy >= 1.8,
      `ピーク倍率 ${(max / house.baselinePerNightJpy).toFixed(2)} が小さすぎる`,
    );
  });
});

describe("公正価格の純粋性", () => {
  test("同じ入力なら実行時刻に依存せず同じ値を返す", () => {
    const house = HOUSE_TABLE.SOUND_FUKUOKA;
    const d = parseCheckinDateJst("2027-03-10");
    assert.ok(d);
    const a = computeFairPerNightJpy(house, d, 2);
    const b = computeFairPerNightJpy(house, d, 2);
    assert.equal(a, b);
    // リードタイムは公正価格から外れたので、遠い未来でも近い将来でも式は同じ
    assert.equal(
      computeFairPerNightJpy(house, d, 2, CFG),
      computeFairPerNightJpy(house, d, 2),
    );
  });
});

describe("月係数は夜ごとに適用される", () => {
  test("月をまたぐ滞在は初日の月だけで決まらない", () => {
    const house = HOUSE_TABLE.IRORI_KITA_KARUIZAWA;
    // 2026-07-30 から 4泊 = 7/30,7/31,8/1,8/2（7月係数と8月係数が混ざる）
    const d = parseCheckinDateJst("2026-07-30");
    assert.ok(d);
    const crossing = computeFairPerNightJpy(house, d, 4);
    // 同じ曜日構成で 7月内に収まる 4泊（7/23 木〜）と比べて高くなるはず
    const july = parseCheckinDateJst("2026-07-23");
    assert.ok(july);
    const inJuly = computeFairPerNightJpy(house, july, 4);
    assert.ok(
      crossing > inJuly,
      `月跨ぎ ${crossing} が 7月内 ${inJuly} 以下（8月係数が効いていない）`,
    );
  });
});
