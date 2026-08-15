// Small date helpers for JST handling

const TZ_JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 86400000;

export function parseCheckinDateJst(str: string | undefined): Date | undefined {
  if (!str) return undefined;
  const s1 = str.trim();
  const s2 = s1.replaceAll("/", "-");
  const m = s2.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [_, y, mo, d] = m;
    const isoJst = `${y}-${mo}-${d}T00:00:00+09:00`;
    const dj = new Date(isoJst);
    if (!Number.isNaN(dj.getTime())) return dj;
  }
  const d1 = new Date(s1);
  if (!Number.isNaN(d1.getTime())) return d1;
  const d2 = new Date(s2);
  if (!Number.isNaN(d2.getTime())) return d2;
  return undefined;
}

/**
 * JST 基準で n 日進める。
 * `Date#setDate` はローカル時刻で動くため、実行環境が夏時間を持つ TZ だと
 * 1 時間ずれて JST の日付が重複・欠落する。UTC ミリ秒での加算に統一する。
 */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export function getJstDowIndex(d: Date): number {
  const jstMs = d.getTime() + TZ_JST_OFFSET_MS;
  const j = new Date(jstMs);
  return j.getUTCDay();
}

export function getJstMonthIndex(d: Date): number {
  const jstMs = d.getTime() + TZ_JST_OFFSET_MS;
  const j = new Date(jstMs);
  return j.getUTCMonth();
}

export function dateIsoJst(d: Date): string {
  const jst = new Date(d.getTime() + TZ_JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const da = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

/** その瞬間を含む JST の暦日 0:00 に切り下げた UTC ミリ秒 */
function jstMidnightMs(d: Date): number {
  const shifted = d.getTime() + TZ_JST_OFFSET_MS;
  return Math.floor(shifted / DAY_MS) * DAY_MS - TZ_JST_OFFSET_MS;
}

/**
 * JST の暦日単位で「今日からチェックインまで何日か」を返す。
 * チェックイン日当日は 0、過ぎていれば負の値になる（失効判定に使う）。
 */
export function daysUntilJst(
  checkin: string | Date | undefined,
  now: Date,
): number | undefined {
  const d =
    typeof checkin === "string" ? parseCheckinDateJst(checkin) : checkin;
  if (!d) return undefined;
  return Math.round((jstMidnightMs(d) - jstMidnightMs(now)) / DAY_MS);
}
