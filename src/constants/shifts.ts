import { NationalHoliday, ShiftType } from '../types';

/**
 * 使用者明確清除當日排班的哨兵 ID。
 * 須寫入 schedules，不可 delete：刪除後會被 getEffectiveShift 依六休七例回填。
 * 此 ID 不在 DEFAULT_SHIFTS 內，畫面視為未排班，亦不計入工作／休息／例假／國定假日。
 */
export const EMPTY_SHIFT_TYPE_ID = 'shift_empty';

/**
 * 「空」清除鈕的預設快捷鍵（持久化鍵：perpetual_empty_shift_shortcut）。
 * 僅休／例／國／調／清空預設有捷徑；工作班別由使用者自行設定。
 */
export const DEFAULT_EMPTY_SHIFT_SHORTCUT_KEY = '0';

/** LocalStorage 鍵：清空班別快捷鍵。 */
export const EMPTY_SHIFT_SHORTCUT_STORAGE_KEY = 'perpetual_empty_shift_shortcut';

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
    shortcutKey: '',
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
    shortcutKey: '',
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
    shortcutKey: '',
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
    shortcutKey: '',
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
    shortcutKey: '6',
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
    shortcutKey: '7',
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
    shortcutKey: '8',
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
    shortcutKey: '9',
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
 * 是否為國定假日「國」或補假「調」班別（預設釘選且不可解除）。
 * @param shiftTypeId 班別 ID
 * @returns 為國／調時 true
 */
export function isNationalLockedShiftTypeId(shiftTypeId: string | undefined): boolean {
  return (
    shiftTypeId === 'shift_national_holiday' ||
    shiftTypeId === 'shift_national_holiday_makeup'
  );
}

/**
 * 黑列／快捷鍵是否可對該日發起改班。
 * 一般釘選日略過；國／調雖釘選仍可發起（由上層先確認刪假再改班）。
 * @param isPinned 班表寫入之釘選狀態
 * @param effectiveShiftTypeId 當日有效班別 ID
 * @returns 可發起改班時 true
 */
export function canInitiateShiftChange(
  isPinned: boolean | undefined,
  effectiveShiftTypeId: string | undefined
): boolean {
  if (isNationalLockedShiftTypeId(effectiveShiftTypeId)) return true;
  return !isPinned;
}

/**
 * 合併使用者已存班別與 DEFAULT_SHIFTS，補上缺失的內建班別（如新增的「調」）。
 * 亦為尚未寫入 shortcutKey 的舊資料填入內建預設捷徑（僅當欄位為 undefined）。
 * @param stored 自 LocalStorage 還原的班別清單
 * @returns 保證含全部內建班別的清單
 */
export function ensureDefaultShifts(stored: ShiftType[]): ShiftType[] {
  const defaultById = new Map(DEFAULT_SHIFTS.map((d) => [d.id, d]));
  // 舊資料無 shortcutKey 時補預設；空字串代表使用者刻意清除，不覆寫
  const merged = stored.map((s) => {
    if (s.shortcutKey !== undefined) return s;
    const def = defaultById.get(s.id);
    if (!def || def.shortcutKey === undefined) return { ...s, shortcutKey: '' };
    return { ...s, shortcutKey: def.shortcutKey };
  });
  const ids = new Set(merged.map((s) => s.id));
  const missing = DEFAULT_SHIFTS.filter((d) => !ids.has(d.id));
  if (missing.length === 0) return merged;
  return [...merged, ...missing];
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
