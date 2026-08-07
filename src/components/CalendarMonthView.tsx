import React, { useState, useEffect } from 'react';
import { DayShift, Employee, NationalHoliday, ScheduleSystemType, ShiftType, SnapResult } from '../types';
import { getMonthCalendarGrid, formatTaiwanDate } from '../utils/perpetualCalendar';
import { ShiftBlockTile } from './ShiftBlockTile';
import { findNearestLegalDate, getEffectiveShift, getCycleInfoForDate } from '../utils/laborLaws';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw, Sparkles, AlertTriangle, Layers, CheckSquare, XCircle } from 'lucide-react';
import { format, addMonths, subMonths, parseISO } from 'date-fns';

interface CalendarMonthViewProps {
  currentYear: number;
  currentMonth: number; // 1-12
  onChangeYearMonth: (year: number, month: number) => void;
  selectedEmployee: Employee;
  currentSystem?: ScheduleSystemType;
  allShiftTypes: ShiftType[];
  nationalHolidays: NationalHoliday[];
  onSelectShift: (dateStr: string, shiftTypeId: string) => void;
  onBatchSelectShifts?: (dateStrs: string[], shiftTypeId: string) => void;
  onSlideShift: (dateStr: string, direction: 'left' | 'right') => void;
  onDragDropShift: (fromDateStr: string, targetDateStr: string) => void;
  onTogglePin?: (dateStr: string) => void;
  highlightDates?: string[];
  snappedFeedback?: SnapResult | null;
  onDismissSnappedFeedback?: () => void;
}

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  currentYear,
  currentMonth,
  onChangeYearMonth,
  selectedEmployee,
  currentSystem,
  allShiftTypes,
  nationalHolidays,
  onSelectShift,
  onBatchSelectShifts,
  onSlideShift,
  onDragDropShift,
  onTogglePin,
  highlightDates = [],
  snappedFeedback,
  onDismissSnappedFeedback,
}) => {
  const [draggedDate, setDraggedDate] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Multi-date selection states (OS style Shift+Click range / Ctrl+Click toggle)
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [lastClickedDate, setLastClickedDate] = useState<string | null>(null);

  // Keyboard shortcut: Press ESC to cancel all tile selections
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        setSelectedDates([]);
        setLastClickedDate(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const daysGrid = getMonthCalendarGrid(currentYear, currentMonth, nationalHolidays);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      onChangeYearMonth(currentYear - 1, 12);
    } else {
      onChangeYearMonth(currentYear, currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      onChangeYearMonth(currentYear + 1, 1);
    } else {
      onChangeYearMonth(currentYear, currentMonth + 1);
    }
  };

  const handleToday = () => {
    const today = new Date();
    onChangeYearMonth(today.getFullYear(), today.getMonth() + 1);
  };

  // OS-Style Date Click Handler (Shift+Click for range, Ctrl/Cmd+Click or multi-tap for toggle)
  const handleDateClick = (dateStr: string, e: React.MouseEvent) => {
    // Only handle left mouse click
    if (e.button !== 0) return;

    if (e.shiftKey && lastClickedDate) {
      // Range select from lastClickedDate to dateStr in current calendar grid
      const idxStart = daysGrid.findIndex((d) => d.dateStr === lastClickedDate);
      const idxEnd = daysGrid.findIndex((d) => d.dateStr === dateStr);

      if (idxStart !== -1 && idxEnd !== -1) {
        const minIdx = Math.min(idxStart, idxEnd);
        const maxIdx = Math.max(idxStart, idxEnd);
        const range = daysGrid.slice(minIdx, maxIdx + 1).map((d) => d.dateStr);
        setSelectedDates(range);
      }
    } else if (e.ctrlKey || e.metaKey || selectedDates.length > 0) {
      // Toggle date selection for touch/mobile or Ctrl/Cmd click
      if (selectedDates.includes(dateStr)) {
        const next = selectedDates.filter((d) => d !== dateStr);
        setSelectedDates(next);
        if (next.length === 0) setLastClickedDate(null);
      } else {
        setSelectedDates((prev) => [...prev, dateStr]);
        setLastClickedDate(dateStr);
      }
    } else {
      // Single date select or toggle off
      if (selectedDates.includes(dateStr) && selectedDates.length === 1) {
        setSelectedDates([]);
        setLastClickedDate(null);
      } else {
        setSelectedDates([dateStr]);
        setLastClickedDate(dateStr);
      }
    }
  };

  // Apply batch shift update
  const handleApplyBatchShift = (shiftTypeId: string) => {
    if (selectedDates.length === 0) return;

    // Filter out pinned dates
    const unpinnedDates = selectedDates.filter(
      (dStr) => !selectedEmployee.schedules[dStr]?.isPinned
    );

    if (onBatchSelectShifts) {
      onBatchSelectShifts(unpinnedDates, shiftTypeId);
    } else {
      unpinnedDates.forEach((dStr) => {
        onSelectShift(dStr, shiftTypeId);
      });
    }
    setSelectedDates([]);
  };

  // Group daysGrid into cycle blocks according to labor law system and employee cycleStartDate
  const system = currentSystem || selectedEmployee.scheduleSystem || '2-week';
  const cycleDays =
    system === '2-week' ? 14 : system === '4-week' ? 28 : system === '8-week' ? 56 : 7;

  // Legal basis description mapping
  const getLegalSystemInfo = (sys: ScheduleSystemType) => {
    switch (sys) {
      case '4-week':
        return {
          title: '四週變形工時週期 (28天/4週)',
          basis: '《勞基法》第30條之1（每4週內例假與休息日至少8日；每2週內至少2例假；允許調移例假不受連工作6日限制）',
        };
      case '8-week':
        return {
          title: '八週變形工時週期 (56天/8週)',
          basis: '《勞基法》第30條第3項（每8週內例假與休息日至少16日；每2週內至少2例假）',
        };
      case '2-week':
        return {
          title: '雙週變形工時週期 (14天/2週)',
          basis: '《勞基法》第30條第2項（每2週內例假與休息日至少4日；每7日至少1例假）',
        };
      case 'standard':
      default:
        return {
          title: '一般週工時週期 (7天/1週)',
          basis: '《勞基法》第30條第1項、第36條第1項（每7日中至少應有1日例假，1日休息日）',
        };
    }
  };

  const currentLegalInfo = getLegalSystemInfo(system);

  // Group days by their true labor law cycle range
  const cycleMap = new Map<
    string,
    {
      cycleNumber: number;
      cStartStr: string;
      cEndStr: string;
      days: typeof daysGrid;
    }
  >();

  daysGrid.forEach((day) => {
    const info = getCycleInfoForDate(day.dateStr, cycleDays, selectedEmployee.cycleStartDate);
    if (!cycleMap.has(info.cStartStr)) {
      cycleMap.set(info.cStartStr, {
        cycleNumber: info.cycleNumber,
        cStartStr: info.cStartStr,
        cEndStr: info.cEndStr,
        days: [],
      });
    }
    cycleMap.get(info.cStartStr)!.days.push(day);
  });

  const cycleGroups = Array.from(cycleMap.values());

  // Helper to chunk a cycle's days into Sun-Sat aligned week rows
  const buildCycleWeeks = (daysInCycle: typeof daysGrid) => {
    const rows: ((typeof daysGrid[0]) | null)[][] = [];
    let currentRow: ((typeof daysGrid[0]) | null)[] = Array(7).fill(null);

    daysInCycle.forEach((day) => {
      const dow = day.dayOfWeek; // 0=Sun ... 6=Sat
      if (dow === 0 && currentRow.some((slot) => slot !== null)) {
        rows.push(currentRow);
        currentRow = Array(7).fill(null);
      }
      currentRow[dow] = day;
    });

    if (currentRow.some((slot) => slot !== null)) {
      rows.push(currentRow);
    }

    return rows;
  };

  const weekHeaders = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

  // Source shift info when dragging
  const sourceShift = draggedDate ? getEffectiveShift(selectedEmployee.schedules, draggedDate) : undefined;
  const movingShiftTypeId = sourceShift ? sourceShift.shiftTypeId : 'shift_morning';

  return (
    <div className="bg-white border border-[#E9E7D4] rounded-2xl shadow-sm overflow-visible relative">
      {/* Month Header & Perpetual Navigation */}
      <div className="bg-[#F8F7EB] p-4 border-b border-[#E9E7D4] flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-t-2xl">
        {/* Title & Year Month Selector */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl border border-[#5A5A40]/20">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-[#2D2D2D] font-serif tracking-tight">
                {currentYear} 年 {currentMonth} 月
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#5A5A40] text-white font-semibold">
                {system === '2-week'
                  ? '雙週變形週期 (14天)'
                  : system === '4-week'
                  ? '四週變形週期 (28天)'
                  : system === '8-week'
                  ? '八週變形週期 (56天)'
                  : '一般週工時 (7天)'}
              </span>
            </div>
            <p className="text-xs text-[#8A8A70] mt-0.5">
              排班同仁：<strong className="text-[#5A5A40]">{selectedEmployee.name}</strong> ({selectedEmployee.role})
            </p>
          </div>
        </div>

        {/* Year/Month Switcher Controls */}
        <div className="flex items-center space-x-2">
          {/* Quick Year Select */}
          <select
            value={currentYear}
            onChange={(e) => onChangeYearMonth(Number(e.target.value), currentMonth)}
            className="bg-white border border-[#D9D7C2] text-[#2D2D2D] text-xs rounded-xl px-2.5 py-1.5 font-mono focus:ring-2 focus:ring-[#5A5A40] outline-none shadow-sm cursor-pointer"
          >
            {Array.from({ length: 11 }, (_, i) => 2020 + i).map((y) => (
              <option key={y} value={y}>
                {y} 年
              </option>
            ))}
          </select>

          {/* Quick Month Select */}
          <select
            value={currentMonth}
            onChange={(e) => onChangeYearMonth(currentYear, Number(e.target.value))}
            className="bg-white border border-[#D9D7C2] text-[#2D2D2D] text-xs rounded-xl px-2.5 py-1.5 font-mono focus:ring-2 focus:ring-[#5A5A40] outline-none shadow-sm cursor-pointer"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m} 月
              </option>
            ))}
          </select>

          <div className="h-4 w-px bg-[#E9E7D4] mx-1" />

          {/* Prev / Next Month */}
          <div className="flex bg-white rounded-xl border border-[#D9D7C2] p-0.5 shadow-sm">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 text-[#5A5A40] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] rounded-lg transition-colors cursor-pointer"
              title="上個月"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold text-[#5A5A40] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] rounded-lg transition-colors cursor-pointer"
            >
              今
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 text-[#5A5A40] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] rounded-lg transition-colors cursor-pointer"
              title="下個月"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Snapped Legal Boundary Alert Toast */}
      {snappedFeedback && snappedFeedback.wasAdjusted && (
        <div className="bg-[#D9A05B]/15 border-b border-[#D9A05B]/30 p-3 text-[#2D2D2D] text-xs flex items-center justify-between animate-in slide-in-from-top duration-300">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-[#D9A05B] flex-shrink-0 animate-pulse" />
            <div>
              <strong className="font-bold text-[#D17A60]">🛡️ 觸發勞基法防護：已自動卡位至最靠近的合法位置！</strong>
              <p className="text-[#8A8A70] text-[11px] mt-0.5">{snappedFeedback.reason}</p>
            </div>
          </div>
          {onDismissSnappedFeedback && (
            <button
              onClick={onDismissSnappedFeedback}
              className="p-1 hover:bg-[#D9A05B]/20 rounded-lg transition-colors cursor-pointer text-[#8A8A70] hover:text-[#2D2D2D]"
              title="關閉提示"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Weekday Columns Header */}
      <div className="grid grid-cols-7 bg-[#F8F7EB] border-b border-[#E9E7D4] text-center text-xs font-bold text-[#8A8A70] py-2">
        {weekHeaders.map((wh, idx) => (
          <div
            key={wh}
            className={`${idx === 0 || idx === 6 ? 'text-[#D17A60]' : 'text-[#5A5A40]'}`}
          >
            {wh}
          </div>
        ))}
      </div>

      {/* Perpetual Days Grid grouped by Legal Cycles */}
      <div className="p-3 bg-[#E9E7D4]/30 space-y-4">
        {cycleGroups.map((cg) => {
          const weekRows = buildCycleWeeks(cg.days);

          return (
            <div
              key={cg.cStartStr}
              className="bg-white/90 border-2 border-[#5A5A40]/40 rounded-2xl p-2.5 sm:p-3 shadow-md space-y-2 relative"
            >
              {/* Cycle Frame Header Label */}
              <div className="flex flex-wrap items-center justify-between bg-[#F8F7EB] border border-[#E9E7D4] px-3 py-2 rounded-xl text-xs font-bold text-[#5A5A40] gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-[#5A5A40] text-white px-2 py-0.5 rounded text-[11px] font-mono shadow-sm">
                    第 {cg.cycleNumber} 週期 ({cycleDays} 天 / {cycleDays / 7} 週)
                  </span>
                </div>
                <span className="text-[11px] text-[#5A5A40] font-mono font-bold bg-[#5A5A40]/10 px-2.5 py-0.5 rounded-lg border border-[#5A5A40]/20">
                  週期範圍：{cg.cStartStr} ~ {cg.cEndStr}
                </span>
              </div>

              {/* Weeks inside this cycle block */}
              <div className="space-y-1.5">
                {weekRows.map((week, wIdx) => (
                  <div key={wIdx} className="grid grid-cols-7 gap-1">
                    {week.map((day, dIdx) => {
                      if (!day) {
                        return <div key={`empty-${dIdx}`} className="min-h-[110px]" />;
                      }

                      const dayShift = getEffectiveShift(selectedEmployee.schedules, day.dateStr);
                      const shiftType = dayShift
                        ? allShiftTypes.find((s) => s.id === dayShift.shiftTypeId)
                        : undefined;

                      const isHighlighted = highlightDates.includes(day.dateStr);
                      const isSnappedTarget =
                        snappedFeedback?.wasAdjusted && snappedFeedback.snappedDate === day.dateStr;
                      const isSelected = selectedDates.includes(day.dateStr);
                      const isPinned = !!dayShift?.isPinned;

                      // Test if target day is illegal drop location during drag
                      let isIllegalTarget = false;
                      if (draggedDate && draggedDate !== day.dateStr) {
                        const testResult = findNearestLegalDate(
                          selectedEmployee.schedules,
                          draggedDate,
                          day.dateStr,
                          movingShiftTypeId,
                          system,
                          allShiftTypes,
                          28,
                          selectedEmployee.cycleStartDate
                        );
                        if (!testResult.allowed || testResult.snappedDate !== day.dateStr) {
                          isIllegalTarget = true;
                        }
                      }

                      return (
                        <div
                          key={day.dateStr}
                          onClick={(e) => handleDateClick(day.dateStr, e)}
                          className={`min-h-[110px] p-2 rounded-xl border flex flex-col justify-between transition-all relative ${
                            isIllegalTarget
                              ? 'opacity-30 blur-[0.5px] grayscale bg-slate-100 border-slate-300 pointer-events-none select-none'
                              : isSelected
                              ? 'bg-[#5A5A40]/15 border-[#5A5A40] ring-2 ring-[#5A5A40] shadow-md z-20'
                              : !day.isCurrentMonth
                              ? 'bg-[#F8F7EB]/40 border-[#E9E7D4] opacity-40'
                              : day.isToday
                              ? 'bg-[#5A5A40]/10 border-[#5A5A40] ring-1 ring-[#5A5A40]/30'
                              : isHighlighted
                              ? 'bg-[#D17A60]/10 border-[#D17A60] ring-2 ring-[#D17A60] animate-pulse'
                              : 'bg-white border-[#E9E7D4] hover:border-[#5A5A40]'
                          }`}
                        >
                          {/* Illegal drop watermark */}
                          {isIllegalTarget && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-30 rounded-xl pointer-events-none">
                              <span className="text-[10px] font-bold text-red-600 bg-white/90 px-1.5 py-0.5 rounded shadow">
                                🚫 不符合勞基法
                              </span>
                            </div>
                          )}

                          {/* Day Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-1">
                              <span
                                className={`font-mono font-black text-sm ${
                                  day.isToday
                                    ? 'text-[#5A5A40] bg-[#5A5A40]/15 px-1.5 py-0.5 rounded'
                                    : day.isWeekend
                                    ? 'text-[#D17A60]'
                                    : 'text-[#2D2D2D]'
                                }`}
                              >
                                {day.dayNumber}
                              </span>
                              {day.isToday && (
                                <span className="text-[9px] text-[#5A5A40] font-bold">今</span>
                              )}
                              {isSelected && (
                                <CheckSquare className="w-3.5 h-3.5 text-[#5A5A40] inline ml-0.5" />
                              )}
                            </div>

                            {/* National Holiday Badge */}
                            {day.nationalHoliday && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[#D17A60]/15 text-[#D17A60] border border-[#D17A60]/30 truncate max-w-[80px]"
                                title={day.nationalHoliday.name}
                              >
                                🏮 {day.nationalHoliday.name.split(' ')[0]}
                              </span>
                            )}
                          </div>

                          {/* Shift Tile Block */}
                          <div className="my-1">
                            <ShiftBlockTile
                              dateStr={day.dateStr}
                              shiftType={shiftType}
                              allShiftTypes={allShiftTypes}
                              onSelectShift={onSelectShift}
                              onSlideShift={onSlideShift}
                              isPinned={isPinned}
                              onTogglePin={onTogglePin}
                              isDragOver={dragOverDate === day.dateStr}
                              onDragStart={(e, dStr) => {
                                setDraggedDate(dStr);
                              }}
                              onDragOver={() => setDragOverDate(day.dateStr)}
                              onDrop={(e, targetDateStr) => {
                                setDragOverDate(null);
                                if (draggedDate && draggedDate !== targetDateStr) {
                                  onDragDropShift(draggedDate, targetDateStr);
                                }
                                setDraggedDate(null);
                              }}
                              isSnappedTarget={isSnappedTarget}
                              isIllegalTarget={isIllegalTarget}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Multi-Date Selection Action Bar */}
      {selectedDates.length > 0 && (
        <div className="sticky bottom-4 mx-auto max-w-3xl w-[94%] sm:w-[92%] bg-[#2D2D2D] text-white p-3 rounded-2xl shadow-2xl border border-[#5A5A40] z-50 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center space-x-2 text-left w-full sm:w-auto">
            <span className="bg-[#5A5A40] text-white p-1.5 rounded-xl font-bold flex-shrink-0">
              <Layers className="w-4 h-4" />
            </span>
            <div className="flex-1">
              <div className="text-xs font-bold flex items-center gap-1.5">
                <span>已選取 <span className="text-yellow-400 font-mono text-sm">{selectedDates.length}</span> 個日期</span>
              </div>
              <p className="text-[10px] text-gray-300 hidden md:block">
                點擊日期可多選或取消，長按 Shift 可範圍連選。點選班別即刻套用：
              </p>
              <p className="text-[10px] text-gray-300 block md:hidden">
                點擊日期可多選／取消，點選班別即可批次套用：
              </p>
            </div>

            <button
              onClick={() => {
                setSelectedDates([]);
                setLastClickedDate(null);
              }}
              className="sm:hidden text-xs bg-red-500/20 text-red-300 hover:bg-red-500/40 px-2 py-1 rounded-lg border border-red-500/30 flex-shrink-0 font-bold"
            >
              取消選取
            </button>
          </div>

          {/* Quick Shift Selection Buttons */}
          <div className="flex items-center space-x-1.5 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
            {allShiftTypes.map((st) => (
              <button
                key={st.id}
                onClick={() => handleApplyBatchShift(st.id)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold transition-transform hover:scale-105 active:scale-95 shadow cursor-pointer border border-white/20"
                style={{ backgroundColor: st.color, color: st.textColor }}
                title={`批次設置為：${st.name}`}
              >
                {st.code}
              </button>
            ))}

            {/* Clear Shift Button */}
            <button
              onClick={() => handleApplyBatchShift('shift_empty')}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer border border-slate-500"
              title="清除班別"
            >
              空班
            </button>

            {/* Cancel Selection (Desktop) */}
            <button
              onClick={() => {
                setSelectedDates([]);
                setLastClickedDate(null);
              }}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-red-500/80 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="取消框選"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>取消</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
