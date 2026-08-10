import {
  DayShift,
  LaborRuleViolation,
  NationalHoliday,
  ScheduleSystemType,
  ShiftType,
  SnapResult,
} from '../types';
import { SYSTEM_CONFIGS } from '../constants/systems';
import {
  MAX_MONTHLY_OVERTIME_HOURS,
  WEEKLY_TOTAL_HOURS_CAP,
  getCycleOvertimeCapHours,
} from '../constants/overtime';
import { EMPTY_SHIFT_TYPE_ID, resolveHolidayShiftTypeId } from '../constants/shifts';
import { addDays, format, parseISO, differenceInDays, isSameDay, startOfWeek, endOfWeek } from 'date-fns';

/**
 * 依星期給定「尚未寫入班表」時的虛擬預設班別。
 * 注意：使用者點「空」清除時必須寫入 EMPTY_SHIFT_TYPE_ID，不可依賴刪除後再走此預設。
 * @param dateStr 日期 YYYY-MM-DD
 * @returns 預設班別 ID（日＝例假、六＝休息、平日＝早班）
 */
export function getDefaultShiftTypeIdForDate(dateStr: string): string {
  const d = parseISO(dateStr);
  const dayOfWeek = d.getDay();
  if (dayOfWeek === 0) return 'shift_mandatory'; // 星期天：例假日
  if (dayOfWeek === 6) return 'shift_rest';      // 星期六：休假日
  return 'shift_morning';                        // 週一到週五：普通班 (早班)
}

/**
 * 是否為使用者明確清除的空班（非休／例／國假）。
 * @param shiftTypeId 班別 ID
 * @returns 為空班哨兵時 true
 */
export function isEmptyShiftTypeId(shiftTypeId: string | undefined): boolean {
  return shiftTypeId === EMPTY_SHIFT_TYPE_ID;
}

/**
 * 取得當日有效班別：有寫入則用寫入值（含空班哨兵）；無紀錄才回填虛擬預設。
 * 虛擬預設優先套用國定假日／補假（國／調），否則才用六休七例。
 * @param schedules 班表
 * @param dateStr 日期 YYYY-MM-DD
 * @param nationalHolidays 國定／補假清單（可選；提供後未寫入日時也能顯示國／調）
 * @returns 當日 DayShift（空班時 shiftTypeId 為 EMPTY_SHIFT_TYPE_ID）
 */
export function getEffectiveShift(
  schedules: Record<string, DayShift>,
  dateStr: string,
  nationalHolidays: NationalHoliday[] = []
): DayShift {
  if (schedules[dateStr]) {
    return schedules[dateStr];
  }

  // 無寫入時：國假／調優先於六休七例，避免月曆「有假日標註卻顯示早班」
  const holiday = nationalHolidays.find((h) => h.date === dateStr);
  if (holiday) {
    return {
      date: dateStr,
      shiftTypeId: resolveHolidayShiftTypeId(holiday),
    };
  }

  return {
    date: dateStr,
    shiftTypeId: getDefaultShiftTypeIdForDate(dateStr),
  };
}

/**
 * Gets shift details by ID
 */
export function getShiftType(
  shiftTypeId: string,
  shiftTypes: ShiftType[]
): ShiftType | undefined {
  return shiftTypes.find((s) => s.id === shiftTypeId);
}

/**
 * 自假日清單或班表欄位推導「調」班應計入休息日或例假日。
 * 優先：DayShift.makeupSubstitutesFor（手動選調時寫入）→ 假日清單 → sourceDate 推導。
 * @param dateStr 班表日期
 * @param nationalHolidays 國定／補假清單
 * @param schedules 班表（可選，供讀取 makeupSubstitutesFor）
 * @returns rest／mandatory；找不到時 undefined
 */
function resolveMakeupQuotaForDate(
  dateStr: string,
  nationalHolidays: NationalHoliday[],
  schedules?: Record<string, DayShift>
): 'rest' | 'mandatory' | undefined {
  // 手動套「調」時寫在班表上的替補標記最優先
  const fromShift = schedules?.[dateStr]?.makeupSubstitutesFor;
  if (fromShift) return fromShift;

  const h = nationalHolidays.find((x) => x.date === dateStr && x.kind === 'makeup');
  if (!h) return undefined;
  if (h.substitutesFor) return h.substitutesFor;
  // 舊資料：依原日星期推導
  if (h.sourceDate) {
    const day = parseISO(`${h.sourceDate}T12:00:00`).getDay();
    if (day === 6) return 'rest';
    if (day === 0) return 'mandatory';
  }
  return undefined;
}

/**
 * 是否計入例假日配額（含「調」替補例假）。
 * @param category 班別類別
 * @param dateStr 日期
 * @param nationalHolidays 假日清單（供「調」對應）
 * @param schedules 班表（供讀取手動調班標記）
 */
export function countsTowardMandatoryOff(
  category: ShiftType['category'] | undefined,
  dateStr: string,
  nationalHolidays: NationalHoliday[],
  schedules?: Record<string, DayShift>
): boolean {
  if (category === 'mandatory') return true;
  if (category === 'national_holiday_makeup') {
    return resolveMakeupQuotaForDate(dateStr, nationalHolidays, schedules) === 'mandatory';
  }
  return false;
}

/**
 * 是否計入休息日配額（含「調」替補休息日）。
 * @param category 班別類別
 * @param dateStr 日期
 * @param nationalHolidays 假日清單（供「調」對應）
 * @param schedules 班表（供讀取手動調班標記）
 */
export function countsTowardRestDay(
  category: ShiftType['category'] | undefined,
  dateStr: string,
  nationalHolidays: NationalHoliday[],
  schedules?: Record<string, DayShift>
): boolean {
  if (category === 'rest') return true;
  if (category === 'national_holiday_makeup') {
    return resolveMakeupQuotaForDate(dateStr, nationalHolidays, schedules) === 'rest';
  }
  return false;
}

/**
 * 是否為休／例／調等「免出勤且受跨週期移動限制」之日。
 * 國定假日原日本身可被週末覆寫情境處理；「調」與休、例同屬應保護之免出勤。
 */
function isProtectedOffCategory(category: ShiftType['category'] | undefined): boolean {
  return (
    category === 'rest' ||
    category === 'mandatory' ||
    category === 'national_holiday_makeup'
  );
}

/**
 * 加總某週（週日～週六）正常工時＋加班時數。
 * @param schedules 班表
 * @param dateStr 週內任一日
 * @param shiftTypes 班別定義
 * @param override 可選：覆寫某日加班時數（按下 +／− 前預估）
 * @returns 正常、加班與合計
 */
export function sumWeekWorkAndOvertime(
  schedules: Record<string, DayShift>,
  dateStr: string,
  shiftTypes: ShiftType[],
  override?: { dateStr: string; overtimeHours: number },
  nationalHolidays: NationalHoliday[] = []
): { normal: number; overtime: number; total: number; startStr: string; endStr: string } {
  const start = startOfWeek(parseISO(dateStr), { weekStartsOn: 0 });
  const end = endOfWeek(parseISO(dateStr), { weekStartsOn: 0 });
  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(end, 'yyyy-MM-dd');
  let normal = 0;
  let overtime = 0;
  let cursor = start;

  for (let i = 0; i < 7; i++) {
    const dStr = format(cursor, 'yyyy-MM-dd');
    const day = getEffectiveShift(schedules, dStr, nationalHolidays);
    const st = getShiftType(day.shiftTypeId, shiftTypes);
    if (st?.category === 'work') {
      normal += st.workHours;
      const ot =
        override && override.dateStr === dStr
          ? override.overtimeHours
          : day.overtimeHours || 0;
      overtime += ot;
    }
    cursor = addDays(cursor, 1);
  }

  normal = Math.round(normal * 10) / 10;
  overtime = Math.round(overtime * 10) / 10;
  return {
    normal,
    overtime,
    total: Math.round((normal + overtime) * 10) / 10,
    startStr,
    endStr,
  };
}

/**
 * Determines if a shift count as working day.
 * 空班（找不到 ShiftType）與非 work 類別皆不算工作日。
 * @param shift 班別定義；undefined 時視為非工作
 * @returns 是否為工作班
 */
export function isWorkShift(shift: ShiftType | undefined): boolean {
  if (!shift) return false;
  return shift.category === 'work';
}

/**
 * Calculates continuous work days starting or spanning across dates
 */
export function calculateConsecutiveWorkDays(
  schedules: Record<string, DayShift>,
  startDate: string, // YYYY-MM-DD
  endDate: string,
  shiftTypes: ShiftType[],
  nationalHolidays: NationalHoliday[] = []
): { maxConsecutive: number; datesList: string[][] } {
  let currentConsecutive = 0;
  let maxConsecutive = 0;
  let currentGroup: string[] = [];
  const datesList: string[][] = [];

  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const totalDays = differenceInDays(end, start) + 1;

  for (let i = 0; i < totalDays; i++) {
    const dStr = format(addDays(start, i), 'yyyy-MM-dd');
    const dayShift = getEffectiveShift(schedules, dStr, nationalHolidays);
    const shiftType = getShiftType(dayShift.shiftTypeId, shiftTypes);

    if (isWorkShift(shiftType)) {
      currentConsecutive++;
      currentGroup.push(dStr);
      if (currentConsecutive > maxConsecutive) {
        maxConsecutive = currentConsecutive;
      }
    } else {
      if (currentGroup.length > 0) {
        datesList.push([...currentGroup]);
        currentGroup = [];
      }
      currentConsecutive = 0;
    }
  }

  if (currentGroup.length > 0) {
    datesList.push([...currentGroup]);
  }

  return { maxConsecutive, datesList };
}

export function getEffectiveCycleStartDate(dateStr: string, empCycleStartDate?: string): string {
  if (empCycleStartDate && empCycleStartDate.trim() !== '') {
    return empCycleStartDate;
  }
  const year = parseISO(dateStr).getFullYear();
  return `${year}-01-01`;
}

export function getCycleInfoForDate(
  dateStr: string,
  cycleDays: number,
  cycleStartDate?: string
): { cycleNumber: number; cStartStr: string; cEndStr: string; cStart: Date; cEnd: Date } {
  const effectiveBase = getEffectiveCycleStartDate(dateStr, cycleStartDate);
  const base = parseISO(effectiveBase);
  const d = parseISO(dateStr);
  const diffDays = differenceInDays(d, base);
  const cIndex = Math.floor(diffDays / cycleDays);
  const cStart = addDays(base, cIndex * cycleDays);
  const cEnd = addDays(cStart, cycleDays - 1);
  return {
    cycleNumber: cIndex + 1,
    cStartStr: format(cStart, 'yyyy-MM-dd'),
    cEndStr: format(cEnd, 'yyyy-MM-dd'),
    cStart,
    cEnd,
  };
}

export function getCycleRangeForDate(
  dateStr: string,
  cycleDays: number,
  cycleStartDate?: string
): { cStartStr: string; cEndStr: string } {
  const info = getCycleInfoForDate(dateStr, cycleDays, cycleStartDate);
  return {
    cStartStr: info.cStartStr,
    cEndStr: info.cEndStr,
  };
}

/**
 * Evaluates full compliance for a given date window & schedule system
 */
export function checkCompliance(
  schedules: Record<string, DayShift>,
  startDate: string, // YYYY-MM-DD
  endDate: string,
  systemType: ScheduleSystemType,
  shiftTypes: ShiftType[],
  nationalHolidays: NationalHoliday[] = [],
  cycleStartDate?: string
): LaborRuleViolation[] {
  const config = SYSTEM_CONFIGS[systemType];
  const violations: LaborRuleViolation[] = [];

  const start = parseISO(startDate);
  const end = parseISO(endDate);

  // Align start and end to full week boundaries (Sunday start, Saturday end)
  const alignedStart = startOfWeek(start, { weekStartsOn: 0 });
  const alignedEnd = endOfWeek(end, { weekStartsOn: 0 });
  const alignedStartStr = format(alignedStart, 'yyyy-MM-dd');
  const alignedEndStr = format(alignedEnd, 'yyyy-MM-dd');

  // 1. Consecutive work days check across full aligned range
  const { maxConsecutive, datesList } = calculateConsecutiveWorkDays(
    schedules,
    alignedStartStr,
    alignedEndStr,
    shiftTypes,
    nationalHolidays
  );

  if (maxConsecutive > config.maxConsecutiveWorkDays) {
    const illegalGroups = datesList.filter(
      (g) => g.length > config.maxConsecutiveWorkDays
    );
    violations.push({
      type: 'consecutive_work',
      severity: 'error',
      article: config.type === '4-week' ? '勞基法第30條之1' : '勞基法第36條第1項',
      title: '連續工作天數超限',
      message: `${config.name}規定最長不得連續工作超過 ${config.maxConsecutiveWorkDays} 天，目前最長連續工作 ${maxConsecutive} 天！`,
      dates: illegalGroups.flat(),
    });
  }

  // 1b. 月延長工時累計（勞基法第32條一般上限 46 小時）
  let monthlyOvertime = 0;
  const otDates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    const dStr = format(cursor, 'yyyy-MM-dd');
    const dayShift = schedules[dStr];
    if (dayShift?.overtimeHours && dayShift.overtimeHours > 0) {
      monthlyOvertime += dayShift.overtimeHours;
      otDates.push(dStr);
    }
    cursor = addDays(cursor, 1);
  }
  monthlyOvertime = Math.round(monthlyOvertime * 10) / 10;
  if (monthlyOvertime > MAX_MONTHLY_OVERTIME_HOURS) {
    violations.push({
      type: 'monthly_overtime_exceeded',
      severity: 'warning',
      article: '勞基法第32條',
      title: '每月延長工時超限',
      message: `本區間累計加班 ${monthlyOvertime} 小時，超過一般上限 ${MAX_MONTHLY_OVERTIME_HOURS} 小時（經勞資會議同意並報備者另有彈性，此處採一般上限）。`,
      dates: otDates,
    });
  }

  // 1c. 逐週檢查：僅以「正常工時」對照每週 40H（勞基法第30條）；延長工時另依第32條月上限計，不併入 40H
  {
    let weekCursor = startOfWeek(start, { weekStartsOn: 0 });
    const lastWeekStart = startOfWeek(end, { weekStartsOn: 0 });
    while (weekCursor <= lastWeekStart) {
      const weekDateStr = format(weekCursor, 'yyyy-MM-dd');
      const weekSum = sumWeekWorkAndOvertime(schedules, weekDateStr, shiftTypes, undefined, nationalHolidays);
      // 超出每週 40 小時之部分應登錄為延長工時，不可把已登錄加班再拿來判定「超過 40H」
      if (weekSum.normal > WEEKLY_TOTAL_HOURS_CAP) {
        const weekDates: string[] = [];
        for (let i = 0; i < 7; i++) {
          weekDates.push(format(addDays(weekCursor, i), 'yyyy-MM-dd'));
        }
        violations.push({
          type: 'weekly_hours_exceeded',
          severity: 'warning',
          article: '勞基法第30條',
          title: '當週正常工時超過40小時',
          message: `${weekSum.startStr} ~ ${weekSum.endStr} 正常工時合計 ${weekSum.normal}H，超過每週正常工時 ${WEEKLY_TOTAL_HOURS_CAP}H 上限；超出部分應改列延長工時（第32條），不得計入正常工時。`,
          dates: weekDates,
        });
      }
      weekCursor = addDays(weekCursor, 7);
    }
  }

  // 2. Cycle-based analysis (e.g., 2-week, 4-week, 8-week chunks)
  const cycleDays = config.cycleDays;
  let cycleStart = alignedStart;

  if (cycleStartDate) {
    const base = parseISO(cycleStartDate);
    const diff = differenceInDays(start, base);
    const startCIndex = Math.floor(diff / cycleDays);
    cycleStart = addDays(base, startCIndex * cycleDays);
  }

  while (cycleStart <= alignedEnd) {
    const cycleEnd = addDays(cycleStart, cycleDays - 1);
    const cycleStartStr = format(cycleStart, 'yyyy-MM-dd');
    const cycleEndStr = format(cycleEnd, 'yyyy-MM-dd');

    let totalWorkHours = 0;
    let cycleOvertimeHours = 0;
    let mandatoryOffCount = 0;
    let restDayCount = 0;
    const cycleDates: string[] = [];

    // Always evaluate ALL cycleDays (never break early at month end)
    for (let i = 0; i < cycleDays; i++) {
      const current = addDays(cycleStart, i);
      const dStr = format(current, 'yyyy-MM-dd');
      cycleDates.push(dStr);

      const dayShift = getEffectiveShift(schedules, dStr, nationalHolidays);
      const shiftType = getShiftType(dayShift.shiftTypeId, shiftTypes);

      if (shiftType) {
        if (shiftType.category === 'work') {
          totalWorkHours += shiftType.workHours;
          const ot = dayShift.overtimeHours || 0;
          cycleOvertimeHours += ot;
          const dayTotal = shiftType.workHours + ot;

          // 單日正常＋延長合計不得超過 12 小時
          if (dayTotal > 12) {
            violations.push({
              type: 'daily_hours_exceeded',
              severity: 'error',
              article: '勞基法第32條',
              title: '單日總工時超限（含加班）',
              message: `${dStr} 正常 ${shiftType.workHours}H＋加班 ${ot}H＝${dayTotal}H，超過單日合計 12 小時上限。`,
              dates: [dStr],
            });
          } else if (shiftType.workHours > config.maxDailyNormalHours) {
            violations.push({
              type: 'daily_hours_exceeded',
              severity: 'warning',
              article: '勞基法第30條第2~3項',
              title: '單日正常工時超限',
              message: `${dStr} 排班正常工時為 ${shiftType.workHours} 小時，超過該制度單日正常上限 ${config.maxDailyNormalHours} 小時（多出時數須算延長工時）。`,
              dates: [dStr],
            });
          }
        } else if (countsTowardMandatoryOff(shiftType.category, dStr, nationalHolidays, schedules)) {
          mandatoryOffCount++;
        } else if (countsTowardRestDay(shiftType.category, dStr, nationalHolidays, schedules)) {
          restDayCount++;
        }
      }
    }

    cycleOvertimeHours = Math.round(cycleOvertimeHours * 10) / 10;
    const cycleOtCap = getCycleOvertimeCapHours(systemType);
    if (cycleOvertimeHours > cycleOtCap) {
      violations.push({
        type: 'cycle_overtime_exceeded',
        severity: 'warning',
        article: '勞基法第32條',
        title: '週期延長工時偏高',
        message: `${cycleStartStr} ~ ${cycleEndStr}（${config.cycleDays} 天週期）累計加班 ${cycleOvertimeHours}H，超過依月上限折算之週期參考上限 ${cycleOtCap}H。`,
        dates: cycleDates,
      });
    }

    // Check max normal work hours in cycle
    if (totalWorkHours > config.maxNormalHoursPerCycle) {
      violations.push({
        type: 'exceed_max_hours',
        severity: 'error',
        article: config.legalBasis,
        title: '週期總正常工時超標',
        message: `${cycleStartStr} ~ ${cycleEndStr} (${config.cycleDays}天週期) 累積工時 ${totalWorkHours} 小時，超過法定上限 ${config.maxNormalHoursPerCycle} 小時。`,
        dates: cycleDates,
      });
    }

    // Check mandatory off count (例假日)
    if (mandatoryOffCount < config.minMandatoryOffPerCycle) {
      violations.push({
        type: 'insufficient_mandatory_off',
        severity: 'error',
        article: '勞基法第36條',
        title: '例假日天數不足',
        message: `${cycleStartStr} ~ ${cycleEndStr} 週期應有至少 ${config.minMandatoryOffPerCycle} 天「例假日」，目前僅有 ${mandatoryOffCount} 天。`,
        dates: cycleDates,
      });
    }

    // Check rest day count (休息日)
    if (restDayCount < config.minRestDaysPerCycle) {
      violations.push({
        type: 'insufficient_rest_day',
        severity: 'warning',
        article: '勞基法第36條',
        title: '休息日天數不足',
        message: `${cycleStartStr} ~ ${cycleEndStr} 週期應有至少 ${config.minRestDaysPerCycle} 天「休息日」，目前僅有 ${restDayCount} 天。`,
        dates: cycleDates,
      });
    }

    cycleStart = addDays(cycleStart, cycleDays);
  }

  // 3. Check shift interval gap (輪班間隔時間未滿11小時)
  const totalAlignedDays = differenceInDays(alignedEnd, alignedStart) + 1;
  for (let i = 0; i < totalAlignedDays - 1; i++) {
    const d1Str = format(addDays(alignedStart, i), 'yyyy-MM-dd');
    const d2Str = format(addDays(alignedStart, i + 1), 'yyyy-MM-dd');

    const s1 = getShiftType(getEffectiveShift(schedules, d1Str, nationalHolidays).shiftTypeId, shiftTypes);
    const s2 = getShiftType(getEffectiveShift(schedules, d2Str, nationalHolidays).shiftTypeId, shiftTypes);

    if (s1 && s2 && isWorkShift(s1) && isWorkShift(s2)) {
      // Parse times
      const [endH1, endM1] = s1.endTime.split(':').map(Number);
      const [startH2, startM2] = s2.startTime.split(':').map(Number);

      // If s1 spans past midnight (e.g. 15:00 to 24:00 or 23:00 to 07:00 next day)
      let endMins1 = endH1 * 60 + endM1;
      let startMins2 = startH2 * 60 + startM2 + 24 * 60; // next day offset

      let restMins = startMins2 - endMins1;
      if (restMins < 11 * 60) {
        const restHours = (restMins / 60).toFixed(1);
        violations.push({
          type: 'shift_interval_insufficient',
          severity: 'error',
          article: '勞基法第34條第2項',
          title: '輪班換班間隔未滿11小時',
          message: `${d1Str} (${s1.name}) 銜接 ${d2Str} (${s2.name}) 之休息時間僅 ${restHours} 小時，未達法定至少 11 小時休息保障！`,
          dates: [d1Str, d2Str],
        });
      }
    }
  }

  return violations;
}

/**
 * Requirement #5 Implementation:
 * "ui/ux採取方塊平移班別，遇到以上條件不可移動者要卡在最靠近邊界的合法位置"
 *
 * Given an original schedule, when moving a shift of type `movingShiftTypeId` from `fromDate` to `targetDate`:
 * Evaluates whether `targetDate` creates any severe labor law violations.
 * If `targetDate` is illegal, steps backwards along the trajectory towards `fromDate` to find
 * the closest legal date (最靠近邊界的合法位置).
 */
export function findNearestLegalDate(
  schedules: Record<string, DayShift>,
  fromDate: string, // YYYY-MM-DD
  targetDate: string, // YYYY-MM-DD
  movingShiftTypeId: string,
  systemType: ScheduleSystemType,
  shiftTypes: ShiftType[],
  windowDays: number = 28, // Scope of audit around target
  cycleStartDate?: string,
  nationalHolidays: NationalHoliday[] = []
): SnapResult {
  if (fromDate === targetDate) {
    return {
      allowed: true,
      snappedDate: targetDate,
      originalTargetDate: targetDate,
      wasAdjusted: false,
    };
  }

  // Pin protection: Pinned shifts cannot be moved or overridden
  if (schedules[fromDate]?.isPinned || schedules[targetDate]?.isPinned) {
    return {
      allowed: false,
      snappedDate: fromDate,
      originalTargetDate: targetDate,
      wasAdjusted: true,
      reason: '該日期班別已被釘選鎖定，無法進行移動或覆蓋！',
    };
  }

  const fromParsed = parseISO(fromDate);
  const targetParsed = parseISO(targetDate);
  const direction = targetParsed > fromParsed ? 1 : -1;
  const distance = Math.abs(differenceInDays(targetParsed, fromParsed));

  const config = SYSTEM_CONFIGS[systemType];
  const cycleDays = config.cycleDays;

  const fromCycle = getCycleRangeForDate(fromDate, cycleDays, cycleStartDate);

  // Test target position first
  const testScheduleForDate = (testDateStr: string): { valid: boolean; violation?: LaborRuleViolation } => {
    const testCycle = getCycleRangeForDate(testDateStr, cycleDays, cycleStartDate);

    const sourceShift = getEffectiveShift(schedules, fromDate, nationalHolidays);
    const targetShiftAtTest = getEffectiveShift(schedules, testDateStr, nationalHolidays);

    const sourceCat = getShiftType(sourceShift.shiftTypeId, shiftTypes)?.category;
    const targetCat = getShiftType(targetShiftAtTest.shiftTypeId, shiftTypes)?.category;

    // Requirement #6: 休、例、調（補假）不可以跨週期移動
    const isSourceOff = isProtectedOffCategory(sourceCat);
    const isTargetOff = isProtectedOffCategory(targetCat);

    if ((isSourceOff || isTargetOff) && fromCycle.cStartStr !== testCycle.cStartStr) {
      return {
        valid: false,
        violation: {
          type: 'insufficient_mandatory_off',
          severity: 'error',
          article: '勞基法第36條',
          title: '休、例假日不可跨週期移動',
          message: `休息日、例假日與國定假日補假（調）僅能於同一彈性週期內調移（目前週期：${fromCycle.cStartStr} ~ ${fromCycle.cEndStr}），不可跨至另一週期（${testCycle.cStartStr} ~ ${testCycle.cEndStr}）。`,
          dates: [fromDate, testDateStr],
        },
      };
    }

    // Clone schedule and perform swap
    const tempSchedules = { ...schedules };

    tempSchedules[testDateStr] = {
      date: testDateStr,
      shiftTypeId: sourceShift.shiftTypeId,
    };

    tempSchedules[fromDate] = {
      date: fromDate,
      shiftTypeId: targetShiftAtTest.shiftTypeId,
    };

    // Calculate window around testDate & fromDate
    const windowStart = fromCycle.cStartStr < testCycle.cStartStr ? fromCycle.cStartStr : testCycle.cStartStr;
    const windowEnd = fromCycle.cEndStr > testCycle.cEndStr ? fromCycle.cEndStr : testCycle.cEndStr;

    const violations = checkCompliance(
      tempSchedules,
      windowStart,
      windowEnd,
      systemType,
      shiftTypes,
      nationalHolidays,
      cycleStartDate
    );

    // Filter for severe errors that are RELEVANT to the current cycle of fromDate or testDateStr
    const relevantErrors = violations.filter((v) => {
      if (v.severity !== 'error') return false;
      const touchesFromCycle = v.dates.some(
        (dStr) => dStr >= fromCycle.cStartStr && dStr <= fromCycle.cEndStr
      );
      const touchesTestCycle = v.dates.some(
        (dStr) => dStr >= testCycle.cStartStr && dStr <= testCycle.cEndStr
      );
      return touchesFromCycle || touchesTestCycle || v.dates.includes(fromDate) || v.dates.includes(testDateStr);
    });

    if (relevantErrors.length === 0) {
      return { valid: true };
    } else {
      return { valid: false, violation: relevantErrors[0] };
    }
  };

  // 1. Check if the original target is already valid
  const targetCheck = testScheduleForDate(targetDate);
  if (targetCheck.valid) {
    return {
      allowed: true,
      snappedDate: targetDate,
      originalTargetDate: targetDate,
      wasAdjusted: false,
    };
  }

  // 2. If target is invalid, walk back towards fromDate to find closest valid boundary
  let step = 1;
  while (step <= distance) {
    const candidateDate = format(
      addDays(targetParsed, -direction * step),
      'yyyy-MM-dd'
    );

    const check = testScheduleForDate(candidateDate);
    if (check.valid) {
      return {
        allowed: true,
        snappedDate: candidateDate,
        originalTargetDate: targetDate,
        wasAdjusted: true,
        reason: `目標日 (${targetDate}) 觸犯【${targetCheck.violation?.title}】，已自動卡位至最靠近邊界之合法位置 (${candidateDate})。`,
        ruleViolated: targetCheck.violation?.article,
      };
    }
    step++;
  }

  // 3. Fallback: If even moving adjacent to fromDate fails, stay at fromDate
  return {
    allowed: false,
    snappedDate: fromDate,
    originalTargetDate: targetDate,
    wasAdjusted: true,
    reason: `無法平移：移動至 ${targetDate} 方向將違反【${targetCheck.violation?.title}】（${targetCheck.violation?.article}），退回原位置。`,
    ruleViolated: targetCheck.violation?.article,
  };
}
