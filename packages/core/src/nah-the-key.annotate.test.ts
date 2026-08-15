import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  annotateListingsWithFairness,
  checkinIsoFromTokenId,
  computeActualPerNightJpy,
  computeMaxBidEth,
  DEFAULT_PRICING_CONFIG,
  resolveHouseId,
  sortByDiscountDesc,
  summarizeDiagnostics,
} from "./nah-the-key";
import type { JoinedRow } from "./opensea-listings";

const NOW = new Date("2026-08-15T12:00:00+09:00");
const RATE = 300000;
const CFG = { ...DEFAULT_PRICING_CONFIG, ethJpy: RATE };

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

const annotate = (r: JoinedRow) =>
  annotateListingsWithFairness([r], { config: CFG, now: NOW })[0];

describe("失効したキーの扱い", () => {
  test("チェックイン日を過ぎたリスティングは expired になり割安度を出さない", () => {
    const a = annotate(row({ checkinJst: "2026-08-14" }));
    assert.equal(a.status, "expired");
    assert.equal(a.discountPct, undefined);
    assert.equal(a.label, undefined);
    assert.equal(a.daysUntilCheckin, -1);
  });

  test("チェックイン当日はまだ有効", () => {
    const a = annotate(row({ checkinJst: "2026-08-15" }));
    assert.equal(a.status, "ok");
    assert.equal(a.daysUntilCheckin, 0);
    assert.ok(a.discountPct !== undefined);
  });

  test("失効キーは割安度順の先頭に来ない", () => {
    const rows = [
      row({ orderHash: "past", checkinJst: "2026-08-01", priceEth: 0.01 }),
      row({ orderHash: "future", checkinJst: "2026-10-27", priceEth: 0.2 }),
    ];
    const sorted = sortByDiscountDesc(
      annotateListingsWithFairness(rows, { config: CFG, now: NOW }),
    );
    assert.equal(sorted[0].orderHash, "future");
  });
});

describe("入力欠落を推測で埋めない", () => {
  test("泊数トレイトが無ければ 1泊とみなさず判定不能にする", () => {
    const a = annotate(row({ nights: undefined }));
    assert.equal(a.status, "unknown-nights");
    assert.equal(a.actualPerNightJpy, undefined);
    assert.equal(a.fairPerNightJpy, undefined);
    assert.equal(a.discountPct, undefined);
  });

  test("チェックイン日が取れなければ判定不能にする", () => {
    const a = annotate(row({ checkinJst: undefined, tokenId: "x" }));
    assert.equal(a.status, "unknown-checkin");
    assert.equal(a.discountPct, undefined);
  });

  test("ハウスが特定できなければ判定不能にする", () => {
    const a = annotate(row({ house: "+BASE FUKUOKA" }));
    assert.equal(a.status, "unknown-house");
    assert.equal(a.houseId, undefined);
    assert.equal(a.discountPct, undefined);
  });

  test("判定不能の内訳を集計できる", () => {
    const rows = [
      row({ orderHash: "a" }),
      row({ orderHash: "b", nights: undefined }),
      row({ orderHash: "c", house: "+BASE FUKUOKA" }),
      row({ orderHash: "d", checkinJst: "2026-08-01" }),
    ];
    const d = summarizeDiagnostics(
      annotateListingsWithFairness(rows, { config: CFG, now: NOW }),
    );
    assert.equal(d.ok, 1);
    assert.equal(d.unknownNights, 1);
    assert.equal(d.unknownHouse, 1);
    assert.equal(d.expired, 1);
    assert.equal(d.total, 4);
  });
});

describe("ETH/JPY レートが取れないとき", () => {
  test("推測レートで実効単価を作らない", () => {
    const a = annotateListingsWithFairness([row()], {
      config: DEFAULT_PRICING_CONFIG,
      now: NOW,
    })[0];
    assert.equal(a.status, "no-rate");
    assert.equal(a.actualPerNightJpy, undefined);
    assert.equal(a.discountPct, undefined);
    assert.ok(a.fairPerNightJpy !== undefined, "公正価格自体はレート非依存");
  });

  test("computeActualPerNightJpy は priceEth が 0 なら undefined", () => {
    assert.equal(computeActualPerNightJpy(0, 1, CFG), undefined);
    assert.equal(computeActualPerNightJpy(0.2, 0, CFG), undefined);
    assert.equal(
      computeActualPerNightJpy(0.2, 1, DEFAULT_PRICING_CONFIG),
      undefined,
    );
    assert.equal(computeActualPerNightJpy(0.2, 1, CFG), 60000);
  });
});

describe("baseline の不確実性を割安度に反映する", () => {
  test("uncertainty と根拠がリスティングまで伝わる", () => {
    const a = annotate(row());
    assert.equal(a.uncertainty, "Low");
    assert.match(a.baselineReason ?? "", /./);
  });

  test("推定 baseline ほど割安度の誤差幅が広い", () => {
    const low = annotate(row({ house: "GARDEN AOSHIMA" }));
    const high = annotate(
      row({ house: "SETOUCHI 360", priceEth: 2, checkinJst: "2026-10-27" }),
    );
    assert.ok(low.discountMarginPct !== undefined);
    assert.ok(high.discountMarginPct !== undefined);
    assert.ok(
      (high.discountMarginPct ?? 0) > (low.discountMarginPct ?? 0),
      "High の誤差幅が Low 以下になっている",
    );
  });

  test("ラベルは点推定ではなく保守側（下限）で決まる", () => {
    const a = annotate(row({ house: "SETOUCHI 360", priceEth: 2 }));
    assert.ok(a.discountPctLower !== undefined);
    assert.ok(
      (a.discountPctLower ?? 0) < (a.discountPct ?? 0),
      "下限が点推定より小さくない",
    );
  });

  test("点推定が同じなら不確実性の低いハウスが上位に来る", () => {
    // 公正価格が同じ 2 件を作り、baseline の確度だけを変える
    const houses = {
      SURE: {
        id: "SURE",
        displayName: "SURE",
        area: "AOSHIMA",
        capacity: { standard: null, max: null, coSleepingMax: null },
        baselinePerNightJpy: 300000,
        uncertainty: "Low" as const,
        officialUrl: "",
      },
      GUESS: {
        id: "GUESS",
        displayName: "GUESS",
        area: "AOSHIMA",
        capacity: { standard: null, max: null, coSleepingMax: null },
        baselinePerNightJpy: 300000,
        uncertainty: "High" as const,
        officialUrl: "",
      },
    };
    const rows = [
      row({ orderHash: "guess", house: "GUESS AOSHIMA" }),
      row({ orderHash: "sure", house: "SURE AOSHIMA" }),
    ];
    const ann = annotateListingsWithFairness(rows, {
      config: CFG,
      houses,
      now: NOW,
    });
    assert.deepEqual(
      ann.map((a) => a.houseId),
      ["GUESS", "SURE"],
      "テスト用ハウスが解決できていない",
    );
    assert.equal(ann[0].discountPct, ann[1].discountPct);
    assert.equal(sortByDiscountDesc(ann)[0].orderHash, "sure");
  });
});

describe("上限入札", () => {
  test("チェックインが近いほど厳しい上限になる", () => {
    const far = computeMaxBidEth(100000, 1, 0.25, CFG, 90);
    const near = computeMaxBidEth(100000, 1, 0.25, CFG, 3);
    assert.ok(far !== undefined && near !== undefined);
    assert.ok((near as number) < (far as number));
    assert.equal(far, Math.round(((100000 * 0.75) / RATE) * 1e6) / 1e6);
    // 3日前は +20pt の安全マージンが乗る
    assert.equal(near, Math.round(((100000 * 0.55) / RATE) * 1e6) / 1e6);
  });

  test("レート未取得なら上限入札も出さない", () => {
    assert.equal(
      computeMaxBidEth(100000, 1, 0.25, DEFAULT_PRICING_CONFIG, 90),
      undefined,
    );
  });

  test("annotate の結果に上限入札が載る", () => {
    const a = annotate(row());
    assert.ok(a.maxBidEth !== undefined);
    assert.equal(a.targetDiscountRate, 0.25);
  });
});

describe("ハウス名寄せはエリアまで一致させる", () => {
  test("エリアが違えば同名でも解決しない", () => {
    assert.equal(resolveHouseId("CLUB SUITE TOKYO"), undefined);
    assert.equal(resolveHouseId("GARDEN NASU"), undefined);
    assert.equal(resolveHouseId("BAR AOSHIMA"), undefined);
    assert.equal(resolveHouseId("MASU AOSHIMA"), undefined);
    assert.equal(resolveHouseId("EARTH AOSHIMA"), undefined);
    assert.equal(resolveHouseId("THINK TOKYO"), undefined);
    assert.equal(resolveHouseId("CHILL FUKUOKA"), undefined);
    assert.equal(resolveHouseId("BASE S FUKUOKA"), undefined);
  });

  test("エリア表記が無い場合は一意に決まるときだけ解決する", () => {
    assert.equal(resolveHouseId("CHEF"), "CHEF_FUKUOKA");
    assert.equal(resolveHouseId("+CHEF"), "CHEF_FUKUOKA");
    assert.equal(resolveHouseId("MASTERPIECE"), undefined); // NASU と AOSHIMA に存在
  });

  test("知らない名前は静かに他ハウスへ寄せず undefined を返す", () => {
    assert.equal(resolveHouseId("+POOL FUKUOKA"), undefined);
    assert.equal(resolveHouseId("SETOUCHI 90"), undefined);
    assert.equal(resolveHouseId(""), undefined);
    assert.equal(resolveHouseId(undefined), undefined);
  });
});

describe("tokenId に埋まっているチェックイン日", () => {
  // 実データの tokenId は 17 桁（例: 26102700000010100 = 2026-10-27 + 11桁の連番）。
  // 先頭 6 桁が YYMMDD である点は取得できた全件で一致している。
  const REAL: Array<[string, string]> = [
    ["26102700000010100", "2026-10-27"],
    ["26082300000010100", "2026-08-23"],
    ["26081800000020100", "2026-08-18"],
    ["26110600000010100", "2026-11-06"],
    ["26091100000010100", "2026-09-11"],
    ["26091400000020300", "2026-09-14"],
  ];

  test("実データの tokenId からチェックイン日を復元できる", () => {
    for (const [tokenId, expected] of REAL) {
      assert.equal(
        checkinIsoFromTokenId(tokenId),
        expected,
        `${tokenId} (${tokenId.length}桁) を復元できない`,
      );
    }
  });

  test("桁数が違っても先頭 6 桁が日付なら復元する", () => {
    assert.equal(checkinIsoFromTokenId("261027"), "2026-10-27");
    assert.equal(checkinIsoFromTokenId("261027000000"), "2026-10-27");
    assert.equal(checkinIsoFromTokenId("26102700000010100"), "2026-10-27");
  });

  test("トレイトが無くても tokenId から復元する", () => {
    const a = annotate(
      row({ checkinJst: undefined, tokenId: "26102700000010100" }),
    );
    assert.equal(a.status, "ok");
    assert.equal(a.checkinJst, "2026-10-27");
    assert.equal(a.checkinSource, "tokenId");
  });

  test("トレイトと食い違ったらトレイトを優先しつつ印を付ける", () => {
    const a = annotate(
      row({ checkinJst: "2026-10-27", tokenId: "26010100000010100" }),
    );
    assert.equal(a.checkinJst, "2026-10-27");
    assert.equal(a.checkinMismatch, true);
  });

  test("日付として解釈できない tokenId は無視する", () => {
    for (const bad of [
      "99999900000010100", // 99月99日
      "26023100000010100", // 2月31日
      "26000100000010100", // 0月
      "12345", // 6桁未満
      "0x1234", // 数字以外
      "",
    ]) {
      const a = annotate(row({ checkinJst: undefined, tokenId: bad }));
      assert.equal(
        a.status,
        "unknown-checkin",
        `${JSON.stringify(bad)} を日付として解釈してしまった`,
      );
    }
  });

  test("想定外の年（2020-2039 の外）は採用しない", () => {
    assert.equal(checkinIsoFromTokenId("19102700000010100"), undefined);
    assert.equal(checkinIsoFromTokenId("99102700000010100"), undefined);
  });
});
