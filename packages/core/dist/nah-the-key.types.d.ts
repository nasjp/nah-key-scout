export type Area = string;
export type HouseId = string;
export type Dow = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
/** baseline の確からしさ。Low=公式実額 / Med=媒体・強い示唆 / High=推定 */
export type Uncertainty = "Low" | "Med" | "High";
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
  /**
   * 公式予約ページの「￥xxx~/1 night」＝**年間で最も安い1泊**の価格。
   * 需要係数はすべて 1.0 以上に正規化されているため、
   * この値が公正価格の下限になる（`min(月×曜日×特異日) === 1.0`）。
   */
  baselinePerNightJpy: number;
  /** baseline算出の根拠（公式/媒体/推定のいずれか、簡潔な説明） */
  baselineReason?: string;
  /** 不確実性の等級（Low=公式に準拠 / Med=媒体・強い示唆 / High=推定） */
  uncertainty?: Uncertainty;
  /** 公式ハウス詳細ページ（日本語の “/shop/” または英語 “/en/properties/”） */
  officialUrl: string;
  officialThumbUrl?: string;
};
/** 年末年始・GW・お盆のような、月係数では表現できない特異日レンジ */
export type SpecialDayRange = {
  id: string;
  label: string;
  /** "MM-DD"。from > to の場合は年をまたぐ（例: 12-28 〜 01-03） */
  fromMmDd: string;
  toMmDd: string;
  factor: number;
};
export type SpecialDayConfig = {
  ranges: SpecialDayRange[];
  /** 日本の祝日（YYYY-MM-DD）。範囲外の年は割増なしにフォールバックする */
  holidays: string[];
  /** 祝日当日（平日にあたる場合のみ） */
  holidayFactor: number;
  /** 翌日が祝日の夜（=連休の入り口。曜日係数で拾えない日〜木を対象） */
  holidayEveFactor: number;
};
export type PricingConfig = {
  /**
   * ETH/JPY 変換レート。取得できなかった場合は undefined。
   * 推測値で計算を続けると盤面全体が静かに反転するため、既定値は持たない。
   */
  ethJpy?: number;
  /** エリア×月（1-12）。すべて 1.0 以上に正規化済み */
  monthFactor: Record<Area, Record<string, number>>;
  /** 曜日。すべて 1.0 以上に正規化済み */
  dowFactor: Record<Dow, number>;
  specialDay: SpecialDayConfig;
  /** 泊数ごとの逓減（1泊 = 1.0） */
  longStayFactor: Record<string, number>;
  /**
   * 上限入札の算出に使う安全マージン（割合）。
   * チェックインが近いほど流動性・変更不可のリスクが上がるので上乗せする。
   * ＝「公正価格を下げる」のではなく「買値に要求する割引を増やす」形で扱う。
   */
  leadtimeMargin: {
    daysLt: number;
    margin: number;
  }[];
  /** baseline の相対誤差。割安度の信頼区間に使う */
  baselineRelError: Record<Uncertainty, number>;
};
