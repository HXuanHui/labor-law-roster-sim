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
import { DEFAULT_SHIFTS } from './constants/shifts';
import { SYSTEM_CONFIGS } from './constants/systems';
import { INITIAL_TAIWAN_HOLIDAYS } from './constants/taiwanHolidays';
import { checkCompliance, findNearestLegalDate, getEffectiveShift, getShiftType, isWorkShift, getCycleInfoForDate } from './utils/laborLaws';
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
import { ExportCalendarModal } from './components/ExportCalendarModal';
import { Calendar, LayoutGrid, Users, Plus, ShieldCheck, Download, AlertTriangle, Sparkles, BookOpen, Trash2, Printer } from 'lucide-react';
import { addDays, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';

export default function App() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
  const [currentSystem, setCurrentSystem] = useState<ScheduleSystemType>('2-week');
  const [viewMode, setViewMode] = useState<'month' | 'timeline'>('month');

  // Modals state
  const [isHolidaysModalOpen, setIsHolidaysModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isUserGuideModalOpen, setIsUserGuideModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

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
    return saved ? JSON.parse(saved) : DEFAULT_SHIFTS;
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

  // Calculate statistics for active employee in current cycle
  const { totalWorkHours, maxConsecutiveDays, mandatoryOffCount, restDayCount, nationalHolidayWorkCount } = useMemo(() => {
    if (!selectedEmployee) {
      return { totalWorkHours: 0, maxConsecutiveDays: 0, mandatoryOffCount: 0, restDayCount: 0, nationalHolidayWorkCount: 0 };
    }

    const system = currentSystem || selectedEmployee.scheduleSystem || '2-week';
    const cycleDays = system === '2-week' ? 14 : system === '4-week' ? 28 : system === '8-week' ? 56 : 7;

    const start = parseISO(monthStartDateStr);
    const end = parseISO(monthEndDateStr);

    // Reference date: today if in current month view, otherwise start of current month view
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const refDateStr = (todayStr >= monthStartDateStr && todayStr <= monthEndDateStr)
      ? todayStr
      : monthStartDateStr;

    // Get the exact cycle range for the reference date
    const refCycle = getCycleInfoForDate(refDateStr, cycleDays, selectedEmployee.cycleStartDate);

    // Calculate work hours, mandatory off days, rest days, national holiday work days for this cycle
    let hours = 0;
    let mandatory = 0;
    let rest = 0;
    let natWork = 0;

    for (let i = 0; i < cycleDays; i++) {
      const cDate = addDays(refCycle.cStart, i);
      const dStr = format(cDate, 'yyyy-MM-dd');
      const dayShift = getEffectiveShift(selectedEmployee.schedules, dStr);
      const shiftType = getShiftType(dayShift.shiftTypeId, shiftTypes);
      const isNat = nationalHolidays.some((h) => h.date === dStr);

      if (shiftType) {
        if (shiftType.category === 'work') {
          hours += shiftType.workHours;
          if (isNat) natWork++;
        } else if (shiftType.category === 'mandatory') {
          mandatory++;
        } else if (shiftType.category === 'rest') {
          rest++;
        }
      }
    }

    // Calculate max consecutive work days across the month view range
    let curConsecutive = 0;
    let maxConsecutive = 0;
    let d = start;
    while (d <= end) {
      const dStr = format(d, 'yyyy-MM-dd');
      const dayShift = getEffectiveShift(selectedEmployee.schedules, dStr);
      const shiftType = getShiftType(dayShift.shiftTypeId, shiftTypes);

      if (shiftType && shiftType.category === 'work') {
        curConsecutive++;
        if (curConsecutive > maxConsecutive) maxConsecutive = curConsecutive;
      } else {
        curConsecutive = 0;
      }

      d = addDays(d, 1);
    }

    return {
      totalWorkHours: hours,
      maxConsecutiveDays: maxConsecutive,
      mandatoryOffCount: mandatory,
      restDayCount: rest,
      nationalHolidayWorkCount: natWork,
    };
  }, [selectedEmployee, currentSystem, monthStartDateStr, monthEndDateStr, shiftTypes, nationalHolidays]);

  // Handle single shift change
  const handleSelectShift = (empId: string, dateStr: string, shiftTypeId: string) => {
    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id !== empId) return e;
        if (e.schedules[dateStr]?.isPinned) return e; // Lock pinned shift from being overwritten
        const newSched = { ...e.schedules };
        if (shiftTypeId === 'shift_empty') {
          delete newSched[dateStr];
        } else {
          newSched[dateStr] = { date: dateStr, shiftTypeId };
        }
        return {
          ...e,
          schedules: newSched,
        };
      })
    );
  };

  // Handle toggle pinning a date for an employee
  const handleTogglePin = (empId: string, dateStr: string) => {
    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id !== empId) return e;
        const newSched = { ...e.schedules };
        const current = newSched[dateStr];
        if (current) {
          newSched[dateStr] = { ...current, isPinned: !current.isPinned };
        } else {
          // Default to rest shift pinned if empty
          newSched[dateStr] = { date: dateStr, shiftTypeId: 'shift_rest', isPinned: true };
        }
        return { ...e, schedules: newSched };
      })
    );
  };

  // Handle batch shift change for multiple dates
  const handleBatchSelectShift = (empId: string, dateStrs: string[], shiftTypeId: string) => {
    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id !== empId) return e;
        const newSched = { ...e.schedules };
        dateStrs.forEach((dStr) => {
          if (shiftTypeId === 'shift_empty') {
            delete newSched[dStr];
          } else {
            newSched[dStr] = { date: dStr, shiftTypeId };
          }
        });
        return {
          ...e,
          schedules: newSched,
        };
      })
    );
  };

  // Requirement #5 implementation: "方塊平移班別，遇到以上條件不可移動者要卡在最靠近邊界的合法位置" (兩班對調互換)
  const handleSlideShift = (empId: string, dateStr: string, direction: 'left' | 'right') => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;

    const sourceShift = emp.schedules[dateStr];
    const targetDate = format(
      addDays(parseISO(dateStr), direction === 'right' ? 1 : -1),
      'yyyy-MM-dd'
    );
    const targetShift = emp.schedules[targetDate];

    if (!sourceShift && !targetShift) return;

    const movingShiftTypeId = sourceShift ? sourceShift.shiftTypeId : (targetShift?.shiftTypeId || 'shift_rest');

    // Call snap engine
    const snapResult = findNearestLegalDate(
      emp.schedules,
      dateStr,
      targetDate,
      movingShiftTypeId,
      currentSystem,
      shiftTypes,
      28,
      emp.cycleStartDate
    );

    setSnappedFeedback(snapResult);

    // Update schedule at snapped position with SWAP
    if (snapResult.allowed) {
      const finalTargetDate = snapResult.snappedDate;
      const finalTargetShift = emp.schedules[finalTargetDate];

      setEmployees((prev) =>
        prev.map((e) => {
          if (e.id !== empId) return e;
          const newSched = { ...e.schedules };

          // Swap logic
          if (finalTargetShift) {
            newSched[dateStr] = {
              date: dateStr,
              shiftTypeId: finalTargetShift.shiftTypeId,
            };
          } else {
            delete newSched[dateStr];
          }

          if (sourceShift) {
            newSched[finalTargetDate] = {
              date: finalTargetDate,
              shiftTypeId: sourceShift.shiftTypeId,
            };
          } else {
            delete newSched[finalTargetDate];
          }

          return { ...e, schedules: newSched };
        })
      );
    }
  };

  // Drag and Drop with Swap & Snap Legal Boundary
  const handleDragDropShift = (empId: string, fromDateStr: string, targetDateStr: string) => {
    if (fromDateStr === targetDateStr) return;
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;

    const sourceShift = emp.schedules[fromDateStr];
    const targetShift = emp.schedules[targetDateStr];

    if (!sourceShift && !targetShift) return;

    const movingShiftTypeId = sourceShift ? sourceShift.shiftTypeId : (targetShift?.shiftTypeId || 'shift_rest');

    const snapResult = findNearestLegalDate(
      emp.schedules,
      fromDateStr,
      targetDateStr,
      movingShiftTypeId,
      currentSystem,
      shiftTypes,
      28,
      emp.cycleStartDate
    );

    setSnappedFeedback(snapResult);

    if (snapResult.allowed) {
      const finalTargetDate = snapResult.snappedDate;
      const finalTargetShift = emp.schedules[finalTargetDate];

      setEmployees((prev) =>
        prev.map((e) => {
          if (e.id !== empId) return e;
          const newSched = { ...e.schedules };

          // Swap logic
          if (finalTargetShift) {
            newSched[fromDateStr] = {
              date: fromDateStr,
              shiftTypeId: finalTargetShift.shiftTypeId,
            };
          } else {
            delete newSched[fromDateStr];
          }

          if (sourceShift) {
            newSched[finalTargetDate] = {
              date: finalTargetDate,
              shiftTypeId: sourceShift.shiftTypeId,
            };
          } else {
            delete newSched[finalTargetDate];
          }

          return { ...e, schedules: newSched };
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

    // Pre-populate standard initial schedule: Mon-Fri=普通班(早班), Sat=休息日, Sun=例假日, National Holiday=國定假日
    const startM = startOfMonth(new Date());
    for (let i = 0; i < 31; i++) {
      const dStr = format(addDays(startM, i), 'yyyy-MM-dd');
      const isNationalHoliday = nationalHolidays.some((h) => h.date === dStr);
      if (isNationalHoliday) {
        newEmp.schedules[dStr] = { date: dStr, shiftTypeId: 'shift_national_holiday' };
      } else {
        const dayOfWeek = addDays(startM, i).getDay();
        if (dayOfWeek === 0) {
          newEmp.schedules[dStr] = { date: dStr, shiftTypeId: 'shift_mandatory' };
        } else if (dayOfWeek === 6) {
          newEmp.schedules[dStr] = { date: dStr, shiftTypeId: 'shift_rest' };
        } else {
          newEmp.schedules[dStr] = { date: dStr, shiftTypeId: 'shift_morning' };
        }
      }
    }

    setEmployees((prev) => [...prev, newEmp]);
    if (!selectedEmployeeId) {
      setSelectedEmployeeId(newEmpId);
    }
  };

  // Requirement 1: Automatically assign national holiday shift type for dates configured as national holidays
  useEffect(() => {
    if (nationalHolidays.length === 0 || employees.length === 0) return;

    const holidayDates = Array.from(new Set(nationalHolidays.map((h) => h.date)));

    setEmployees((prev) => {
      let hasChanges = false;
      const nextEmployees = prev.map((emp) => {
        let empChanged = false;
        const newSchedules = { ...emp.schedules };

        holidayDates.forEach((hDate: string) => {
          const currShift = newSchedules[hDate];
          if (!currShift || currShift.shiftTypeId !== 'shift_national_holiday') {
            newSchedules[hDate] = { date: hDate, shiftTypeId: 'shift_national_holiday' };
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
  }, [nationalHolidays]);

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#2D2D2D] font-sans flex flex-col antialiased">
      {/* Sticky Top Bar (Header + Employee Selector + System Selector) */}
      <div className="sticky top-0 z-40 bg-[#FAF9F5] shadow-sm border-b border-[#E9E7D4]">
        <Header
          currentSystem={currentSystem}
          onSelectSystem={handleSelectSystem}
          onOpenHolidaysModal={() => setIsHolidaysModalOpen(true)}
          onOpenShiftModal={() => setIsShiftModalOpen(true)}
          onOpenEmployeeModal={() => setIsEmployeeModalOpen(true)}
          onOpenSetupWizardModal={() => setIsSetupWizardModalOpen(true)}
          onOpenUserGuideModal={() => setIsUserGuideModalOpen(true)}
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* View Mode Toggle Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#E9E7D4] pb-4">
          <div className="flex items-center space-x-2">
            {viewMode === 'timeline' && (
              <h2 className="text-lg font-bold font-serif text-[#2D2D2D]">
                全體同仁矩陣排班總覽
              </h2>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-[#5A5A40]/10 hover:bg-[#5A5A40]/20 text-[#5A5A40] border border-[#5A5A40]/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="開啓年曆 / 月曆繪出與列印面版"
            >
              <Printer className="w-4 h-4 text-[#5A5A40]" />
              <span>匯出年曆 / 月曆</span>
            </button>

            <div className="flex bg-[#F8F7EB] p-1 rounded-xl border border-[#E9E7D4]">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'month'
                    ? 'bg-[#5A5A40] text-white shadow-sm'
                    : 'text-[#8A8A70] hover:text-[#2D2D2D]'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>月曆模式</span>
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'timeline'
                    ? 'bg-[#5A5A40] text-white shadow-sm'
                    : 'text-[#8A8A70] hover:text-[#2D2D2D]'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>全人員矩陣模式</span>
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
            <p className="text-xs text-[#8A8A70] leading-relaxed">
              目前尚未建立事業單位排班同仁名單。請點擊下方按鈕開啟「初始設定導引 Panel」，快速設定國定假日、維護班別代碼並新增您的第一位排班同仁。
            </p>
            <button
              onClick={() => setIsSetupWizardModalOpen(true)}
              className="px-6 py-3 bg-[#5A5A40] hover:bg-[#484833] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
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
                }}
                selectedEmployee={selectedEmployee}
                currentSystem={currentSystem}
                allShiftTypes={shiftTypes}
                nationalHolidays={nationalHolidays}
                onSelectShift={(dStr, stId) => handleSelectShift(selectedEmployeeId, dStr, stId)}
                onBatchSelectShifts={(dStrs, stId) => handleBatchSelectShift(selectedEmployeeId, dStrs, stId)}
                onSlideShift={(dStr, dir) => handleSlideShift(selectedEmployeeId, dStr, dir)}
                onDragDropShift={(fDate, tDate) => handleDragDropShift(selectedEmployeeId, fDate, tDate)}
                onTogglePin={(dStr) => handleTogglePin(selectedEmployeeId, dStr)}
                highlightDates={highlightDates}
                snappedFeedback={snappedFeedback}
                onDismissSnappedFeedback={() => setSnappedFeedback(null)}
              />
            ) : (
              <RosterTimelineView
                startDateStr={monthStartDateStr}
                daysCount={SYSTEM_CONFIGS[currentSystem].cycleDays}
                employees={employees}
                allShiftTypes={shiftTypes}
                nationalHolidays={nationalHolidays}
                onSelectShift={(empId, dStr, stId) => handleSelectShift(empId, dStr, stId)}
                onSlideShift={(empId, dStr, dir) => handleSlideShift(empId, dStr, dir)}
                onDragDropShift={(empId, fDate, tDate) => handleDragDropShift(empId, fDate, tDate)}
                onTogglePin={(empId, dStr) => handleTogglePin(empId, dStr)}
                onChangeStartDate={() => {}}
                selectedEmployeeId={selectedEmployeeId}
                onSelectEmployee={setSelectedEmployeeId}
              />
            )}
          </>
        )}
      </main>

      {/* Initial Setup Wizard Panel */}
      <SetupWizardModal
        isOpen={isSetupWizardModalOpen}
        onClose={() => setIsSetupWizardModalOpen(false)}
        nationalHolidays={nationalHolidays}
        onAddHoliday={(h) =>
          setNationalHolidays((prev) => [...prev, { ...h, id: `hol_custom_${Date.now()}` }])
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
          setIsUserGuideModalOpen(true);
          if (employees.length > 0 && !selectedEmployeeId) {
            setSelectedEmployeeId(employees[0].id);
          }
        }}
      />

      {/* User Guide Modal */}
      <UserGuideModal
        isOpen={isUserGuideModalOpen}
        onClose={() => setIsUserGuideModalOpen(false)}
      />

      {/* Modals */}
      <NationalHolidaySettingsModal
        isOpen={isHolidaysModalOpen}
        onClose={() => setIsHolidaysModalOpen(false)}
        holidays={nationalHolidays}
        onAddHoliday={(h) =>
          setNationalHolidays((prev) => [...prev, { ...h, id: `hol_custom_${Date.now()}` }])
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
        onUpdateShiftType={(st) => setShiftTypes((prev) => prev.map((s) => (s.id === st.id ? s : s)))}
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
