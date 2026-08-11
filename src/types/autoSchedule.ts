import { DayShift, Employee, NationalHoliday, ScheduleSystemType, ShiftType } from '../types';

/**
 * 一鍵排班：單一星期幾 × 班別的人力需求（人頭）。
 * 業界實務多以「每日各班別所需人數」設定（非僅總工時）。
 */
export interface AutoScheduleStaffingNeed {
  /** 星期：0=週日 … 6=週六（對齊 Date.getDay()）。 */
  weekday: number;
  /** 目標班別 ID（通常為工作班）。 */
  shiftTypeId: string;
  /** 所需人數。 */
  headcount: number;
}

/**
 * 單一同仁在自動排班中的設定。
 */
export interface AutoScheduleEmpConfig {
  /** 同仁 ID。 */
  employeeId: string;
  /** 是否納入本次自動排班。 */
  included: boolean;
  /**
   * 可排班別與優先度（數字越小越優先）。
   * 未列入之工作班將不會被指派給該同仁。
   */
  shiftPriorities: { shiftTypeId: string; priority: number }[];
}

/**
 * 優先綁定同仁配對（傾向同日同班或同日出勤）。
 */
export interface AutoScheduleBondPair {
  employeeIdA: string;
  employeeIdB: string;
}

/**
 * A：班多／人少（需求 > 可排人力）處理方式。
 * keep_empty＝遵循規則，排不了就空班（預設）；
 * relax_pref＝在合規下可忽略班別偏好，找任何人填缺口。
 */
export type AutoScheduleShortagePolicy = 'keep_empty' | 'relax_pref';

/**
 * B：班少／人多（人力 > 需求）處理方式。
 * pack_work＝在合規下塞入偏好工作班，即使該日該班已達標（預設）；
 * prefer_off＝多餘人力改排空／休／例（後續優化連休）。
 */
export type AutoScheduleSurplusPolicy = 'pack_work' | 'prefer_off';

/**
 * 一鍵排班完整參數。
 */
export interface AutoScheduleInput {
  /** 排班起日 YYYY-MM-DD。 */
  startDate: string;
  /** 排班迄日 YYYY-MM-DD。 */
  endDate: string;
  /** 目前變形工時制度。 */
  systemType: ScheduleSystemType;
  /** 公司級第一週／週期起始日。 */
  companyCycleStartDate: string;
  /** 全部班別定義。 */
  shiftTypes: ShiftType[];
  /** 國定／自訂假日。 */
  nationalHolidays: NationalHoliday[];
  /** 既有同仁（含預排／釘選）。演算法空白階段通常傳入當下草稿。 */
  employees: Employee[];
  /**
   * 未納入演算法時用來還原的正式同仁清單。
   * 未傳則未納入者沿用 employees 內對應列。
   */
  baselineEmployees?: Employee[];
  /** 同仁納入與班別優先度。 */
  empConfigs: AutoScheduleEmpConfig[];
  /** 每日×班別人頭需求（週期樣板）。 */
  staffing: AutoScheduleStaffingNeed[];
  /** 優先綁定配對。 */
  bonds: AutoScheduleBondPair[];
  /**
   * 若為 true，略過再次「虛擬空白」步驟（表示父層已準備過草稿，且可能已含使用者手動預排）。
   */
  skipInitialBlank?: boolean;
  /**
   * A：班多人少處理（預設 keep_empty）。
   */
  shortagePolicy?: AutoScheduleShortagePolicy;
  /**
   * B：班少人多處理（預設 pack_work）。
   */
  surplusPolicy?: AutoScheduleSurplusPolicy;
}

/**
 * 一鍵排班執行結果。
 */
export interface AutoScheduleResult {
  /** 更新後的同仁清單（僅納入者班表可能變更）。 */
  employees: Employee[];
  /** 仍無法滿足的人力缺口摘要。 */
  uncovered: { date: string; shiftTypeId: string; missing: number }[];
  /** 執行後仍有合規警示之同仁數。 */
  employeesWithViolations: number;
  /** 連續休假區塊評分（越高越好）。 */
  consecutiveOffScore: number;
  /** 合計休假日次數（休＋例）。 */
  totalOffDays: number;
}

/** 一鍵排班流程提示「下次不再顯示」之 LocalStorage 鍵。 */
export const AUTO_SCHEDULE_TIP_DISMISS_KEY = 'perpetual_auto_schedule_tip_dismissed';

/**
 * 上次確認演算時的參數快照（「調整參數」應還原此內容）。
 */
export interface AutoScheduleSavedParams {
  /** 同仁納入與班別優先度。 */
  empConfigs: AutoScheduleEmpConfig[];
  /** 每日×班別人頭需求。 */
  staffing: AutoScheduleStaffingNeed[];
  /** 優先綁定配對。 */
  bonds: AutoScheduleBondPair[];
  /** A：班多人少。 */
  shortagePolicy: AutoScheduleShortagePolicy;
  /** B：班少人多。 */
  surplusPolicy: AutoScheduleSurplusPolicy;
}
