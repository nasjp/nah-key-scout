export type Area = string;
export type HouseId = string;
export type Capacity = {
  standard: number | null;
  max: number | null;
  coSleepingMax: number | null;
};
export type HouseInfo = {
  id: HouseId;
  displayName: string;
  area: Area;
  capacity: Capacity;
  /** 公式予約ページの「￥xxx~/1 night」を基準に置くベースライン（変動制につき目安） */
  baselinePerNightJpy: number;
  /** baseline算出の根拠（公式/媒体/推定のいずれか、簡潔な説明） */
  baselineReason?: string;
  /** 不確実性の等級（Low=公式に準拠 / Med=媒体・強い示唆 / High=推定） */
  uncertainty?: "Low" | "Med" | "High";
  /** 公式ハウス詳細ページ（日本語の “/shop/” または英語 “/en/properties/”） */
  officialUrl: string;
  officialThumbUrl?: string;
};
export type PricingConfig = {
  ethJpy: number;
  monthFactor: Record<Area, Record<string, number>>;
  dowFactor: Record<
    "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun",
    number
  >;
  longStayFactor: Record<string, number>;
  leadtimeFactor: {
    days_lt: number;
    factor: number;
  }[];
};
