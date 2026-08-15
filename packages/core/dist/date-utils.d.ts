export declare function parseCheckinDateJst(
  str: string | undefined,
): Date | undefined;
/**
 * JST 基準で n 日進める。
 * `Date#setDate` はローカル時刻で動くため、実行環境が夏時間を持つ TZ だと
 * 1 時間ずれて JST の日付が重複・欠落する。UTC ミリ秒での加算に統一する。
 */
export declare function addDays(d: Date, n: number): Date;
export declare function getJstDowIndex(d: Date): number;
export declare function getJstMonthIndex(d: Date): number;
export declare function dateIsoJst(d: Date): string;
/**
 * JST の暦日単位で「今日からチェックインまで何日か」を返す。
 * チェックイン日当日は 0、過ぎていれば負の値になる（失効判定に使う）。
 */
export declare function daysUntilJst(
  checkin: string | Date | undefined,
  now: Date,
): number | undefined;
