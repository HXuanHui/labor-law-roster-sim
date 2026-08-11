import React, { useState, useEffect, useMemo } from 'react';
import {
  DayShift,
  Employee,
  LaborRuleViolation,
  NationalHoliday,
  ScheduleSystemType,
  ShiftType,
  SnapResult,
} from './types';
import { DEFAULT_SHIFTS, EMPTY_SHIFT_TYPE_ID, ensureDefaultShifts, resolveHolidayShiftTypeId } from './constants/shifts';
import { SYSTEM_CONFIGS } from './constants/systems';
import {
  getMaxDailyOvertimeHours,
  snapOvertimeHours,
  OVERTIME_STEP_HOURS,
  canLogOvertimeOnCategory,
  MANDATORY_OVERTIME_REMINDER,
} from './constants/overtime';
import { INITIAL_TAIWAN_HOLIDAYS } from './constants/taiwanHolidays';
import {
  checkCompliance,
  countsTowardMandatoryOff,
  countsTowardRestDay,
  findNearestLegalDate,
  getEffectiveShift,
  getShiftType,
  isWorkShift,
  getCycleInfoForDate,
  requiresMandatoryOvertimeCaution,
} from './utils/laborLaws';
import { Header } from './components/Header';
import { SystemSelectorBar } from './components/SystemSelectorBar';
import { CalendarMonthView } from './components/CalendarMonthView';
import { RosterTimelineView } from './components/RosterTimelineView';
import { LaborAuditPanel } from './components/LaborAuditPanel';
import { NationalHolidaySettingsModal } from './components/NationalHolidaySettingsModal';
import { ShiftSettingsModal } from './components/ShiftSettingsModal';
import { EmployeeSettingsModal } from './components/EmployeeSettingsModal';
import { SetupWizardModal } from './components/SetupWizardModal';
import { UserGuideModal } from './components/UserGuideModal';
import { DisclaimerModal } from './components/DisclaimerModal';
import { LegalInfoModal } from './components/LegalInfoModal';
import { ExportCalendarModal } from './components/ExportCalendarModal';
import { AboutModal } from './components/AboutModal';
import {
  collectNationalShiftCandidates,
  MakeupSourcePickerModal,
} from './components/MakeupSourcePickerModal';
import { buildMakeupHolidayName } from './utils/holidayMakeup';
import { Calendar, LayoutGrid, Sparkles } from 'lucide-react';
import { addDays, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';

export default function App() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
  const [currentSystem, setCurrentSystem] = useState<ScheduleSystemType>('2-week');
  const [viewMode, setViewMode] = useState<'month' | 'timeline'>('month');
  /** 矩陣檢視捲動起始日（可與月曆當月 1 日不同，支援前／後 N 天） */
  const [timelineStartDateStr, setTimelineStartDateStr] = useState(() =>
    format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd')
  );

  // Modals state
  const [isHolidaysModalOpen, setIsHolidaysModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isUserGuideModalOpen, setIsUserGuideModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDisclaimerModalOpen, setIsDisclaimerModalOpen] = useState(false);
  const [isLegalInfoModalOpen, setIsLegalInfoModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  /** 初始化完成後：關閉使用說明時再自動開啟免責說明。 */
  const [openDisclaimerAfterGuide, setOpenDisclaimerAfterGuide] = useState(false);

  // Setup Wizard panel state (open by default if no saved employees exist)
  const [isSetupWizardModalOpen, setIsSetupWizardModalOpen] = useState(() => {
    const savedEmp = localStorage.getItem('perpetual_employees');
    const isCompleted = localStorage.getItem('perpetual_setup_completed');
    if (!savedEmp || !isCompleted) return true;
    try {
      const parsed = JSON.parse(savedEmp);
      return parsed.length === 0;
    } catch {
      return true;
    }
  });

  // Data states with LocalStorage persistence
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>(() => {
    const saved = localStorage.getItem('perpetual_shifts');
    // 合併內建班別，確保舊資料也能取得新增的「調」班
    return ensureDefaultShifts(saved ? JSON.parse(saved) : DEFAULT_SHIFTS);
  });

  const [nationalHolidays, setNationalHolidays] = useState<NationalHoliday[]>(() => {
    const saved = localStorage.getItem('perpetual_national_holidays');
    return saved ? JSON.parse(saved) : INITIAL_TAIWAN_HOLIDAYS;
  });

  // Requirement 4: Do not provide default sample employees (張大明, etc.) when there is no saved data
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('perpetual_employees');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(employees[0]?.id || '');
  const [highlightDates, setHighlightDates] = useState<string[]>([]);
  const [snappedFeedback, setSnappedFeedback] = useState<SnapResult | null>(null);
  /**
   * 手動套用「調」時的待確認上下文（需指定畫面上哪個「國」班）。
   */
  const [makeupPick, setMakeupPick] = useState<{
    empId: string;
    targetDates: string[];
  } | null>(null);

  // Sync selected employee id when employees change
  useEffect(() => {
    if (employees.length > 0 && (!selectedEmployeeId || !employees.some((e) => e.id === selectedEmployeeId))) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  // Sync system changes to selected employee as well
  const handleSelectSystem = (sys: ScheduleSystemType) => {
    setCurrentSystem(sys);
    setEmployees((prev) =>
      prev.map((e) => (e.id === selectedEmployeeId ? { ...e, scheduleSystem: sys } : e))
    );
  };

  // Requirement 1: Clear all saved data in LocalStorage
  const handleClearAllData = () => {
    if (
      window.confirm(
        '確定要【一鍵刪除所有已儲存的資料】嗎？\n\n此動作將清空 LocalStorage 中的：\n1. 所有排班同仁名單與班表紀錄\n2. 自訂班別設定\n3. 自訂國定假日\n\n清除後將回復至初始設定導引 Panel 面板。'
      )
    ) {
      localStorage.removeItem('perpetual_shifts');
      localStorage.removeItem('perpetual_national_holidays');
      localStorage.removeItem('perpetual_employees');
      localStorage.removeItem('perpetual_setup_completed');

      setShiftTypes(DEFAULT_SHIFTS);
      setNationalHolidays(INITIAL_TAIWAN_HOLIDAYS);
      setEmployees([]);
      setSelectedEmployeeId('');
      setHighlightDates([]);
      setSnappedFeedback(null);
      setIsSetupWizardModalOpen(true);
    }
  };

  // Auto-dismiss snappedFeedback after 4 seconds
  useEffect(() => {
    if (!snappedFeedback) return;
    const timer = setTimeout(() => {
      setSnappedFeedback(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [snappedFeedback]);

  useEffect(() => {
    localStorage.setItem('perpetual_shifts', JSON.stringify(shiftTypes));
  }, [shiftTypes]);

  useEffect(() => {
    localStorage.setItem('perpetual_national_holidays', JSON.stringify(nationalHolidays));
  }, [nationalHolidays]);

  useEffect(() => {
    localStorage.setItem('perpetual_employees', JSON.stringify(employees));
  }, [employees]);

  // Active employee object
  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmployeeId) || employees[0];
  }, [employees, selectedEmployeeId]);

  // Window date range for current view evaluation
  const monthStartDateStr = format(new Date(currentYear, currentMonth - 1, 1), 'yyyy-MM-dd');
  const monthEndDateStr = format(endOfMonth(new Date(currentYear, currentMonth - 1, 1)), 'yyyy-MM-dd');

  // Evaluate Compliance for active employee
  const violations: LaborRuleViolation[] = useMemo(() => {
    if (!selectedEmployee) return [];
    return checkCompliance(
      selectedEmployee.schedules,
      monthStartDateStr,
      monthEndDateStr,
      currentSystem,
      shiftTypes,
      nationalHolidays,
      selectedEmployee.cycleStartDate
    );
  }, [selectedEmployee, monthStartDateStr, monthEndDateStr, currentSystem, shiftTypes, nationalHolidays]);

  // Auto-clear highlightDates when violations are resolved
  useEffect(() => {
    const activeViolationDates = new Set(
      violations.flatMap((v) => v.dates || [])
    );
    setHighlightDates((prev) => prev.filter((d) => activeViolationDates.has(d)));
  }, [violations]);

  // Calculate statistics for active employee in current cycle / month
  const {
    totalWorkHours,
    totalOvertimeHours,
    maxConsecutiveDays,
    mandatoryOffCount,
    restDayCount,
    nationalHolidayWorkCount,
    compLeaveBankHours,
  } = useMemo(() => {
    if (!selectedEmployee) {
      return {
        totalWorkHours: 0,
        totalOvertimeHours: 0,
        maxConsecutiveDays: 0,
        mandatoryOffCount: 0,
        restDayCount: 0,
        nationalHolidayWorkCount: 0,
        compLeaveBankHours: 0,
      };
    }

    const system = currentSystem || selectedEmployee.scheduleSystem || '2-week';
    const cycleDays = system === '2-week' ? 14 : system === '4-week' ? 28 : system === '8-week' ? 56 : 7;

    const start = parseISO(monthStartDateStr);
    const end = parseISO(monthEndDateStr);

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const refDateStr =
      todayStr >= monthStartDateStr && todayStr <= monthEndDateStr
        ? todayStr
        : monthStartDateStr;

    const refCycle = getCycleInfoForDate(refDateStr, cycleDays, selectedEmployee.cycleStartDate);

    let hours = 0;
    let mandatory = 0;
    let rest = 0;
    let natWork = 0;

    for (let i = 0; i < cycleDays; i++) {
      const cDate = addDays(refCycle.cStart, i);
      const dStr = format(cDate, 'yyyy-MM-dd');
      const dayShift = getEffectiveShift(selectedEmployee.schedules, dStr, nationalHolidays);
      const shiftType = getShiftType(dayShift.shiftTypeId, shiftTypes);
      const isNat = nationalHolidays.some((h) => h.date === dStr);

      if (shiftType) {
        if (shiftType.category === 'work') {
          hours += shiftType.workHours;
          if (isNat) natWork++;
        } else if (countsTowardMandatoryOff(shiftType.category, dStr, nationalHolidays, selectedEmployee.schedules)) {
          mandatory++;
        } else if (countsTowardRestDay(shiftType.category, dStr, nationalHolidays, selectedEmployee.schedules)) {
          rest++;
        }
      }
    }

    let monthOt = 0;
    let monthCompLeave = 0;
    let d = start;
    let curConsecutive = 0;
    let maxConsecutive = 0;

    while (d <= end) {
      const dStr = format(d, 'yyyy-MM-dd');
      const dayShift = getEffectiveShift(selectedEmployee.schedules, dStr, nationalHolidays);
      const shiftType = getShiftType(dayShift.shiftTypeId, shiftTypes);
      const stored = selectedEmployee.schedules[dStr];

      if (stored?.overtimeHours) monthOt += stored.overtimeHours;
      if (stored?.compLeaveHours) monthCompLeave += stored.compLeaveHours;

      if (shiftType && shiftType.category === 'work') {
        curConsecutive++;
        if (curConsecutive > maxConsecutive) maxConsecutive = curConsecutive;
      } else {
        curConsecutive = 0;
      }

      d = addDays(d, 1);
    }

    monthOt = Math.round(monthOt * 10) / 10;
    monthCompLeave = Math.round(monthCompLeave * 10) / 10;

    return {
      totalWorkHours: hours,
      totalOvertimeHours: monthOt,
      maxConsecutiveDays: maxConsecutive,
      mandatoryOffCount: mandatory,
      restDayCount: rest,
      nationalHolidayWorkCount: natWork,
      compLeaveBankHours: Math.max(0, Math.round((monthOt - monthCompLeave) * 10) / 10),
    };
  }, [selectedEmployee, currentSystem, monthStartDateStr, monthEndDateStr, shiftTypes, nationalHolidays]);

  /**
   * 單日改班：釘選日略過；「空」寫入哨兵以清除排班（不可 delete，否則會回填六休七例）。
   * 套用「國」時若假日清單尚無該日，一併補登記，方便之後「調」可對應畫面上國班。
   * @param empId 同仁 ID
   * @param dateStr 日期
   * @param shiftTypeId 目標班別；EMPTY_SHIFT_TYPE_ID 表示清除
   */
  const handleSelectShift = (empId: string, dateStr: string, shiftTypeId: string) => {
    // 「調」必須經挑選來源「國」班，不可直接寫入
    if (shiftTypeId === 'shift_national_holiday_makeup') {
      setMakeupPick({ empId, targetDates: [dateStr] });
      return;
    }

    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id !== empId) return e;
        if (e.schedules[dateStr]?.isPinned) return e;
        const newSched = { ...e.schedules };
        // 空班＝刪除當天排班本體；保留鍵值以免 getEffectiveShift 回填休／例／早班
        if (shiftTypeId === EMPTY_SHIFT_TYPE_ID) {
          newSched[dateStr] = { date: dateStr, shiftTypeId: EMPTY_SHIFT_TYPE_ID };
        } else {
          // 清掉舊的調班對應欄位，避免換成其他班別後仍殘留替休標記
          newSched[dateStr] = {
            date: dateStr,
            shiftTypeId,
            note: e.schedules[dateStr]?.note,
            overtimeHours: e.schedules[dateStr]?.overtimeHours,
            compLeaveHours: e.schedules[dateStr]?.compLeaveHours,
            isPinned: e.schedules[dateStr]?.isPinned,
          };
        }
        return {
          ...e,
          schedules: newSched,
        };
      })
    );

    // 手動排「國」：同步補登記假日清單（無則新增），讓之後選「調」能對到
    if (shiftTypeId === 'shift_national_holiday') {
      setNationalHolidays((prev) => {
        if (prev.some((h) => h.date === dateStr)) return prev;
        return [
          ...prev,
          {
            id: `hol_custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            date: dateStr,
            name: '國定假日（手動排班）',
            isStatutory: false,
            kind: 'original',
          },
        ];
      });
    }
  };

  /**
   * 手動「調」：依選定的畫面上「國」班寫入替休／例標記，並同步假日清單。
   * @param sourceDate 來源「國」班日期
   * @param substitutesFor 審查計入休息日或例假日
   */
  const handleConfirmMakeupLink = (
    sourceDate: string,
    substitutesFor: 'rest' | 'mandatory'
  ) => {
    if (!makeupPick) return;
    const { empId, targetDates } = makeupPick;
    // 一對一：單一來源國假對應一個補假日（多選時取第一個未釘選目標）
    const targetDate = targetDates[0];
    if (!targetDate) {
      setMakeupPick(null);
      return;
    }

    const emp = employees.find((e) => e.id === empId);
    const sourceLabel =
      nationalHolidays.find((h) => h.date === sourceDate && h.kind !== 'makeup')?.name ||
      '國定假日';

    setNationalHolidays((prev) => {
      let next = [...prev];
      // 來源日若尚不在清單（僅有班表「國」），補上原日記錄
      if (!next.some((h) => h.date === sourceDate && h.kind !== 'makeup')) {
        next.push({
          id: `hol_custom_${Date.now()}_src_${Math.random().toString(36).slice(2, 7)}`,
          date: sourceDate,
          name: sourceLabel === '國定假日' ? '國定假日（手動排班）' : sourceLabel,
          isStatutory: false,
          kind: 'original',
        });
      }
      // 目標日既有補假列先移除再寫入，避免重複
      next = next.filter((h) => !(h.date === targetDate && h.kind === 'makeup'));
      next.push({
        id: `hol_custom_${Date.now()}_mk_${Math.random().toString(36).slice(2, 7)}`,
        date: targetDate,
        name: buildMakeupHolidayName(sourceLabel),
        isStatutory: false,
        kind: 'makeup',
        sourceDate,
        substitutesFor,
      });
      return next;
    });

    // 班表寫入「調」＋替補標記（審查優先讀此欄）
    if (!emp?.schedules[targetDate]?.isPinned) {
      setEmployees((prev) =>
        prev.map((e) => {
          if (e.id !== empId) return e;
          return {
            ...e,
            schedules: {
              ...e.schedules,
              [targetDate]: {
                date: targetDate,
                shiftTypeId: 'shift_national_holiday_makeup',
                makeupSubstitutesFor: substitutesFor,
                makeupSourceDate: sourceDate,
              },
            },
          };
        })
      );
    }

    setMakeupPick(null);
  };

  /** 取消手動調班來源挑選。 */
  const handleCancelMakeupLink = () => setMakeupPick(null);

  /**
   * 例假首次登錄加班時跳出強提醒；使用者取消則不寫入。
   * @param category 班別類別
   * @param dateStr 日期
   * @param schedules 班表
   * @param currentOt 目前加班時數
   * @param nextOt 預計加班時數
   * @returns 允許繼續時 true
   */
  const confirmMandatoryOvertimeIfNeeded = (
    category: ShiftType['category'] | undefined,
    dateStr: string,
    schedules: Record<string, DayShift>,
    currentOt: number,
    nextOt: number
  ): boolean => {
    // 已有加班或未增加時不再跳窗；僅「首次從 0 變成有加班」提醒
    if (currentOt > 0 || nextOt <= 0) return true;
    if (!requiresMandatoryOvertimeCaution(category, dateStr, nationalHolidays, schedules)) {
      return true;
    }
    return window.confirm(
      `${MANDATORY_OVERTIME_REMINDER}\n\n日期：${dateStr}\n仍要登錄例假加班時數嗎？`
    );
  };

  /**
   * 加減當日延長工時（步進 0.5H）；無紀錄時先實體化預設班別。
   * 工作日／休息日／國假／調／例假皆可登錄；例假首次加量會跳強提醒。
   * @param empId 同仁 ID
   * @param dateStr 日期
   * @param deltaHours 變動量
   */
  const handleAdjustOvertime = (empId: string, dateStr: string, deltaHours: number) => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    if (emp.schedules[dateStr]?.isPinned) return;

    const current = emp.schedules[dateStr] ?? getEffectiveShift(emp.schedules, dateStr, nationalHolidays);
    const st = shiftTypes.find((s) => s.id === current.shiftTypeId);
    if (!st || !canLogOvertimeOnCategory(st.category)) return;

    const maxOt = getMaxDailyOvertimeHours(st.workHours);
    const currentOt = current.overtimeHours || 0;
    const next = snapOvertimeHours(currentOt + deltaHours);
    const capped = Math.min(maxOt, Math.max(0, next));

    if (
      !confirmMandatoryOvertimeIfNeeded(
        st.category,
        dateStr,
        emp.schedules,
        currentOt,
        capped
      )
    ) {
      return;
    }

    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id !== empId) return e;
        const existing = e.schedules[dateStr];
        if (existing?.isPinned) return e;
        const cur = existing ?? getEffectiveShift(e.schedules, dateStr, nationalHolidays);
        return {
          ...e,
          schedules: {
            ...e.schedules,
            [dateStr]: {
              ...cur,
              date: dateStr,
              overtimeHours: capped > 0 ? capped : undefined,
              isOvertime: capped > 0,
              compLeaveHours: cur.compLeaveHours,
            },
          },
        };
      })
    );
  };

  /**
   * 直接設定當日顯示總工時（正常＋延長−補休）。
   * 放假日正常工時多為 0，輸入值即視為當日出勤／加班時數。
   * @param empId 同仁 ID
   * @param dateStr 日期
   * @param targetDisplayHours 目標顯示時數
   */
  const handleSetDayDisplayHours = (
    empId: string,
    dateStr: string,
    targetDisplayHours: number
  ) => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    if (emp.schedules[dateStr]?.isPinned) return;

    const current = emp.schedules[dateStr] ?? getEffectiveShift(emp.schedules, dateStr, nationalHolidays);
    const st = shiftTypes.find((s) => s.id === current.shiftTypeId);
    if (!st || !canLogOvertimeOnCategory(st.category)) return;

    const base = st.workHours;
    const maxOt = getMaxDailyOvertimeHours(base);
    const currentOt = current.overtimeHours || 0;
    const currentComp = current.compLeaveHours || 0;

    const monthStart = format(startOfMonth(parseISO(dateStr)), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(parseISO(dateStr)), 'yyyy-MM-dd');
    let otherOt = 0;
    let otherUsed = 0;
    Object.values(emp.schedules).forEach((ds) => {
      if (ds.date < monthStart || ds.date > monthEnd || ds.date === dateStr) return;
      otherOt += ds.overtimeHours || 0;
      otherUsed += ds.compLeaveHours || 0;
    });

    const snappedTarget = snapOvertimeHours(Math.max(0, targetDisplayHours));
    let nextOt = 0;
    let nextComp = 0;

    if (snappedTarget >= base) {
      nextOt = snapOvertimeHours(Math.min(maxOt, snappedTarget - base));
      nextComp = 0;
    } else {
      // 低於正常班才支用補休；放假日常時 base=0，不會走這支（改以清加班為主）
      nextOt = 0;
      if (st.category === 'work') {
        const wantComp = snapOvertimeHours(base - snappedTarget);
        const bank = Math.round((otherOt - otherUsed) * 10) / 10;
        nextComp = snapOvertimeHours(Math.min(wantComp, Math.max(0, bank), base));
      }
    }

    if (nextOt === currentOt && nextComp === currentComp) return;

    if (
      !confirmMandatoryOvertimeIfNeeded(
        st.category,
        dateStr,
        emp.schedules,
        currentOt,
        nextOt
      )
    ) {
      return;
    }

    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id !== empId) return e;
        const existing = e.schedules[dateStr];
        if (existing?.isPinned) return e;
        const cur = existing ?? getEffectiveShift(e.schedules, dateStr, nationalHolidays);
        return {
          ...e,
          schedules: {
            ...e.schedules,
            [dateStr]: {
              ...cur,
              date: dateStr,
              overtimeHours: nextOt > 0 ? nextOt : undefined,
              isOvertime: nextOt > 0,
              compLeaveHours: nextComp > 0 ? nextComp : undefined,
            },
          },
        };
      })
    );
  };

  /**
   * 支用或還原補休。
   * 正值：自本月加班庫存扣抵並縮短當日顯示工時；負值：還原補休（庫存加回）。
   * 延長工時總量不變（仍登錄原本加班），僅改變補休庫存與當日顯示。
   * @param empId 同仁 ID
   * @param dateStr 日期
   * @param deltaHours 變動量（預設一步進＝支用）
   */
  const handleTakeCompLeave = (
    empId: string,
    dateStr: string,
    deltaHours: number = OVERTIME_STEP_HOURS
  ) => {
    if (deltaHours === 0) return;

    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id !== empId) return e;

        const existing = e.schedules[dateStr];
        if (existing?.isPinned) return e;
        const current = existing ?? getEffectiveShift(e.schedules, dateStr, nationalHolidays);
        const st = shiftTypes.find((s) => s.id === current.shiftTypeId);
        if (!st || st.category !== 'work') return e;

        const used = current.compLeaveHours || 0;

        // --- 還原補休 ---
        if (deltaHours < 0) {
          const nextUsed = snapOvertimeHours(Math.max(0, used + deltaHours));
          if (nextUsed === used) return e;
          return {
            ...e,
            schedules: {
              ...e.schedules,
              [dateStr]: {
                ...current,
                date: dateStr,
                compLeaveHours: nextUsed > 0 ? nextUsed : undefined,
              },
            },
          };
        }

        // --- 支用補休：需有庫存，且當日尚可再扣 ---
        const monthStart = format(startOfMonth(parseISO(dateStr)), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(parseISO(dateStr)), 'yyyy-MM-dd');
        let monthOt = 0;
        let monthUsed = 0;
        Object.values(e.schedules).forEach((ds) => {
          if (ds.date >= monthStart && ds.date <= monthEnd) {
            monthOt += ds.overtimeHours || 0;
            monthUsed += ds.compLeaveHours || 0;
          }
        });
        const bank = Math.round((monthOt - monthUsed) * 10) / 10;
        if (bank < deltaHours) return e;
        if (st.workHours - used < deltaHours) return e;

        const nextUsed = snapOvertimeHours(used + deltaHours);
        return {
          ...e,
          schedules: {
            ...e.schedules,
            [dateStr]: {
              ...current,
              date: dateStr,
              compLeaveHours: nextUsed > 0 ? nextUsed : undefined,
            },
          },
        };
      })
    );
  };

  // Handle toggle pinning a date for an employee
  /**
   * 切換日期釘選：固定目前顯示班別，不解鎖時不得被覆蓋。
   * 若該日尚無班表紀錄，先實體化畫面上的有效班別再釘選，避免誤寫成休息日。
   * @param empId 同仁 ID
   * @param dateStr 日期
   */
  const handleTogglePin = (empId: string, dateStr: string) => {
    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id !== empId) return e;
        const newSched = { ...e.schedules };
        const current = newSched[dateStr];
        if (current) {
          newSched[dateStr] = { ...current, isPinned: !current.isPinned };
        } else {
          // 沿用畫面有效班別（預設早班／休／例），僅加上釘選，不改班別
          const effective = getEffectiveShift(e.schedules, dateStr, nationalHolidays);
          newSched[dateStr] = {
            ...effective,
            date: dateStr,
            isPinned: true,
          };
        }
        return { ...e, schedules: newSched };
      })
    );
  };

  /**
   * 批次改班：略過釘選；「空」寫入哨兵清除排班（非休息日／例假／國定假日）。
   * 「調」請走 onRequestMakeupShift／handleConfirmMakeupLink。
   * @param empId 同仁 ID
   * @param dateStrs 日期清單
   * @param shiftTypeId 目標班別；EMPTY_SHIFT_TYPE_ID 表示清除
   */
  const handleBatchSelectShift = (empId: string, dateStrs: string[], shiftTypeId: string) => {
    if (shiftTypeId === 'shift_national_holiday_makeup') {
      setMakeupPick({ empId, targetDates: dateStrs });
      return;
    }

    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id !== empId) return e;
        const newSched = { ...e.schedules };
        dateStrs.forEach((dStr) => {
          if (newSched[dStr]?.isPinned) return;
          // 空班保留 schedules 鍵，避免刪後回填虛擬預設休／例
          if (shiftTypeId === EMPTY_SHIFT_TYPE_ID) {
            newSched[dStr] = { date: dStr, shiftTypeId: EMPTY_SHIFT_TYPE_ID };
          } else {
            newSched[dStr] = {
              date: dStr,
              shiftTypeId,
              note: newSched[dStr]?.note,
              overtimeHours: newSched[dStr]?.overtimeHours,
              compLeaveHours: newSched[dStr]?.compLeaveHours,
              isPinned: newSched[dStr]?.isPinned,
            };
          }
        });
        return {
          ...e,
          schedules: newSched,
        };
      })
    );

    // 批次設「國」：缺登記的日期補進假日清單
    if (shiftTypeId === 'shift_national_holiday') {
      setNationalHolidays((prev) => {
        const missing = dateStrs.filter((d) => !prev.some((h) => h.date === d));
        if (missing.length === 0) return prev;
        return [
          ...prev,
          ...missing.map((d, i) => ({
            id: `hol_custom_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
            date: d,
            name: '國定假日（手動排班）',
            isStatutory: false as const,
            kind: 'original' as const,
          })),
        ];
      });
    }
  };

  /**
   * 兩日期班別對調（含僅顯示虛擬預設班別、尚未寫入 schedules 的日期）。
   * @param schedules 原班表
   * @param fromDateStr 來源日
   * @param toDateStr 目標日
   * @returns 對調後班表
   */
  const swapScheduleDates = (
    schedules: Record<string, DayShift>,
    fromDateStr: string,
    toDateStr: string
  ): Record<string, DayShift> => {
    const newSched = { ...schedules };
    const fromStored = schedules[fromDateStr];
    const toStored = schedules[toDateStr];
    const fromEff = getEffectiveShift(schedules, fromDateStr, nationalHolidays);
    const toEff = getEffectiveShift(schedules, toDateStr, nationalHolidays);

    // 釘選任一方則不對調
    if (fromStored?.isPinned || toStored?.isPinned) return schedules;

    newSched[fromDateStr] = {
      date: fromDateStr,
      shiftTypeId: toEff.shiftTypeId,
      overtimeHours: toStored?.overtimeHours,
      compLeaveHours: toStored?.compLeaveHours,
      isOvertime: toStored?.isOvertime,
      note: toStored?.note,
    };
    newSched[toDateStr] = {
      date: toDateStr,
      shiftTypeId: fromEff.shiftTypeId,
      overtimeHours: fromStored?.overtimeHours,
      compLeaveHours: fromStored?.compLeaveHours,
      isOvertime: fromStored?.isOvertime,
      note: fromStored?.note,
    };
    return newSched;
  };

  // Requirement #5：方塊平移班別，非法位置卡在最近合法日（兩班對調）
  const handleSlideShift = (empId: string, dateStr: string, direction: 'left' | 'right') => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    if (emp.schedules[dateStr]?.isPinned) return;

    const targetDate = format(
      addDays(parseISO(dateStr), direction === 'right' ? 1 : -1),
      'yyyy-MM-dd'
    );
    if (emp.schedules[targetDate]?.isPinned) return;

    const sourceEff = getEffectiveShift(emp.schedules, dateStr, nationalHolidays);
    const movingShiftTypeId = sourceEff.shiftTypeId;

    const snapResult = findNearestLegalDate(
      emp.schedules,
      dateStr,
      targetDate,
      movingShiftTypeId,
      currentSystem,
      shiftTypes,
      28,
      emp.cycleStartDate,
      nationalHolidays
    );

    setSnappedFeedback(snapResult);

    if (snapResult.allowed) {
      const finalTargetDate = snapResult.snappedDate;
      setEmployees((prev) =>
        prev.map((e) => {
          if (e.id !== empId) return e;
          return {
            ...e,
            schedules: swapScheduleDates(e.schedules, dateStr, finalTargetDate),
          };
        })
      );
    }
  };

  // Drag and Drop with Swap & Snap Legal Boundary
  const handleDragDropShift = (empId: string, fromDateStr: string, targetDateStr: string) => {
    if (fromDateStr === targetDateStr) return;
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    if (emp.schedules[fromDateStr]?.isPinned || emp.schedules[targetDateStr]?.isPinned) return;

    // 使用有效班別（含虛擬預設），避免未寫入 schedules 時拖放無效
    const sourceEff = getEffectiveShift(emp.schedules, fromDateStr, nationalHolidays);
    const movingShiftTypeId = sourceEff.shiftTypeId;

    const snapResult = findNearestLegalDate(
      emp.schedules,
      fromDateStr,
      targetDateStr,
      movingShiftTypeId,
      currentSystem,
      shiftTypes,
      28,
      emp.cycleStartDate,
      nationalHolidays
    );

    setSnappedFeedback(snapResult);

    if (snapResult.allowed) {
      const finalTargetDate = snapResult.snappedDate;
      setEmployees((prev) =>
        prev.map((e) => {
          if (e.id !== empId) return e;
          return {
            ...e,
            schedules: swapScheduleDates(e.schedules, fromDateStr, finalTargetDate),
          };
        })
      );
    }
  };

  // Reset current schedule
  const handleResetSchedules = () => {
    if (window.confirm('確定要清除當前選擇同仁的班表嗎？')) {
      setEmployees((prev) =>
        prev.map((e) => {
          if (e.id !== selectedEmployeeId) return e;
          return { ...e, schedules: {} };
        })
      );
    }
  };

  // Export JSON file
  const handleExportJSON = () => {
    const dataStr = JSON.stringify({ currentSystem, employees, shiftTypes, nationalHolidays }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `排班模擬班表_${format(new Date(), 'yyyyMMdd')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAddEmployee = (name: string, role: string, system: ScheduleSystemType, cycleStartDate: string) => {
    const newEmpId = `emp_${Date.now()}`;
    const newEmp: Employee = {
      id: newEmpId,
      name,
      role,
      department: '營運部',
      scheduleSystem: system,
      cycleStartDate,
      schedules: {},
    };

    // 當月預設：平日早班、六休、七例（稍後再以國假／調覆蓋）
    const startM = startOfMonth(new Date());
    for (let i = 0; i < 31; i++) {
      const d = addDays(startM, i);
      const dStr = format(d, 'yyyy-MM-dd');
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0) {
        newEmp.schedules[dStr] = { date: dStr, shiftTypeId: 'shift_mandatory' };
      } else if (dayOfWeek === 6) {
        newEmp.schedules[dStr] = { date: dStr, shiftTypeId: 'shift_rest' };
      } else {
        newEmp.schedules[dStr] = { date: dStr, shiftTypeId: 'shift_morning' };
      }
    }

    // 寫入清單內「全部」國假／調（不限當月），避免初始設定第三步新增同仁後其他月份只有標註沒有班別
    nationalHolidays.forEach((holiday) => {
      newEmp.schedules[holiday.date] = {
        date: holiday.date,
        shiftTypeId: resolveHolidayShiftTypeId(holiday),
      };
    });

    setEmployees((prev) => [...prev, newEmp]);
    if (!selectedEmployeeId) {
      setSelectedEmployeeId(newEmpId);
    }
  };

  /** 同仁名單變更時也要重套國假（初始設定：先假日後加人） */
  const employeeIdsKey = employees.map((e) => e.id).join('|');

  // 國定假日／補假清單或同仁名單變更時，自動寫入對應班別（國＝原日、調＝補假）
  useEffect(() => {
    if (nationalHolidays.length === 0 || employees.length === 0) return;

    setEmployees((prev) => {
      let hasChanges = false;
      const nextEmployees = prev.map((emp) => {
        let empChanged = false;
        const newSchedules = { ...emp.schedules };

        nationalHolidays.forEach((holiday) => {
          const desiredId = resolveHolidayShiftTypeId(holiday);
          const currShift = newSchedules[holiday.date];
          // 已釘選則不覆寫（尊重手動鎖定）
          if (currShift?.isPinned) return;
          if (!currShift || currShift.shiftTypeId !== desiredId) {
            newSchedules[holiday.date] = {
              date: holiday.date,
              shiftTypeId: desiredId,
              isPinned: currShift?.isPinned,
            };
            empChanged = true;
          }
        });

        if (empChanged) {
          hasChanges = true;
          return { ...emp, schedules: newSchedules };
        }
        return emp;
      });

      return hasChanges ? nextEmployees : prev;
    });
  }, [nationalHolidays, employeeIdsKey]);
  return (
    <div className="app-root min-h-screen bg-[#FAF9F5] text-[#2D2D2D] font-sans flex flex-col antialiased">
      {/* Sticky Top Bar (Header + Employee Selector + System Selector) */}
      <div className="no-print sticky top-0 z-40 bg-[#FAF9F5] shadow-sm border-b border-[#E9E7D4]">
        <Header
          currentSystem={currentSystem}
          onSelectSystem={handleSelectSystem}
          onOpenHolidaysModal={() => setIsHolidaysModalOpen(true)}
          onOpenShiftModal={() => setIsShiftModalOpen(true)}
          onOpenEmployeeModal={() => setIsEmployeeModalOpen(true)}
          onOpenSetupWizardModal={() => setIsSetupWizardModalOpen(true)}
          onOpenUserGuideModal={() => setIsUserGuideModalOpen(true)}
          onOpenDisclaimerModal={() => setIsDisclaimerModalOpen(true)}
          onOpenLegalModal={() => setIsLegalInfoModalOpen(true)}
          onOpenAboutModal={() => setIsAboutModalOpen(true)}
          onClearAllData={handleClearAllData}
          onExportJSON={handleExportJSON}
          onPrint={() => setIsExportModalOpen(true)}
          onResetSchedules={handleResetSchedules}
          violationCount={violations.filter((v) => v.severity === 'error').length}
        />

        <SystemSelectorBar
          currentSystem={currentSystem}
          onSelectSystem={handleSelectSystem}
          employees={employees}
          selectedEmployeeId={selectedEmployeeId}
          onSelectEmployee={setSelectedEmployeeId}
        />
      </div>

      {/* Main Content Area */}
      <main className="no-print flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* View Mode Toggle Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#E9E7D4] pb-4">
          <div className="flex items-center space-x-2">
            {viewMode === 'timeline' && (
              <h2 className="text-xl font-bold font-serif text-[#2D2D2D]">
                全體同仁矩陣排班總覽
              </h2>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex bg-[#F8F7EB] p-1 rounded-xl border border-[#E9E7D4]">
              <button
                onClick={() => setViewMode('month')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'month'
                    ? 'bg-[#5A5A40] text-white shadow-sm'
                    : 'text-[#8A8A70] hover:text-[#2D2D2D]'
                }`}
                title="月曆模式"
              >
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">月曆模式</span>
                <span className="sm:hidden">月曆</span>
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'timeline'
                    ? 'bg-[#5A5A40] text-white shadow-sm'
                    : 'text-[#8A8A70] hover:text-[#2D2D2D]'
                }`}
                title="全人員矩陣模式"
              >
                <LayoutGrid className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">全人員矩陣模式</span>
                <span className="sm:hidden">矩陣</span>
              </button>
            </div>
          </div>
        </div>

        {/* Empty State Card if no employees */}
        {employees.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-[#D9D7C2] rounded-2xl p-10 text-center space-y-4 max-w-xl mx-auto my-12 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8 text-[#5A5A40]" />
            </div>
            <h2 className="text-xl font-bold text-[#2D2D2D] font-serif">歡迎使用排班模擬系統</h2>
            <p className="text-sm text-[#8A8A70] leading-relaxed">
              目前尚未建立事業單位排班同仁名單。請點擊下方按鈕開啟「初始設定導引 Panel」，快速設定國定假日、維護班別代碼並新增您的第一位排班同仁。
            </p>
            <button
              onClick={() => setIsSetupWizardModalOpen(true)}
              className="px-6 py-3 bg-[#5A5A40] hover:bg-[#484833] text-white text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>開啟初始設定導引 Panel (國定假日 / 班別 / 同仁)</span>
            </button>
          </div>
        ) : (
          <>
            {/* Real-time Compliance Audit Dashboard */}
            <LaborAuditPanel
              systemType={currentSystem}
              violations={violations}
              totalWorkHours={totalWorkHours}
              totalOvertimeHours={totalOvertimeHours}
              maxConsecutiveDays={maxConsecutiveDays}
              mandatoryOffCount={mandatoryOffCount}
              restDayCount={restDayCount}
              nationalHolidayWorkCount={nationalHolidayWorkCount}
              onHighlightDates={(dates) => setHighlightDates(dates)}
            />

            {/* Main Calendar View */}
            {viewMode === 'month' ? (
              <CalendarMonthView
                currentYear={currentYear}
                currentMonth={currentMonth}
                onChangeYearMonth={(y, m) => {
                  setCurrentYear(y);
                  setCurrentMonth(m);
                  // 月曆換月時，同步矩陣起始日到該月 1 日
                  setTimelineStartDateStr(format(new Date(y, m - 1, 1), 'yyyy-MM-dd'));
                }}
                selectedEmployee={selectedEmployee}
                currentSystem={currentSystem}
                allShiftTypes={shiftTypes}
                nationalHolidays={nationalHolidays}
                onSelectShift={(dStr, stId) => handleSelectShift(selectedEmployeeId, dStr, stId)}
                onBatchSelectShifts={(dStrs, stId) => handleBatchSelectShift(selectedEmployeeId, dStrs, stId)}
                onRequestMakeupShift={(dStrs) =>
                  setMakeupPick({ empId: selectedEmployeeId, targetDates: dStrs })
                }
                onSlideShift={(dStr, dir) => handleSlideShift(selectedEmployeeId, dStr, dir)}
                onDragDropShift={(fDate, tDate) => handleDragDropShift(selectedEmployeeId, fDate, tDate)}
                onTogglePin={(dStr) => handleTogglePin(selectedEmployeeId, dStr)}
                onOpenShiftModal={() => setIsShiftModalOpen(true)}
                onAdjustOvertime={(dStr, delta) =>
                  handleAdjustOvertime(selectedEmployeeId, dStr, delta)
                }
                onTakeCompLeave={(dStr, delta) =>
                  handleTakeCompLeave(selectedEmployeeId, dStr, delta)
                }
                onSetDayHours={(dStr, hours) =>
                  handleSetDayDisplayHours(selectedEmployeeId, dStr, hours)
                }
                compLeaveBankHours={compLeaveBankHours}
                highlightDates={highlightDates}
                snappedFeedback={snappedFeedback}
                onDismissSnappedFeedback={() => setSnappedFeedback(null)}
              />
            ) : (
              <RosterTimelineView
                startDateStr={timelineStartDateStr}
                daysCount={SYSTEM_CONFIGS[currentSystem].cycleDays}
                employees={employees}
                allShiftTypes={shiftTypes}
                nationalHolidays={nationalHolidays}
                onSelectShift={(empId, dStr, stId) => handleSelectShift(empId, dStr, stId)}
                onRequestMakeupShift={(cells) => {
                  if (cells.length === 0) return;
                  // 矩陣多格時以第一格同仁為準（同批通常同仁）
                  setMakeupPick({
                    empId: cells[0].empId,
                    targetDates: cells.map((c) => c.dateStr),
                  });
                }}
                onSlideShift={(empId, dStr, dir) => handleSlideShift(empId, dStr, dir)}
                onDragDropShift={(empId, fDate, tDate) => handleDragDropShift(empId, fDate, tDate)}
                onTogglePin={(empId, dStr) => handleTogglePin(empId, dStr)}
                onChangeStartDate={(newStart) => {
                  setTimelineStartDateStr(newStart);
                  // 同步年月供檢核面板／月曆對齊，但不強制回到 1 日
                  const d = parseISO(newStart);
                  setCurrentYear(d.getFullYear());
                  setCurrentMonth(d.getMonth() + 1);
                }}
                selectedEmployeeId={selectedEmployeeId}
                onSelectEmployee={setSelectedEmployeeId}
                onOpenShiftModal={() => setIsShiftModalOpen(true)}
                onAdjustOvertime={handleAdjustOvertime}
                onTakeCompLeave={handleTakeCompLeave}
                onSetDayHours={handleSetDayDisplayHours}
              />
            )}
          </>
        )}
      </main>

      {/* 頁尾免責／贊助提示：小字置底，避免與主內容搶視覺 */}
      <footer className="no-print max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-6 pt-2">
        <p className="text-center text-xs text-[#8A8A70] leading-relaxed">
          本工具免費使用，僅供排班規劃與
          <button
            type="button"
            onClick={() => setIsLegalInfoModalOpen(true)}
            className="underline underline-offset-2 hover:text-[#5A5A40] transition-colors cursor-pointer"
          >
            教育模擬
          </button>
          參考，
          <button
            type="button"
            onClick={() => setIsDisclaimerModalOpen(true)}
            className="underline underline-offset-2 hover:text-[#5A5A40] transition-colors cursor-pointer"
          >
            非正式法律意見或勞動檢查結論
          </button>
          。若幫到你，
          <button
            type="button"
            onClick={() => setIsAboutModalOpen(true)}
            className="underline underline-offset-2 hover:text-[#5A5A40] transition-colors cursor-pointer"
          >
            歡迎請我杯咖啡（還沒放）
          </button>
        </p>
      </footer>

      {/* Initial Setup Wizard Panel */}
      <SetupWizardModal
        isOpen={isSetupWizardModalOpen}
        onClose={() => setIsSetupWizardModalOpen(false)}
        nationalHolidays={nationalHolidays}
        onAddHoliday={(h) =>
          setNationalHolidays((prev) => [
            ...prev,
            // 亂數後綴避免連加原日與補假時 Date.now() 撞號
            { ...h, id: `hol_custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` },
          ])
        }
        onDeleteHoliday={(id) => setNationalHolidays((prev) => prev.filter((h) => h.id !== id))}
        onResetHolidays={() => setNationalHolidays(INITIAL_TAIWAN_HOLIDAYS)}
        onClearAllHolidays={() => setNationalHolidays([])}
        shiftTypes={shiftTypes}
        onAddShiftType={(st) =>
          setShiftTypes((prev) => [...prev, { ...st, id: `shift_${Date.now()}` } as ShiftType])
        }
        onUpdateShiftType={(updatedSt) =>
          setShiftTypes((prev) => prev.map((s) => (s.id === updatedSt.id ? updatedSt : s)))
        }
        onDeleteShiftType={(id) => setShiftTypes((prev) => prev.filter((s) => s.id !== id))}
        onResetShiftTypes={() => setShiftTypes(DEFAULT_SHIFTS)}
        employees={employees}
        onAddEmployee={handleAddEmployee}
        onDeleteEmployee={(id) => setEmployees((prev) => prev.filter((e) => e.id !== id))}
        onCompleteSetup={() => {
          localStorage.setItem('perpetual_setup_completed', 'true');
          setIsSetupWizardModalOpen(false);
          // 初始化後先開使用說明；關閉後再接免責說明
          setOpenDisclaimerAfterGuide(true);
          setIsUserGuideModalOpen(true);
          if (employees.length > 0 && !selectedEmployeeId) {
            setSelectedEmployeeId(employees[0].id);
          }
        }}
      />

      {/* User Guide Modal */}
      <UserGuideModal
        isOpen={isUserGuideModalOpen}
        onClose={() => {
          setIsUserGuideModalOpen(false);
          // 僅初始化流程會接續開啟免責；日常手動開啟使用說明不會觸發
          if (openDisclaimerAfterGuide) {
            setOpenDisclaimerAfterGuide(false);
            setIsDisclaimerModalOpen(true);
          }
        }}
      />

      <DisclaimerModal
        isOpen={isDisclaimerModalOpen}
        onClose={() => setIsDisclaimerModalOpen(false)}
      />

      <LegalInfoModal
        isOpen={isLegalInfoModalOpen}
        onClose={() => setIsLegalInfoModalOpen(false)}
      />

      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        onOpenDisclaimer={() => {
          // 先關關於再開免責，避免兩層 Modal 疊加
          setIsAboutModalOpen(false);
          setIsDisclaimerModalOpen(true);
        }}
      />

      {/* 手動「調」：從畫面上的「國」班挑選來源 */}
      <MakeupSourcePickerModal
        isOpen={!!makeupPick}
        targetDate={makeupPick?.targetDates[0] ?? ''}
        candidates={
          makeupPick
            ? collectNationalShiftCandidates(
                employees.find((e) => e.id === makeupPick.empId),
                nationalHolidays,
                [
                  ...makeupPick.targetDates,
                  monthStartDateStr,
                  monthEndDateStr,
                ]
              )
            : []
        }
        onConfirm={handleConfirmMakeupLink}
        onCancel={handleCancelMakeupLink}
      />

      {/* Modals */}
      <NationalHolidaySettingsModal
        isOpen={isHolidaysModalOpen}
        onClose={() => setIsHolidaysModalOpen(false)}
        holidays={nationalHolidays}
        onAddHoliday={(h) =>
          setNationalHolidays((prev) => [
            ...prev,
            // 亂數後綴避免連加原日與補假時 Date.now() 撞號
            { ...h, id: `hol_custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` },
          ])
        }
        onDeleteHoliday={(id) => setNationalHolidays((prev) => prev.filter((h) => h.id !== id))}
        onResetHolidays={() => setNationalHolidays(INITIAL_TAIWAN_HOLIDAYS)}
        onClearAllHolidays={() => setNationalHolidays([])}
      />

      <ShiftSettingsModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        shiftTypes={shiftTypes}
        onAddShiftType={(st) => setShiftTypes((prev) => [...prev, st])}
        // 以新班別物件覆寫同 id 項目，勿兩邊都回傳 s（否則儲存無效）
        onUpdateShiftType={(st) =>
          setShiftTypes((prev) => prev.map((s) => (s.id === st.id ? st : s)))
        }
        onDeleteShiftType={(id) => setShiftTypes((prev) => prev.filter((s) => s.id !== id))}
      />

      <EmployeeSettingsModal
        isOpen={isEmployeeModalOpen}
        onClose={() => setIsEmployeeModalOpen(false)}
        employees={employees}
        onAddEmployee={handleAddEmployee}
        onUpdateEmployee={(updatedEmp) => {
          setEmployees((prev) => prev.map((e) => (e.id === updatedEmp.id ? updatedEmp : e)));
        }}
        onDeleteEmployee={(id) => {
          setEmployees((prev) => prev.filter((e) => e.id !== id));
          if (selectedEmployeeId === id && employees.length > 1) {
            setSelectedEmployeeId(employees.find((e) => e.id !== id)!.id);
          }
        }}
        onSelectEmployee={setSelectedEmployeeId}
        selectedEmployeeId={selectedEmployeeId}
      />

      <ExportCalendarModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        employees={employees}
        selectedEmployeeId={selectedEmployeeId}
        shiftTypes={shiftTypes}
        nationalHolidays={nationalHolidays}
        currentSystem={currentSystem}
      />
    </div>
  );
}
