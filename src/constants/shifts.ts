import { NationalHoliday, ShiftType } from '../types';

/**
 * 使用者明確清除當日排班的哨兵 ID。
 * 須寫入 schedules，不可 delete：刪除後會被 getEffectiveShift 依六休七例回填。
 * 此 ID 不在 DEFAULT_SHIFTS 內，畫面視為未排班，亦不計入工作／休息／例假／國定假日。
 */
export const EMPTY_SHIFT_TYPE_ID = 'shift_empty';

export const DEFAULT_SHIFTS: ShiftType[] = [
  {
    id: 'shift_morning',
    code: '早',
    name: '早班 (8H)',
    startTime: '08:00',
    endTime: '17:00',
    workHours: 8,
    breakHours: 1,
    color: '#5A5A40', // Olive/Dark Sage
    textColor: '#ffffff',
    category: 'work',
  },
  {
    id: 'shift_afternoon',
    code: '中',
    name: '中班 (8H)',
    startTime: '15:00',
    endTime: '24:00',
    workHours: 8,
    breakHours: 1,
    color: '#757551', // Medium Olive
    textColor: '#ffffff',
    category: 'work',
  },
  {
    id: 'shift_night',
    code: '夜',
    name: '大夜班 (8H)',
    startTime: '00:00',
    endTime: '08:00',
    workHours: 8,
    breakHours: 0,
    color: '#42422F', // Deep Olive
    textColor: '#ffffff',
    category: 'work',
  },
  {
    id: 'shift_long',
    code: '全',
    name: '變形長班 (10H)',
    startTime: '08:00',
    endTime: '19:00',
    workHours: 10,
    breakHours: 1,
    color: '#8A8A70', // Sage Grey
    textColor: '#ffffff',
    category: 'work',
  },
  {
    id: 'shift_rest',
    code: '休',
    name: '休息日 (OFF)',
    startTime: '00:00',
    endTime: '00:00',
    workHours: 0,
    breakHours: 0,
    color: '#94A381', // Muted Leaf Green
    textColor: '#ffffff',
    category: 'rest',
  },
  {
    id: 'shift_mandatory',
    code: '例',
    name: '例假日 (HOL)',
    startTime: '00:00',
    endTime: '00:00',
    workHours: 0,
    breakHours: 0,
    color: '#D17A60', // Terracotta
    textColor: '#ffffff',
    category: 'mandatory',
  },
  {
    id: 'shift_national_holiday',
    code: '國',
    name: '國定假日 (NAT)',
    startTime: '00:00',
    endTime: '00:00',
    workHours: 0,
    breakHours: 0,
    color: '#B85338', // Deep Terracotta
    textColor: '#ffffff',
    category: 'national_holiday',
  },
  /**
   * 國定假日補假「調」：整日免出勤。
   * 審查時依假日 substitutesFor 計入休息日或例假日；計薪／勞檢仍視同國定假日（非一般休息日）。
   */
  {
    id: 'shift_national_holiday_makeup',
    code: '調',
    name: '國定假日補假 (調)',
    startTime: '00:00',
    endTime: '00:00',
    workHours: 0,
    breakHours: 0,
    color: '#C46B4A', // Mid Terracotta — 與「國」區隔但同系
    textColor: '#ffffff',
    category: 'national_holiday_makeup',
  },
];

/** 系統內建、不可刪除之班別 ID。 */
export const SYSTEM_PROTECTED_SHIFT_IDS = [
  'shift_rest',
  'shift_mandatory',
  'shift_national_holiday',
  'shift_national_holiday_makeup',
] as const;

/**
 * 合併使用者已存班別與 DEFAULT_SHIFTS，補上缺失的內建班別（如新增的「調」）。
 * @param stored 自 LocalStorage 還原的班別清單
 * @returns 保證含全部內建班別的清單
 */
export function ensureDefaultShifts(stored: ShiftType[]): ShiftType[] {
  const ids = new Set(stored.map((s) => s.id));
  const missing = DEFAULT_SHIFTS.filter((d) => !ids.has(d.id));
  if (missing.length === 0) return stored;
  return [...stored, ...missing];
}

/**
 * 依國定假日紀錄決定應寫入的班別 ID。
 * @param holiday 假日（makeup → 調；其餘 → 國）
 * @returns 班別 ID
 */
export function resolveHolidayShiftTypeId(holiday: Pick<NationalHoliday, 'kind'>): string {
  return holiday.kind === 'makeup'
    ? 'shift_national_holiday_makeup'
    : 'shift_national_holiday';
}
