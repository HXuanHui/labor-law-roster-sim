import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { DayShift, Employee, ShiftType } from '../types';
import { SYSTEM_CONFIGS } from '../constants/systems';
import { EMPTY_SHIFT_TYPE_ID, isNationalLockedShiftTypeId } from '../constants/shifts';
import {
  checkCompliance,
  getCycleInfoForDate,
  getEffectiveShift,
  isEmptyShiftTypeId,
} from './laborLaws';
import {
  AutoScheduleEmpConfig,
  AutoScheduleInput,
  AutoScheduleResult,
  AutoScheduleShortagePolicy,
  AutoScheduleSurplusPolicy,
} from '../types/autoSchedule';

/** 休假（pseudo：HOLIDAY_6）。 */
const REST_ID = 'shift_rest';
/** 例假（pseudo：LEAVE_7）。 */
const MANDATORY_ID = 'shift_mandatory';

/** 班格語意對齊 GenerateRoster 的 ScheduleType。 */
type SlotKind = 'EMPTY' | 'WORK' | 'HOLIDAY_6' | 'LEAVE_7' | 'PREASSIGNED';

/**
 * 建立日期區間字串清單（含起迄）。
 * @param startDate 起日
 * @param endDate 迄日
 * @returns YYYY-MM-DD 陣列
 */
function buildDateRange(startDate: string, endDate: string): string[] {
  const start = parseISO(startDate);
  const total = differenceInCalendarDays(parseISO(endDate), start) + 1;
  const list: string[] = [];
  for (let i = 0; i < Math.max(0, total); i++) {
    list.push(format(addDays(start, i), 'yyyy-MM-dd'));
  }
  return list;
}

/**
 * 判斷該日班表是否為「國／調」鎖定而不可被覆寫。
 * @param day 班表列
 */
function isLockedDay(day: DayShift | undefined): boolean {
  if (!day) return false;
  return isNationalLockedShiftTypeId(day.shiftTypeId);
}

/**
 * 建立虛擬空白班表：保留鎖定預排，其餘清除為空班哨兵。
 * @param emp 同仁
 * @param dates 排班區間
 * @returns 新 schedules
 */
export function buildBlankKeepingLocked(
  emp: Employee,
  dates: string[]
): Record<string, DayShift> {
  const next: Record<string, DayShift> = { ...emp.schedules };
  dates.forEach((d) => {
    const cur = next[d];
    if (isLockedDay(cur)) return;
    next[d] = { date: d, shiftTypeId: EMPTY_SHIFT_TYPE_ID };
  });
  return next;
}

/**
 * 為納入同仁建立虛擬空白草稿（未納入者原樣保留）。
 * @param employees 全員
 * @param includedIds 納入 ID
 * @param startDate 區間起
 * @param endDate 區間迄
 * @param companyCycleStartDate 公司週期起日
 * @returns 草稿同仁清單
 */
export function prepareAutoScheduleBlankDraft(
  employees: Employee[],
  includedIds: Set<string>,
  startDate: string,
  endDate: string,
  companyCycleStartDate: string
): Employee[] {
  const dates = buildDateRange(startDate, endDate);
  return employees.map((emp) => {
    if (!includedIds.has(emp.id)) {
      return { ...emp, cycleStartDate: companyCycleStartDate };
    }
    return {
      ...emp,
      cycleStartDate: companyCycleStartDate,
      schedules: buildBlankKeepingLocked(emp, dates),
    };
  });
}

/**
 * 當日是否已指派實際班別（非空）。
 * @param schedules 班表
 * @param dateStr 日期
 * @param nationalHolidays 國假
 */
function hasAssignedShift(
  schedules: Record<string, DayShift>,
  dateStr: string,
  nationalHolidays: AutoScheduleInput['nationalHolidays']
): boolean {
  const eff = getEffectiveShift(schedules, dateStr, nationalHolidays);
  return !isEmptyShiftTypeId(eff.shiftTypeId);
}

/**
 * 將有效班別映射成 ScheduleType 語意。
 * @param shiftTypeId 班別 ID
 * @param shiftTypes 班別定義
 */
function classifySlot(shiftTypeId: string, shiftTypes: ShiftType[]): SlotKind {
  if (isEmptyShiftTypeId(shiftTypeId)) return 'EMPTY';
  if (shiftTypeId === MANDATORY_ID) return 'LEAVE_7';
  if (shiftTypeId === REST_ID) return 'HOLIDAY_6';
  const st = shiftTypes.find((s) => s.id === shiftTypeId);
  if (st?.category === 'work') return 'WORK';
  // 國／調或其他非空：視為已預排，不可被動態決策／人力填班覆寫
  return 'PREASSIGNED';
}

/**
 * 試寫一班後是否仍合規（硬性錯誤）。
 * 建構過程忽略「例／休配額尚不足」，避免死結。
 * @param emp 同仁草稿
 * @param dateStr 日期
 * @param shiftTypeId 班別
 * @param input 參數
 */
function isCompliantAssignment(
  emp: Employee,
  dateStr: string,
  shiftTypeId: string,
  input: AutoScheduleInput
): boolean {
  const trialSchedules = {
    ...emp.schedules,
    [dateStr]: { date: dateStr, shiftTypeId },
  };
  const violations = checkCompliance(
    trialSchedules,
    input.startDate,
    input.endDate,
    emp.scheduleSystem || input.systemType,
    input.shiftTypes,
    input.nationalHolidays,
    input.companyCycleStartDate
  );
  const ignoreTypes = new Set([
    'insufficient_mandatory_off',
    'insufficient_rest_day',
  ]);
  return !violations.some(
    (v) => v.severity === 'error' && !ignoreTypes.has(v.type)
  );
}

/**
 * 統計連續休假評分與休假天數。
 * @param emp 同仁
 * @param dates 區間
 * @param shiftTypes 班別
 * @param nationalHolidays 國假
 */
function scoreOffQuality(
  emp: Employee,
  dates: string[],
  shiftTypes: ShiftType[],
  nationalHolidays: AutoScheduleInput['nationalHolidays']
): { consecutiveOffScore: number; offDays: number } {
  let consecutiveOffScore = 0;
  let offDays = 0;
  let run = 0;

  const isOff = (d: string) => {
    const id = getEffectiveShift(emp.schedules, d, nationalHolidays).shiftTypeId;
    if (isEmptyShiftTypeId(id)) return false;
    const st = shiftTypes.find((s) => s.id === id);
    return st?.category === 'rest' || st?.category === 'mandatory';
  };

  dates.forEach((d, idx) => {
    if (isOff(d)) {
      offDays += 1;
      run += 1;
    } else {
      if (run > 0) consecutiveOffScore += run * run;
      run = 0;
    }
    if (idx === dates.length - 1 && run > 0) {
      consecutiveOffScore += run * run;
    }
  });

  return { consecutiveOffScore, offDays };
}

/**
 * 取得同仁對班別的優先度（無設定則回傳很大）。
 * @param cfg 同仁設定
 * @param shiftTypeId 班別
 */
function getPriority(cfg: AutoScheduleEmpConfig | undefined, shiftTypeId: string): number {
  if (!cfg) return 999;
  const hit = cfg.shiftPriorities.find((p) => p.shiftTypeId === shiftTypeId);
  return hit ? hit.priority : 999;
}

/**
 * 綁定加分（次於同仁班別偏好）。
 * @param empId 同仁
 * @param dateStr 日期
 * @param shiftTypeId 目標班
 * @param working 全體草稿
 * @param input 參數
 */
function bondBonus(
  empId: string,
  dateStr: string,
  shiftTypeId: string,
  working: Employee[],
  input: AutoScheduleInput
): number {
  let score = 0;
  input.bonds.forEach((b) => {
    const partnerId =
      b.employeeIdA === empId
        ? b.employeeIdB
        : b.employeeIdB === empId
          ? b.employeeIdA
          : null;
    if (!partnerId) return;
    const partner = working.find((e) => e.id === partnerId);
    if (!partner) return;
    const pid = getEffectiveShift(
      partner.schedules,
      dateStr,
      input.nationalHolidays
    ).shiftTypeId;
    if (pid === shiftTypeId) score += 15;
    else if (!isEmptyShiftTypeId(pid) && pid !== EMPTY_SHIFT_TYPE_ID) score += 5;
  });
  return score;
}

/**
 * 統計某日某班已排人數。
 * @param working 草稿
 * @param includedIds 納入
 * @param dateStr 日期
 * @param shiftTypeId 班別
 * @param nationalHolidays 國假
 */
function countAssigned(
  working: Employee[],
  includedIds: Set<string>,
  dateStr: string,
  shiftTypeId: string,
  nationalHolidays: AutoScheduleInput['nationalHolidays']
): number {
  return working.reduce((acc, emp) => {
    if (!includedIds.has(emp.id)) return acc;
    const id = getEffectiveShift(emp.schedules, dateStr, nationalHolidays).shiftTypeId;
    return id === shiftTypeId ? acc + 1 : acc;
  }, 0);
}

/**
 * 寫入一格班別到同仁班表。
 * @param working 全體
 * @param empId 同仁
 * @param dateStr 日期
 * @param shiftTypeId 班別
 */
function assignShift(
  working: Employee[],
  empId: string,
  dateStr: string,
  shiftTypeId: string
): Employee[] {
  return working.map((e) =>
    e.id === empId
      ? {
          ...e,
          schedules: {
            ...e.schedules,
            [dateStr]: { date: dateStr, shiftTypeId },
          },
        }
      : e
  );
}

/**
 * 完整制度週期日期列。
 * @param cStartStr 週期起始日
 * @param cycleDays 天數
 */
function buildFullCycleDates(cStartStr: string, cycleDays: number): string[] {
  const cStart = parseISO(cStartStr);
  const full: string[] = [];
  for (let i = 0; i < cycleDays; i++) {
    full.push(format(addDays(cStart, i), 'yyyy-MM-dd'));
  }
  return full;
}

/**
 * 於班表上統計完整週期內例／休已佔數（含區間外既有／虛擬回填）。
 * @param schedules 班表
 * @param fullCycle 完整週期日期
 * @param nationalHolidays 國假
 */
function countCycleOffQuota(
  schedules: Record<string, DayShift>,
  fullCycle: string[],
  nationalHolidays: AutoScheduleInput['nationalHolidays']
): { leave7: number; holiday6: number } {
  let leave7 = 0;
  let holiday6 = 0;
  fullCycle.forEach((d) => {
    const id = getEffectiveShift(schedules, d, nationalHolidays).shiftTypeId;
    if (id === MANDATORY_ID) leave7 += 1;
    else if (id === REST_ID) holiday6 += 1;
  });
  return { leave7, holiday6 };
}

// ---------------------------------------------------------------------------
// 動態評分引擎（逐日：6 / 7 / WORK 候選競爭）
// ---------------------------------------------------------------------------

/** 逐日決策可選 Action（WORK 為抽象，具體班別交 ResolveDailyStaffing）。 */
type ScheduleAction = 'WORK' | 'HOLIDAY_6' | 'LEAVE_7';

/** 單一 Action 與當下動態分數。 */
interface ActionCandidate {
  action: ScheduleAction;
  score: number;
}

/**
 * 逐日決策用的同仁 State（配額依預排動態扣減，非死抓 2+2）。
 */
interface EmployeeDayState {
  remaining6: number;
  remaining7: number;
  /** 上次休假（6）之日序（0-based）；尚無則 -1。 */
  last6Index: number;
  /** 上次例假（7）之日序（0-based）；尚無則 -1。 */
  last7Index: number;
  consecutiveWork: number;
  /**
   * 已決策為抽象 WORK 的日期（班表仍留 EMPTY，供後段人力填具體班）。
   * 計入「已決策」以免急迫度把該日再當成可放假空格。
   */
  committedWorkDates: Set<string>;
}

/** 三者基礎分相同：完全靠距離／急迫／集中懲罰拉開。 */
const SCORE_BASE = 50;
/** 距離加成分：每日 +5，上限 40。 */
const DIST_PER_DAY = 5;
const DIST_CAP = 40;
/** 急迫度：remaining_quota / remaining_days * 此係數。 */
const URGENCY_RATIO_WEIGHT = 40;
/** 剩餘空格 ≤ 該假尚欠時的「必須日」加分。 */
const URGENCY_MUST_NOW = 80;

/**
 * 回傳評分用「距離天數」（今日與上次同類型假）。
 * @param dayIndex0 今日 0-based 日序
 * @param lastIndex 上次日序；無則 -1
 * @returns gap；無上次則 null
 */
function daysSinceLast(dayIndex0: number, lastIndex: number): number | null {
  if (lastIndex < 0) return null;
  return dayIndex0 - lastIndex;
}

/**
 * 長距線性加分：隔愈久愈高，有上限；從未排過視為滿分。
 * @param gap 距離天數；null＝從未
 * @returns 加分
 */
function distanceBonus(gap: number | null): number {
  if (gap === null) return DIST_CAP;
  if (gap <= 0) return 0;
  return Math.min(gap * DIST_PER_DAY, DIST_CAP);
}

/**
 * 同類型短距懲罰（剛休完同類假不宜再排）。
 * @param gap 距離；null＝無
 * @returns 懲罰分（≤0）
 */
function sameTypeShortPenalty(gap: number | null): number {
  if (gap === null) return 0;
  if (gap <= 1) return -35;
  if (gap === 2) return -20;
  if (gap === 3) return -10;
  return 0;
}

/**
 * 跨類型短距懲罰（剛排 6／7 後另一種假也稍降；同類重、跨類輕）。
 * @param gap 距離；null＝無
 * @returns 懲罰分（≤0）
 */
function crossTypeShortPenalty(gap: number | null): number {
  if (gap === null) return 0;
  if (gap <= 1) return -15;
  if (gap === 2) return -8;
  return 0;
}

/**
 * Quota 急迫度：比值漸進 + 必須日雙重。
 * @param remainingQuota 尚欠之 6 或 7
 * @param remainingEmptyDays 含今日起尚可決策的空格數
 * @returns 急迫加分
 */
function urgencyScore(remainingQuota: number, remainingEmptyDays: number): number {
  if (remainingQuota <= 0 || remainingEmptyDays <= 0) return 0;
  const ratioPart = (remainingQuota / remainingEmptyDays) * URGENCY_RATIO_WEIGHT;
  // 剩餘空格已不夠寬裕——等於或少於尚欠量時強行抬分
  const must = remainingEmptyDays <= remainingQuota ? URGENCY_MUST_NOW : 0;
  return ratioPart + must;
}

/**
 * 制度週期內例假區塊大小與每塊下限（用於後段例假保留）。
 * 2／8 週、一般：每 7 日至少 1 例；4 週（可連上 12 日）：每 14 日至少 2 例。
 * @param cycleDays 週期天數
 * @param maxConsecutiveWorkDays 連續上班上限
 * @returns 區塊長與每塊最少例假數
 */
function leave7BlockRule(
  cycleDays: number,
  maxConsecutiveWorkDays: number
): { blockSize: number; minPerBlock: number } {
  if (cycleDays <= 7) return { blockSize: 7, minPerBlock: 1 };
  if (maxConsecutiveWorkDays >= 12) return { blockSize: 14, minPerBlock: 2 };
  return { blockSize: 7, minPerBlock: 1 };
}

/**
 * 統計完整週期某日序區間內已有例假數（含班表與今日試寫）。
 * @param fullCycle 完整週期日期
 * @param schedules 班表
 * @param nationalHolidays 國假
 * @param startIdx 起（含）
 * @param endIdx 迄（不含）
 * @param todayIdx 今日日序
 * @param todayIsLeave7 今日是否試寫例假
 * @returns 例假天數
 */
function countLeave7InBlock(
  fullCycle: string[],
  schedules: Record<string, DayShift>,
  nationalHolidays: AutoScheduleInput['nationalHolidays'],
  startIdx: number,
  endIdx: number,
  todayIdx: number,
  todayIsLeave7: boolean
): number {
  let n = 0;
  for (let i = startIdx; i < endIdx; i++) {
    if (i === todayIdx && todayIsLeave7) {
      n += 1;
      continue;
    }
    const id = getEffectiveShift(schedules, fullCycle[i], nationalHolidays).shiftTypeId;
    if (id === MANDATORY_ID) n += 1;
  }
  return n;
}

/**
 * 後段例假保留：今日排例後，未來各區塊是否仍找得到足夠例假空位。
 * @param dayIndex0 今日
 * @param rem7After 排今日例後尚餘例假配額
 * @param fullCycle 完整週期
 * @param schedules 班表
 * @param committedWork 已承諾上班日
 * @param windowSet 本次可寫入的日期
 * @param nationalHolidays 國假
 * @param shiftTypes 班別
 * @param blockSize 區塊長
 * @param minPerBlock 每塊最少例假
 * @returns 可保留則 true
 */
function canReserveFutureLeave7(
  dayIndex0: number,
  rem7After: number,
  fullCycle: string[],
  schedules: Record<string, DayShift>,
  committedWork: Set<string>,
  windowSet: Set<string>,
  nationalHolidays: AutoScheduleInput['nationalHolidays'],
  shiftTypes: ShiftType[],
  blockSize: number,
  minPerBlock: number
): boolean {
  const cycleDays = fullCycle.length;
  let futureDeficit = 0;

  for (let blockStart = 0; blockStart < cycleDays; blockStart += blockSize) {
    const blockEnd = Math.min(blockStart + blockSize, cycleDays);
    // 已結束的區塊略過；目前與未來區塊才需檢查
    if (blockEnd - 1 < dayIndex0) continue;

    const placed = countLeave7InBlock(
      fullCycle,
      schedules,
      nationalHolidays,
      blockStart,
      blockEnd,
      dayIndex0,
      true
    );
    const stillNeed = Math.max(0, minPerBlock - placed);
    if (stillNeed === 0) continue;

    // 本塊今日之後（不含今日，今日已計入 placed）尚可放假的空格
    let freable = 0;
    for (let i = Math.max(dayIndex0 + 1, blockStart); i < blockEnd; i++) {
      const d = fullCycle[i];
      if (!windowSet.has(d)) continue;
      if (committedWork.has(d)) continue;
      if (isLockedDay(schedules[d])) continue;
      const id = getEffectiveShift(schedules, d, nationalHolidays).shiftTypeId;
      if (classifySlot(id, shiftTypes) === 'EMPTY') {
        freable += 1;
      }
    }
    // 空格不足以補塊內下限 → 今日不可再消耗例假配額
    if (freable < stillNeed) return false;
    futureDeficit += stillNeed;
  }

  return rem7After >= futureDeficit;
}

/**
 * 含今日起、尚未決策且可寫入的空格數（急迫度分母）。
 * @param dayIndex0 今日
 * @param fullCycle 週期
 * @param schedules 班表
 * @param committedWork 已承諾 WORK
 * @param windowSet 可寫窗
 * @param nationalHolidays 國假
 * @param shiftTypes 班別
 * @returns 剩餘空格數
 */
function countRemainingEmptyFrom(
  dayIndex0: number,
  fullCycle: string[],
  schedules: Record<string, DayShift>,
  committedWork: Set<string>,
  windowSet: Set<string>,
  nationalHolidays: AutoScheduleInput['nationalHolidays'],
  shiftTypes: ShiftType[]
): number {
  let n = 0;
  for (let i = dayIndex0; i < fullCycle.length; i++) {
    const d = fullCycle[i];
    if (!windowSet.has(d)) continue;
    if (committedWork.has(d)) continue;
    if (isLockedDay(schedules[d])) continue;
    const id = getEffectiveShift(schedules, d, nationalHolidays).shiftTypeId;
    if (classifySlot(id, shiftTypes) === 'EMPTY') n += 1;
  }
  return n;
}

/**
 * 挑選探測用工作班 ID（抽象 WORK 的合規試寫）。
 * @param emp 同仁
 * @param input 參數
 * @param cfg 同仁設定
 * @returns 工作班 ID；無則 null
 */
function pickProbeWorkShiftId(
  _emp: Employee,
  input: AutoScheduleInput,
  cfg: AutoScheduleEmpConfig | undefined
): string | null {
  const workIds = input.shiftTypes.filter((s) => s.category === 'work').map((s) => s.id);
  if (workIds.length === 0) return null;
  if (cfg?.shiftPriorities?.length) {
    const ordered = [...cfg.shiftPriorities]
      .filter((p) => workIds.includes(p.shiftTypeId))
      .sort((a, b) => a.priority - b.priority);
    if (ordered[0]) return ordered[0].shiftTypeId;
  }
  return workIds[0];
}

/**
 * 依既有班格同步 State（預排／鎖定日也要更新，否則連續上班會失真）。
 * @param state State
 * @param kind 班格語意
 * @param dayIndex0 日序
 */
function syncStateFromExistingSlot(
  state: EmployeeDayState,
  kind: SlotKind,
  dayIndex0: number
): void {
  if (kind === 'LEAVE_7') {
    state.last7Index = dayIndex0;
    state.consecutiveWork = 0;
    return;
  }
  if (kind === 'HOLIDAY_6') {
    state.last6Index = dayIndex0;
    state.consecutiveWork = 0;
    return;
  }
  if (kind === 'WORK') {
    state.consecutiveWork += 1;
    return;
  }
  // PREASSIGNED 國／調等：視為中斷連續上班
  if (kind === 'PREASSIGNED') {
    state.consecutiveWork = 0;
  }
}

/**
 * 硬性 Filter：違法直接剔除（分數不參與）。
 * @param action 候選
 * @param emp 同仁
 * @param dateStr 日期
 * @param dayIndex0 日序
 * @param state State
 * @param fullCycle 週期
 * @param windowSet 可寫窗
 * @param input 參數
 * @param cfg 同仁設定
 * @param maxConsecutive 連續上班上限
 * @param blockSize 例假區塊長
 * @param minPerBlock 每塊最少例
 * @param remainingEmpty 含今日剩餘空格
 * @returns 可排則 true
 */
function canPlaceAction(
  action: ScheduleAction,
  emp: Employee,
  dateStr: string,
  dayIndex0: number,
  state: EmployeeDayState,
  fullCycle: string[],
  windowSet: Set<string>,
  input: AutoScheduleInput,
  cfg: AutoScheduleEmpConfig | undefined,
  maxConsecutive: number,
  blockSize: number,
  minPerBlock: number,
  remainingEmpty: number
): boolean {
  if (!windowSet.has(dateStr)) return false;
  if (state.committedWorkDates.has(dateStr)) return false;
  if (isLockedDay(emp.schedules[dateStr])) return false;
  if (hasAssignedShift(emp.schedules, dateStr, input.nationalHolidays)) return false;

  if (action === 'HOLIDAY_6') {
    if (state.remaining6 <= 0) return false;
    if (!isCompliantAssignment(emp, dateStr, REST_ID, input)) return false;
    // 放假後仍需保住例／休假總空位
    if (remainingEmpty - 1 < state.remaining7 + (state.remaining6 - 1)) return false;
    return true;
  }

  if (action === 'LEAVE_7') {
    if (state.remaining7 <= 0) return false;
    if (!isCompliantAssignment(emp, dateStr, MANDATORY_ID, input)) return false;
    if (remainingEmpty - 1 < state.remaining6 + (state.remaining7 - 1)) return false;
    // 後段例假區塊保留，避免第二個例假過早耗盡
    if (
      !canReserveFutureLeave7(
        dayIndex0,
        state.remaining7 - 1,
        fullCycle,
        emp.schedules,
        state.committedWorkDates,
        windowSet,
        input.nationalHolidays,
        input.shiftTypes,
        blockSize,
        minPerBlock
      )
    ) {
      return false;
    }
    return true;
  }

  // WORK：須保留足夠空格給尚欠休例；且不可突破連續上班
  if (remainingEmpty <= state.remaining6 + state.remaining7) return false;
  if (state.consecutiveWork + 1 > maxConsecutive) return false;
  const probe = pickProbeWorkShiftId(emp, input, cfg);
  if (!probe) return false;
  return isCompliantAssignment(emp, dateStr, probe, input);
}

/**
 * 動態分數：基礎分相同，再加距離／急迫／集中（跨類輕）懲罰。
 * @param action 候選
 * @param dayIndex0 今日
 * @param state State
 * @param remainingEmpty 剩餘空格
 * @returns 綜合分數
 */
function calculateActionScore(
  action: ScheduleAction,
  dayIndex0: number,
  state: EmployeeDayState,
  remainingEmpty: number
): number {
  let score = SCORE_BASE;

  if (action === 'LEAVE_7') {
    const gap7 = daysSinceLast(dayIndex0, state.last7Index);
    const gap6 = daysSinceLast(dayIndex0, state.last6Index);
    score += distanceBonus(gap7);
    score += sameTypeShortPenalty(gap7);
    score += crossTypeShortPenalty(gap6);
    score += urgencyScore(state.remaining7, remainingEmpty);
  } else if (action === 'HOLIDAY_6') {
    const gap6 = daysSinceLast(dayIndex0, state.last6Index);
    const gap7 = daysSinceLast(dayIndex0, state.last7Index);
    score += distanceBonus(gap6);
    score += sameTypeShortPenalty(gap6);
    score += crossTypeShortPenalty(gap7);
    score += urgencyScore(state.remaining6, remainingEmpty);
  }
  // WORK：中性基礎分；當 6／7 因距離近而被拉開時自然凸顯

  return score;
}

/**
 * 建立當日合法候選（先 Filter 再 Score）。
 * @param emp 同仁
 * @param dateStr 日期
 * @param dayIndex0 日序
 * @param state State
 * @param fullCycle 週期
 * @param windowSet 可寫窗
 * @param input 參數
 * @param cfg 設定
 * @param maxConsecutive 連上上限
 * @param blockSize 例假塊
 * @param minPerBlock 每塊最少例
 * @returns 候選清單
 */
function buildActionCandidates(
  emp: Employee,
  dateStr: string,
  dayIndex0: number,
  state: EmployeeDayState,
  fullCycle: string[],
  windowSet: Set<string>,
  input: AutoScheduleInput,
  cfg: AutoScheduleEmpConfig | undefined,
  maxConsecutive: number,
  blockSize: number,
  minPerBlock: number
): ActionCandidate[] {
  const remainingEmpty = countRemainingEmptyFrom(
    dayIndex0,
    fullCycle,
    emp.schedules,
    state.committedWorkDates,
    windowSet,
    input.nationalHolidays,
    input.shiftTypes
  );

  const actions: ScheduleAction[] = ['HOLIDAY_6', 'LEAVE_7', 'WORK'];
  const out: ActionCandidate[] = [];
  for (const action of actions) {
    if (
      !canPlaceAction(
        action,
        emp,
        dateStr,
        dayIndex0,
        state,
        fullCycle,
        windowSet,
        input,
        cfg,
        maxConsecutive,
        blockSize,
        minPerBlock,
        remainingEmpty
      )
    ) {
      continue;
    }
    out.push({
      action,
      score: calculateActionScore(action, dayIndex0, state, remainingEmpty),
    });
  }
  return out;
}

/**
 * 套用 Action並更新 State；WORK 只承諾不寫班別。
 * @param emp 同仁
 * @param dateStr 日期
 * @param dayIndex0 日序
 * @param action Action
 * @param state State
 * @returns 更新後同仁
 */
function applyAction(
  emp: Employee,
  dateStr: string,
  dayIndex0: number,
  action: ScheduleAction,
  state: EmployeeDayState
): Employee {
  if (action === 'LEAVE_7') {
    state.remaining7 -= 1;
    state.last7Index = dayIndex0;
    state.consecutiveWork = 0;
    return {
      ...emp,
      schedules: {
        ...emp.schedules,
        [dateStr]: { date: dateStr, shiftTypeId: MANDATORY_ID },
      },
    };
  }
  if (action === 'HOLIDAY_6') {
    state.remaining6 -= 1;
    state.last6Index = dayIndex0;
    state.consecutiveWork = 0;
    return {
      ...emp,
      schedules: {
        ...emp.schedules,
        [dateStr]: { date: dateStr, shiftTypeId: REST_ID },
      },
    };
  }
  // 抽象 WORK：班表保持 EMPTY，交後段 ResolveDailyStaffing 選具體班
  state.committedWorkDates.add(dateStr);
  state.consecutiveWork += 1;
  return emp;
}

/**
 * 單一制度週期：逐日動態決策 6／7／WORK。
 * 配額 = max(0, 法定下限 − 週期內已預排數)；達標／超標則 remaining=0 並可警告。
 * @param emp 同仁
 * @param cStartStr 週期起
 * @param cycleDatesInWindow 落入排班窗的日期
 * @param input 參數
 * @param cfg 同仁設定
 * @returns 更新後同仁
 */
function allocateCycleByDailyScore(
  emp: Employee,
  cStartStr: string,
  cycleDatesInWindow: string[],
  input: AutoScheduleInput,
  cfg: AutoScheduleEmpConfig | undefined
): Employee {
  const system = emp.scheduleSystem || input.systemType;
  const config = SYSTEM_CONFIGS[system];
  const fullCycle = buildFullCycleDates(cStartStr, config.cycleDays);
  const windowSet = new Set(cycleDatesInWindow);
  const counted = countCycleOffQuota(
    emp.schedules,
    fullCycle,
    input.nationalHolidays
  );

  // 預排達標／超標 → remaining 歸 0，不再排更多 6／7
  const remaining6 = Math.max(0, config.minRestDaysPerCycle - counted.holiday6);
  const remaining7 = Math.max(0, config.minMandatoryOffPerCycle - counted.leave7);

  if (counted.holiday6 > config.minRestDaysPerCycle) {
    console.warn(
      `[autoSchedule] Employee ${emp.id} 週期 ${cStartStr} 預排休假已超法定下限（${counted.holiday6}/${config.minRestDaysPerCycle}），不再追加休假。`
    );
  }
  if (counted.leave7 > config.minMandatoryOffPerCycle) {
    console.warn(
      `[autoSchedule] Employee ${emp.id} 週期 ${cStartStr} 預排例假已超法定下限（${counted.leave7}/${config.minMandatoryOffPerCycle}），不再追加例假。`
    );
  }

  const { blockSize, minPerBlock } = leave7BlockRule(
    config.cycleDays,
    config.maxConsecutiveWorkDays
  );

  const state: EmployeeDayState = {
    remaining6,
    remaining7,
    last6Index: -1,
    last7Index: -1,
    consecutiveWork: 0,
    committedWorkDates: new Set(),
  };

  let current = emp;

  for (let dayIndex0 = 0; dayIndex0 < fullCycle.length; dayIndex0++) {
    const dateStr = fullCycle[dayIndex0];
    const effId = getEffectiveShift(
      current.schedules,
      dateStr,
      input.nationalHolidays
    ).shiftTypeId;
    const kind = classifySlot(effId, input.shiftTypes);

    // 已預排／非空：只同步 State，不覆寫
    if (kind !== 'EMPTY') {
      syncStateFromExistingSlot(state, kind, dayIndex0);
      continue;
    }
    // 窗外空格無法寫入，略過（不消費配額決策）
    if (!windowSet.has(dateStr)) {
      continue;
    }

    const candidates = buildActionCandidates(
      current,
      dateStr,
      dayIndex0,
      state,
      fullCycle,
      windowSet,
      input,
      cfg,
      config.maxConsecutiveWorkDays,
      blockSize,
      minPerBlock
    );

    if (candidates.length === 0) {
      // 暫時無法決定：保留 EMPTY
      continue;
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    current = applyAction(current, dateStr, dayIndex0, best.action, state);
  }

  if (state.remaining6 > 0 || state.remaining7 > 0) {
    console.warn(
      `[autoSchedule] Employee ${emp.id} 週期 ${cStartStr} Quota 未完成（尚欠休 ${state.remaining6}、例 ${state.remaining7}）。`
    );
  }

  return current;
}

/**
 * 單一同仁：對每個落入視窗的制度週期執行逐日動態評分排班（Phase 1）。
 * @param emp 同仁
 * @param dates 排班區間
 * @param input 參數
 * @param cfg 同仁設定
 * @returns 更新後同仁
 */
function allocateEmployeeOffDays(
  emp: Employee,
  dates: string[],
  input: AutoScheduleInput,
  cfg: AutoScheduleEmpConfig | undefined
): Employee {
  const system = emp.scheduleSystem || input.systemType;
  const config = SYSTEM_CONFIGS[system];
  const byCycle = new Map<string, string[]>();

  dates.forEach((d) => {
    const info = getCycleInfoForDate(
      d,
      config.cycleDays,
      input.companyCycleStartDate
    );
    const list = byCycle.get(info.cStartStr) ?? [];
    list.push(d);
    byCycle.set(info.cStartStr, list);
  });

  let current = emp;
  byCycle.forEach((cycleDatesInWindow, cStartStr) => {
    current = allocateCycleByDailyScore(
      current,
      cStartStr,
      cycleDatesInWindow,
      input,
      cfg
    );
  });
  return current;
}

/**
 * Phase 3：能否在本日排指定工作班（連續天數／時數等硬約束）。
 * @param emp 同仁
 * @param dateStr 日期
 * @param shiftTypeId 工作班
 * @param input 參數
 */
function canWorkOnDay(
  emp: Employee,
  dateStr: string,
  shiftTypeId: string,
  input: AutoScheduleInput
): boolean {
  if (hasAssignedShift(emp.schedules, dateStr, input.nationalHolidays)) return false;
  if (isLockedDay(emp.schedules[dateStr])) return false;
  return isCompliantAssignment(emp, dateStr, shiftTypeId, input);
}

/**
 * Phase 3：挑選最佳上班候選人。
 * @param working 全員
 * @param includedIds 納入
 * @param dateStr 日期
 * @param shiftTypeId 班別
 * @param input 參數
 * @param cfgById 設定
 * @param ignorePreference 是否忽略班別偏好（A．relax_pref）
 */
function findBestWorkCandidate(
  working: Employee[],
  includedIds: Set<string>,
  dateStr: string,
  shiftTypeId: string,
  input: AutoScheduleInput,
  cfgById: Map<string, AutoScheduleEmpConfig>,
  ignorePreference: boolean
): Employee | null {
  let best: Employee | null = null;
  let bestScore = -Infinity;

  working.forEach((emp) => {
    if (!includedIds.has(emp.id)) return;
    const kind = classifySlot(
      getEffectiveShift(emp.schedules, dateStr, input.nationalHolidays).shiftTypeId,
      input.shiftTypes
    );
    // 只針對 EMPTY 填 WORK；已是 WORK/6/7/N 者跳過
    if (kind !== 'EMPTY') return;

    const cfg = cfgById.get(emp.id);
    const prio = getPriority(cfg, shiftTypeId);
    if (!ignorePreference && prio >= 999) return;
    if (!canWorkOnDay(emp, dateStr, shiftTypeId, input)) return;

    const score =
      10_000 -
      (prio >= 999 ? 50 : prio) * 100 +
      bondBonus(emp.id, dateStr, shiftTypeId, working, input);
    if (score > bestScore) {
      bestScore = score;
      best = emp;
    }
  });

  return best;
}

/**
 * B＝prefer_off：多餘空日填休／例優化連休（已達法定下限後的軟塞）。
 * @param emp 同仁
 * @param dates 區間
 * @param input 參數
 */
function fillSurplusPreferOff(
  emp: Employee,
  dates: string[],
  input: AutoScheduleInput
): Record<string, DayShift> {
  let schedules = { ...emp.schedules };
  const empView = (): Employee => ({ ...emp, schedules });

  dates.forEach((dateStr) => {
    if (hasAssignedShift(schedules, dateStr, input.nationalHolidays)) return;
    if (isLockedDay(schedules[dateStr])) return;

    let bestId: string | null = null;
    let bestScore = -Infinity;
    [REST_ID, MANDATORY_ID].forEach((optId) => {
      if (!isCompliantAssignment(empView(), dateStr, optId, input)) return;
      const trialEmp: Employee = {
        ...emp,
        schedules: {
          ...schedules,
          [dateStr]: { date: dateStr, shiftTypeId: optId },
        },
      };
      const q = scoreOffQuality(
        trialEmp,
        dates,
        input.shiftTypes,
        input.nationalHolidays
      );
      const score = q.consecutiveOffScore * 100 + q.offDays;
      if (score > bestScore) {
        bestScore = score;
        bestId = optId;
      }
    });
    if (bestId) {
      schedules = {
        ...schedules,
        [dateStr]: { date: dateStr, shiftTypeId: bestId },
      };
    } else {
      schedules = {
        ...schedules,
        [dateStr]: { date: dateStr, shiftTypeId: EMPTY_SHIFT_TYPE_ID },
      };
    }
  });

  return schedules;
}

/**
 * 一鍵自動排班（對齊 GenerateRoster）：
 * Phase 1 逐日動態評分（6／7／抽象 WORK，配額依預排扣減）→ Phase 3 ResolveDailyStaffing 填具體班；
 * 並融入 A（缺口留空／放寬偏好）與 B（過剩塞班／偏好休例）。
 * @param input 參數
 * @returns 結果
 */
export function runAutoSchedule(input: AutoScheduleInput): AutoScheduleResult {
  const dates = buildDateRange(input.startDate, input.endDate);
  const includedIds = new Set(
    input.empConfigs.filter((c) => c.included).map((c) => c.employeeId)
  );
  const cfgById = new Map(input.empConfigs.map((c) => [c.employeeId, c]));
  const shortagePolicy: AutoScheduleShortagePolicy =
    input.shortagePolicy ?? 'keep_empty';
  const surplusPolicy: AutoScheduleSurplusPolicy =
    input.surplusPolicy ?? 'pack_work';
  // --- 起始班表 ---
  let working: Employee[] = input.employees.map((emp) => {
    if (!includedIds.has(emp.id)) {
      const baseline = input.baselineEmployees?.find((b) => b.id === emp.id);
      return baseline
        ? { ...baseline, cycleStartDate: input.companyCycleStartDate }
        : emp;
    }
    if (input.skipInitialBlank) {
      return { ...emp, cycleStartDate: input.companyCycleStartDate };
    }
    return {
      ...emp,
      cycleStartDate: input.companyCycleStartDate,
      schedules: buildBlankKeepingLocked(emp, dates),
    };
  });

  const workShiftIds = input.shiftTypes
    .filter((s) => s.category === 'work')
    .map((s) => s.id);

  // --- Phase 1：逐日動態評分配置例／休／抽象 WORK（配額扣預排）---
  working = working.map((emp) => {
    if (!includedIds.has(emp.id)) return emp;
    return allocateEmployeeOffDays(emp, dates, input, cfgById.get(emp.id));
  });

  const uncovered: AutoScheduleResult['uncovered'] = [];

  // --- Phase 3：順向依每日人力填 WORK（不能排＝CanWorkOnDay 否決）---
  dates.forEach((dateStr) => {
    const weekday = parseISO(dateStr).getDay();
    const dayNeeds = input.staffing.filter(
      (s) =>
        s.weekday === weekday && s.headcount > 0 && workShiftIds.includes(s.shiftTypeId)
    );

    dayNeeds.forEach((need) => {
      let assigned = countAssigned(
        working,
        includedIds,
        dateStr,
        need.shiftTypeId,
        input.nationalHolidays
      );

      while (assigned < need.headcount) {
        let candidate = findBestWorkCandidate(
          working,
          includedIds,
          dateStr,
          need.shiftTypeId,
          input,
          cfgById,
          false
        );
        // A：合規下放寬偏好再找人
        if (!candidate && shortagePolicy === 'relax_pref') {
          candidate = findBestWorkCandidate(
            working,
            includedIds,
            dateStr,
            need.shiftTypeId,
            input,
            cfgById,
            true
          );
        }

        if (!candidate) {
          // keep_empty／放寬後仍不足 → 留空並提醒
          uncovered.push({
            date: dateStr,
            shiftTypeId: need.shiftTypeId,
            missing: need.headcount - assigned,
          });
          break;
        }

        working = assignShift(working, candidate.id, dateStr, need.shiftTypeId);
        assigned += 1;
      }
    });
  });

  // --- B：班少人多 ---
  if (surplusPolicy === 'pack_work') {
    // 達標後仍可塞偏好工作班
    dates.forEach((dateStr) => {
      const ids = working.filter((e) => includedIds.has(e.id)).map((e) => e.id);
      ids.forEach((empId) => {
        const emp = working.find((e) => e.id === empId);
        if (!emp) return;
        if (hasAssignedShift(emp.schedules, dateStr, input.nationalHolidays)) return;
        if (isLockedDay(emp.schedules[dateStr])) return;

        const cfg = cfgById.get(emp.id);
        const ordered = [...(cfg?.shiftPriorities ?? [])]
          .filter((p) => workShiftIds.includes(p.shiftTypeId))
          .sort((a, b) => {
            const sa =
              -a.priority * 100 +
              bondBonus(emp.id, dateStr, a.shiftTypeId, working, input);
            const sb =
              -b.priority * 100 +
              bondBonus(emp.id, dateStr, b.shiftTypeId, working, input);
            return sb - sa;
          });

        for (const p of ordered) {
          if (!canWorkOnDay(emp, dateStr, p.shiftTypeId, input)) continue;
          working = assignShift(working, emp.id, dateStr, p.shiftTypeId);
          break;
        }
      });
    });
  } else {
    // prefer_off：多餘空日改休／例優化連休
    working = working.map((emp) => {
      if (!includedIds.has(emp.id)) return emp;
      return {
        ...emp,
        schedules: fillSurplusPreferOff(emp, dates, input),
      };
    });
  }

  // pack_work 路徑：殘餘空班明確保留哨兵，避免被虛擬六休七例回填誤導
  if (surplusPolicy === 'pack_work') {
    working = working.map((emp) => {
      if (!includedIds.has(emp.id)) return emp;
      const schedules = { ...emp.schedules };
      dates.forEach((dateStr) => {
        if (hasAssignedShift(schedules, dateStr, input.nationalHolidays)) return;
        if (isLockedDay(schedules[dateStr])) return;
        schedules[dateStr] = { date: dateStr, shiftTypeId: EMPTY_SHIFT_TYPE_ID };
      });
      return { ...emp, schedules };
    });
  }

  // --- 品質統計 ---
  let consecutiveOffScore = 0;
  let totalOffDays = 0;
  let employeesWithViolations = 0;

  working.forEach((emp) => {
    if (!includedIds.has(emp.id)) return;
    const q = scoreOffQuality(emp, dates, input.shiftTypes, input.nationalHolidays);
    consecutiveOffScore += q.consecutiveOffScore;
    totalOffDays += q.offDays;
    const violations = checkCompliance(
      emp.schedules,
      input.startDate,
      input.endDate,
      emp.scheduleSystem || input.systemType,
      input.shiftTypes,
      input.nationalHolidays,
      input.companyCycleStartDate
    );
    if (violations.some((v) => v.severity === 'error')) {
      employeesWithViolations += 1;
    }
  });

  return {
    employees: working,
    uncovered,
    employeesWithViolations,
    consecutiveOffScore,
    totalOffDays,
  };
}

/**
 * 依同仁是否已有（非空）排班，建議是否預設納入一鍵排班。
 * @param emp 同仁
 * @param startDate 區間起
 * @param endDate 區間迄
 * @param nationalHolidays 國假
 * @returns 有預排則 true
 */
export function employeeHasPreScheduledShifts(
  emp: Employee,
  startDate: string,
  endDate: string,
  nationalHolidays: AutoScheduleInput['nationalHolidays']
): boolean {
  const dates = buildDateRange(startDate, endDate);
  return dates.some((d) => {
    const day = emp.schedules[d];
    if (isLockedDay(day)) return true;
    const id = getEffectiveShift(emp.schedules, d, nationalHolidays).shiftTypeId;
    return !isEmptyShiftTypeId(id);
  });
}
