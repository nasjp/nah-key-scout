// Small date helpers for JST handling

const TZ_JST_OFFSET_MS = 9 * 60 * 60 * 1000;

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

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function getJstDowIndex(d: Date): number {
  const jstMs = d.getTime() + TZ_JST_OFFSET_MS;
  const j = new Date(jstMs);
  return j.getUTCDay();
}

export function dateIsoJst(d: Date): string {
  const jst = new Date(d.getTime() + TZ_JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const da = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

