// Shared types for THE KEY price logic and seed data

export type Area = string;

export type HouseId = string;

export type Capacity = {
  standard: number | null; // 標準宿泊人数（未公表はnull）
  max: number | null; // 最大宿泊人数（未公表はnull）
  coSleepingMax: number | null; // 添い寝可能人数（未公表はnull）
};

export type HouseInfo = {
  id: HouseId;
  displayName: string;
  area: Area;
  capacity: Capacity;
  /** 公式予約ページの「￥xxx~/1 night」を基準に置くベースライン（変動制につき目安） */
  baselinePerNightJpy: number; // 平日ベースの基準価格
  /** baseline算出の根拠（公式/媒体/推定のいずれか、簡潔な説明） */
  baselineReason?: string;
  /** 公式ハウス詳細ページ（日本語の “/shop/” または英語 “/en/properties/”） */
  officialUrl: string; // 公式物件ページURL
  officialThumbUrl?: string; // 公式ページ等のサムネイル画像URL（OG画像等）
};

export type PricingConfig = {
  ethJpy: number; // ETH/JPY 変換レート
  monthFactor: Record<Area, Record<string, number>>; // month:1-12
  dowFactor: Record<
    "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun",
    number
  >;
  longStayFactor: Record<string, number>; // nights: "1","2","3"...
  leadtimeFactor: { days_lt: number; factor: number }[]; // 昇順
};
