// Display formatting helpers used across pages/components

export function formatJpy(n?: number): string {
  if (n == null) return "-";
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(n);
}

export function formatPct(n?: number): string {
  if (n == null) return "-";
  const s = n >= 0 ? `+${n}` : String(n);
  return `${s}%`;
}

export function formatEth(n?: number): string {
  if (n == null) return "-";
  return `${n.toFixed(4)} ETH`;
}

import { parseCheckinDateJst } from "./date-utils";

const WEEK_JP = ["日", "月", "火", "水", "木", "金", "土"] as const;

// Convert date string to JST formatted "YYYY-MM-DD(曜)" if possible.
export function formatCheckinJst(dateStr?: string): string {
  if (!dateStr) return "-";
  const d = parseCheckinDateJst(dateStr);
  if (!d) return dateStr;
  const j = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = j.getUTCFullYear();
  const mo = String(j.getUTCMonth() + 1).padStart(2, "0");
  const da = String(j.getUTCDate()).padStart(2, "0");
  const w = WEEK_JP[j.getUTCDay()];
  return `${y}-${mo}-${da}(${w})`;
}

// Compact JPY for large numbers, e.g. 3.142M
export function formatJpyCompactMillions(n: number): string {
  try {
    const m = n / 1_000_000;
    const s = m.toLocaleString("en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
    return `${s}M`;
  } catch {
    const m = Math.round((n / 1_000_000) * 1000) / 1000;
    return `${m.toFixed(3)}M`;
  }
}

export type JstNowParts = { full: string; hm: string };

export function jstNowParts(): JstNowParts {
  const now = new Date();
  const j = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = j.getUTCFullYear();
  const mo = String(j.getUTCMonth() + 1).padStart(2, "0");
  const da = String(j.getUTCDate()).padStart(2, "0");
  const hh = String(j.getUTCHours()).padStart(2, "0");
  const mm = String(j.getUTCMinutes()).padStart(2, "0");
  return { full: `${y}-${mo}-${da} ${hh}:${mm} JST`, hm: `${hh}:${mm}` };
}

