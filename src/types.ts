export type ScheduleSystemType = 'standard' | '2-week' | '4-week' | '8-week';

export interface ShiftType {
  id: string;
  code: string; // e.g. "D", "E", "N", "OFF", "HOL", "NAT"
  name: string; // e.g. "早班", "中班", "夜班", "休息日", "例假日", "國定假日"
  startTime: string; // e.g. "09:00"
  endTime: string; // e.g. "18:00"
  workHours: number; // e.g. 8 or 10
  breakHours: number; // e.g. 1
  /** 班別背景色（hex）。 */
  color: string;
  /**
   * 文字色（#FFFFFF 或 #2D2D2D）。
   * 畫面多依背景即時計算；此欄供持久化／匯出相容。
   */
  textColor: string;
  /**
   * 班別類別。
   * national_holiday_makeup＝國定假日補假「調」：計薪視同國假，審查時可依 substitutesFor 計入休／例配額。
   */
  category: 'work' | 'rest' | 'mandatory' | 'national_holiday' | 'national_holiday_makeup';
  /**
   * 選取格子後可快速套用此班別的快捷鍵（單一字元）。
   * 允許：0–9、A–Z、,./;'[]\=-；空字串表示未設定。
   */
  shortcutKey?: string;
}

export interface DayShift {
  /** 日期 YYYY-MM-DD。 */
  date: string;
  /** 套用之班別 ID。 */
  shiftTypeId: string;
  /** 備註。 */
  note?: string;
  /** 是否含加班（相容欄位；以 overtimeHours > 0 為準）。 */
  isOvertime?: boolean;
  /** 當日延長工時時數（小時），以模擬步進累加。 */
  overtimeHours?: number;
  /**
   * 當日已使用之補休時數（小時）。
   * 自本月加班庫存扣抵，顯示工時 = 正常＋加班−補休。
   */
  compLeaveHours?: number;
  /**
   * 「調」班手動／補假所替補之休／例配額。
   * 審查優先讀此欄；與 NationalHoliday.substitutesFor 同步寫入。
   */
  makeupSubstitutesFor?: 'rest' | 'mandatory';
  /**
   * 「調」班對應之原國定假日日期（畫面上的「國」班日）。
   */
  makeupSourceDate?: string;
  /**
   * @deprecated 改以加班庫存＋補休時數處理；保留相容。
   */
  overtimeSettlement?: 'pay' | 'comp_leave';
  /** 是否釘選鎖定班別（不可改班／拖放；加班與換休仍可調）。 */
  isPinned?: boolean;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  scheduleSystem: ScheduleSystemType;
  /**
   * @deprecated 請使用公司級 companyCycleStartDate；寫入時會同步為此值以相容舊邏輯。
   */
  cycleStartDate?: string; // YYYY-MM-DD (e.g. 第一週/週期起始日)
  schedules: Record<string, DayShift>; // key: YYYY-MM-DD
}

/**
 * 國定／自訂放假日。
 * 逢星期六、日新增時可由系統建議產生補假日（kind = makeup）。
 */
export interface NationalHoliday {
  /** 假日識別碼。 */
  id: string;
  /** 放假日期 YYYY-MM-DD。 */
  date: string;
  /** 顯示名稱。 */
  name: string;
  /** 是否為法定國定假日（相對公司自訂假日）。 */
  isStatutory: boolean;
  /** 補充說明。 */
  description?: string;
  /**
   * 假日種類：原日或週末挪移之補假；未填視為原日（相容舊資料）。
   */
  kind?: 'original' | 'makeup';
  /**
   * 補假所對應之原國定假日日期 YYYY-MM-DD。
   * 僅 kind = makeup 時有意義。
   */
  sourceDate?: string;
  /**
   * 補假在審查時要替補的例／休配額。
   * 原日為六 → rest；原日為日 → mandatory（因國假班覆寫週末的休／例）。
   */
  substitutesFor?: 'rest' | 'mandatory';
}

export type LaborRuleViolation = {
  type:
    | 'consecutive_work'
    | 'insufficient_mandatory_off'
    | 'insufficient_rest_day'
    | 'exceed_max_hours'
    | 'shift_interval_insufficient'
    | 'daily_hours_exceeded'
    | 'monthly_overtime_exceeded'
    | 'weekly_hours_exceeded'
    | 'cycle_overtime_exceeded'
    | 'mandatory_overtime';
  severity: 'error' | 'warning';
  article: string; // e.g. "勞基法第36條"
  title: string;
  message: string;
  dates?: string[];
  affectedEmployeeId?: string;
};

export interface SnapResult {
  allowed: boolean;
  snappedDate: string; // YYYY-MM-DD (Closest legal date or original target if valid)
  originalTargetDate: string;
  wasAdjusted: boolean; // true if snapped away from target due to violation
  reason?: string;
  ruleViolated?: string;
}

export interface SystemConfig {
  name: string;
  type: ScheduleSystemType;
  cycleDays: number;
  maxConsecutiveWorkDays: number;
  minMandatoryOffPerCycle: number;
  minRestDaysPerCycle: number;
  maxNormalHoursPerCycle: number;
  maxDailyNormalHours: number;
  description: string;
  legalBasis: string;
  applicableIndustries: string;
}
