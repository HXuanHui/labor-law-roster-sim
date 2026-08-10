import React, { useState, useEffect } from 'react';
import { Employee, NationalHoliday, ScheduleSystemType, ShiftType, SnapResult } from '../types';
import { getMonthCalendarGrid } from '../utils/perpetualCalendar';
import { ShiftBlockTile } from './ShiftBlockTile';
import { findNearestLegalDate, getEffectiveShift, getCycleInfoForDate, isEmptyShiftTypeId } from '../utils/laborLaws';
import { EMPTY_SHIFT_TYPE_ID } from '../constants/shifts';
import { getContrastingTextColor } from '../utils/colorContrast';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  AlertTriangle,
  Layers,
  CheckSquare,
  XCircle,
  ChevronDown,
  Settings2,
  Plus,
} from 'lucide-react';

/**
 * 月曆排班主檢視屬性。
 */
interface CalendarMonthViewProps {
  /** 目前顯示西元年。 */
  currentYear: number;
  /** 目前顯示月份 (1-12)。 */
  currentMonth: number;
  /** 切換年月回呼。 */
  onChangeYearMonth: (year: number, month: number) => void;
  /** 目前檢視同仁。 */
  selectedEmployee: Employee;
  /** 覆寫／目前套用的工時制度。 */
  currentSystem?: ScheduleSystemType;
  /** 全部班別定義。 */
  allShiftTypes: ShiftType[];
  /** 國定／自訂假日。 */
  nationalHolidays: NationalHoliday[];
  /** 單日選班回呼。 */
  onSelectShift: (dateStr: string, shiftTypeId: string) => void;
  /** 批次選班回呼。 */
  onBatchSelectShifts?: (dateStrs: string[], shiftTypeId: string) => void;
  /**
   * 套用「調」班前請求指定畫面上的「國」班來源。
   * @param dateStrs 目標補假日期（通常取第一個未釘選日）
   */
  onRequestMakeupShift?: (dateStrs: string[]) => void;
  /** 班別左右平移回呼。 */
  onSlideShift: (dateStr: string, direction: 'left' | 'right') => void;
  /** 拖放換日回呼。 */
  onDragDropShift: (fromDateStr: string, targetDateStr: string) => void;
  /** 釘選切換回呼。 */
  onTogglePin?: (dateStr: string) => void;
  /** 開啟班別設定（黑列常駐 +）。 */
  onOpenShiftModal?: () => void;
  /** 加減加班時數。 */
  onAdjustOvertime?: (dateStr: string, deltaHours: number) => void;
  /** 支用或還原補休（正＝支用、負＝還原）。 */
  onTakeCompLeave?: (dateStr: string, deltaHours?: number) => void;
  /** 直接設定當日顯示總工時。 */
  onSetDayHours?: (dateStr: string, displayHours: number) => void;
  /** 本月可支用補休庫存（小時）。 */
  compLeaveBankHours?: number;
  /** 檢核高亮日期。 */
  highlightDates?: string[];
  /** 勞基法卡位回饋。 */
  snappedFeedback?: SnapResult | null;
  /** 關閉卡位提示。 */
  onDismissSnappedFeedback?: () => void;
}

/**
 * 依勞基法週期分組的月曆排班檢視。
 * 窄螢幕會收合年月工具列，日格改為色塊優先以避免文字擠壓。
 */
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
  onRequestMakeupShift,
  onSlideShift,
  onDragDropShift,
  onTogglePin,
  onOpenShiftModal,
  onAdjustOvertime,
  onTakeCompLeave,
  onSetDayHours,
  compLeaveBankHours = 0,
  highlightDates = [],
  snappedFeedback,
  onDismissSnappedFeedback,
}) => {
  const [draggedDate, setDraggedDate] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [lastClickedDate, setLastClickedDate] = useState<string | null>(null);
  /** 窄螢幕年月導覽面板是否展開 */
  const [navOpen, setNavOpen] = useState(false);

  // Esc 取消多選；桌面寬度時關閉導覽面板
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        setSelectedDates([]);
        setLastClickedDate(null);
        setNavOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setNavOpen(false);
    };
    handleChange(mq);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const daysGrid = getMonthCalendarGrid(currentYear, currentMonth, nationalHolidays);

  /** 切換至上個月。 */
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      onChangeYearMonth(currentYear - 1, 12);
    } else {
      onChangeYearMonth(currentYear, currentMonth - 1);
    }
  };

  /** 切換至下個月。 */
  const handleNextMonth = () => {
    if (currentMonth === 12) {
      onChangeYearMonth(currentYear + 1, 1);
    } else {
      onChangeYearMonth(currentYear, currentMonth + 1);
    }
  };

  /** 跳至系統今日所在年月。 */
  const handleToday = () => {
    const today = new Date();
    onChangeYearMonth(today.getFullYear(), today.getMonth() + 1);
  };

  /**
   * OS 風格日期點選：Shift 範圍選、Ctrl/Cmd 或已多選時切換選取。
   * @param dateStr 目標日期
   * @param e 滑鼠事件
   */
  const handleDateClick = (dateStr: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;

    if (e.shiftKey && lastClickedDate) {
      const idxStart = daysGrid.findIndex((d) => d.dateStr === lastClickedDate);
      const idxEnd = daysGrid.findIndex((d) => d.dateStr === dateStr);

      if (idxStart !== -1 && idxEnd !== -1) {
        const minIdx = Math.min(idxStart, idxEnd);
        const maxIdx = Math.max(idxStart, idxEnd);
        const range = daysGrid.slice(minIdx, maxIdx + 1).map((d) => d.dateStr);
        setSelectedDates(range);
      }
    } else if (e.ctrlKey || e.metaKey || selectedDates.length > 0) {
      if (selectedDates.includes(dateStr)) {
        const next = selectedDates.filter((d) => d !== dateStr);
        setSelectedDates(next);
        if (next.length === 0) setLastClickedDate(null);
      } else {
        setSelectedDates((prev) => [...prev, dateStr]);
        setLastClickedDate(dateStr);
      }
    } else {
      if (selectedDates.includes(dateStr) && selectedDates.length === 1) {
        setSelectedDates([]);
        setLastClickedDate(null);
      } else {
        setSelectedDates([dateStr]);
        setLastClickedDate(dateStr);
      }
    }
  };

  /**
   * 將目前選取日期批次套用班別（略過已釘選）。
   * 「調」班改走來源挑選（指定畫面上哪個「國」班）。
   * @param shiftTypeId 目標班別 ID
   */
  const handleApplyBatchShift = (shiftTypeId: string) => {
    if (selectedDates.length === 0) return;

    const unpinnedDates = selectedDates.filter(
      (dStr) => !selectedEmployee.schedules[dStr]?.isPinned
    );
    if (unpinnedDates.length === 0) return;

    // 手動「調」必須指定對應的畫面「國」班，才能記入休／例
    if (shiftTypeId === 'shift_national_holiday_makeup' && onRequestMakeupShift) {
      onRequestMakeupShift(unpinnedDates);
      setSelectedDates([]);
      return;
    }

    if (onBatchSelectShifts) {
      onBatchSelectShifts(unpinnedDates, shiftTypeId);
    } else {
      unpinnedDates.forEach((dStr) => {
        onSelectShift(dStr, shiftTypeId);
      });
    }
    setSelectedDates([]);
  };

  const system = currentSystem || selectedEmployee.scheduleSystem || '2-week';
  const cycleDays =
    system === '2-week' ? 14 : system === '4-week' ? 28 : system === '8-week' ? 56 : 7;

  /**
   * 依制度代碼取得短／長標籤。
   * @param sys 工時制度
   * @returns 顯示用標籤
   */
  const getSystemBadge = (sys: ScheduleSystemType) => {
    switch (sys) {
      case '4-week':
        return { short: '四週', full: '四週變形週期 (28天)' };
      case '8-week':
        return { short: '八週', full: '八週變形週期 (56天)' };
      case '2-week':
        return { short: '雙週', full: '雙週變形週期 (14天)' };
      default:
        return { short: '一般', full: '一般週工時 (7天)' };
    }
  };

  const systemBadge = getSystemBadge(system);

  // 依真實勞基法週期範圍分組月曆格子
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

  /**
   * 將週期內日期切成週日～週六對齊的列。
   * @param daysInCycle 該週期涵蓋的日期
   * @returns 每列 7 格（無日期為 null）
   */
  const buildCycleWeeks = (daysInCycle: typeof daysGrid) => {
    const rows: ((typeof daysGrid[0]) | null)[][] = [];
    let currentRow: ((typeof daysGrid[0]) | null)[] = Array(7).fill(null);

    daysInCycle.forEach((day) => {
      const dow = day.dayOfWeek;
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

  const weekHeadersFull = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  const weekHeadersShort = ['日', '一', '二', '三', '四', '五', '六'];

  const sourceShift = draggedDate
    ? getEffectiveShift(selectedEmployee.schedules, draggedDate, nationalHolidays)
    : undefined;
  const movingShiftTypeId = sourceShift ? sourceShift.shiftTypeId : 'shift_morning';

  /**
   * 年月切換控制項（桌面直出／行動收合共用）。
   * @returns 年／月下拉與前後月按鈕
   */
  const renderNavControls = () => (
    <div className="flex flex-wrap items-center gap-2">
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

      <div className="hidden sm:block h-4 w-px bg-[#E9E7D4] mx-0.5" />

      <div className="flex bg-white rounded-xl border border-[#D9D7C2] p-0.5 shadow-sm">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1.5 text-[#5A5A40] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] rounded-lg transition-colors cursor-pointer"
          title="上個月"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleToday}
          className="px-2.5 py-1 text-xs font-semibold text-[#5A5A40] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] rounded-lg transition-colors cursor-pointer"
        >
          今
        </button>
        <button
          type="button"
          onClick={handleNextMonth}
          className="p-1.5 text-[#5A5A40] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] rounded-lg transition-colors cursor-pointer"
          title="下個月"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white border border-[#E9E7D4] rounded-2xl shadow-sm overflow-visible relative">
      {/* 月曆標題與年月導覽 */}
      <div className="bg-[#F8F7EB] p-3 sm:p-4 border-b border-[#E9E7D4] rounded-t-2xl space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-2 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl border border-[#5A5A40]/20 flex-shrink-0">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-[#2D2D2D] font-serif tracking-tight">
                  {currentYear} 年 {currentMonth} 月
                </h2>
                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-[#5A5A40] text-white font-semibold">
                  <span className="sm:hidden">{systemBadge.short}</span>
                  <span className="hidden sm:inline">{systemBadge.full}</span>
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#8A8A70] mt-0.5 truncate">
                <span className="sm:hidden">{selectedEmployee.name}</span>
                <span className="hidden sm:inline">
                  排班同仁：
                  <strong className="text-[#5A5A40]">{selectedEmployee.name}</strong> (
                  {selectedEmployee.role})
                </span>
              </p>
            </div>
          </div>

          {/* 窄螢幕：快速前後月 + 導覽收合鈕 */}
          <div className="flex items-center gap-1.5 sm:hidden flex-shrink-0">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl bg-white border border-[#D9D7C2] text-[#5A5A40] shadow-sm cursor-pointer"
              title="上個月"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl bg-white border border-[#D9D7C2] text-[#5A5A40] shadow-sm cursor-pointer"
              title="下個月"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setNavOpen((v) => !v)}
              className="p-2 rounded-xl bg-white border border-[#D9D7C2] text-[#5A5A40] shadow-sm cursor-pointer flex items-center gap-0.5"
              aria-expanded={navOpen}
              aria-controls="calendar-nav-panel"
              title={navOpen ? '收合年月選項' : '展開年月選項'}
            >
              <Settings2 className="w-4 h-4" />
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  navOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          {/* 桌面：完整年月控制直出 */}
          <div className="hidden sm:block">{renderNavControls()}</div>
        </div>

        {/* 窄螢幕展開：完整年月下拉與「今」 */}
        <div
          id="calendar-nav-panel"
          className={`sm:hidden overflow-hidden transition-all duration-300 ease-out ${
            navOpen ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
          }`}
        >
          <div className="pt-1 border-t border-[#E9E7D4]">{renderNavControls()}</div>
        </div>
      </div>

      {/* 窄螢幕班別色票圖例（僅色無字時輔助辨識） */}
      <div className="md:hidden px-3 py-2 border-b border-[#E9E7D4] bg-white/80">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
          <span className="text-[10px] font-bold text-[#8A8A70] whitespace-nowrap flex-shrink-0">
            色票
          </span>
          {allShiftTypes.map((st) => (
            <div
              key={st.id}
              className="flex items-center gap-1 flex-shrink-0"
              title={`${st.code} ${st.name}`}
            >
              <span
                className="w-3 h-3 rounded-sm border border-black/10 shadow-sm"
                style={{ backgroundColor: st.color }}
              />
              <span className="text-[10px] font-mono font-bold text-[#5A5A40]">{st.code}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 勞基法卡位提示 */}
      {snappedFeedback && snappedFeedback.wasAdjusted && (
        <div className="bg-[#D9A05B]/15 border-b border-[#D9A05B]/30 p-3 text-[#2D2D2D] text-xs flex items-start sm:items-center justify-between gap-2 animate-in slide-in-from-top duration-300">
          <div className="flex items-start sm:items-center space-x-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-[#D9A05B] flex-shrink-0 animate-pulse mt-0.5 sm:mt-0" />
            <div className="min-w-0">
              <strong className="font-bold text-[#D17A60] text-[11px] sm:text-xs">
                觸發勞基法防護：已自動卡位至最靠近的合法位置
              </strong>
              <p className="text-[#8A8A70] text-[10px] sm:text-[11px] mt-0.5 break-words">
                {snappedFeedback.reason}
              </p>
            </div>
          </div>
          {onDismissSnappedFeedback && (
            <button
              onClick={onDismissSnappedFeedback}
              className="p-1 hover:bg-[#D9A05B]/20 rounded-lg transition-colors cursor-pointer text-[#8A8A70] hover:text-[#2D2D2D] flex-shrink-0"
              title="關閉提示"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* 星期欄 */}
      <div className="grid grid-cols-7 bg-[#F8F7EB] border-b border-[#E9E7D4] text-center text-[10px] sm:text-xs font-bold text-[#8A8A70] py-1.5 sm:py-2">
        {weekHeadersFull.map((wh, idx) => (
          <div
            key={wh}
            className={`${idx === 0 || idx === 6 ? 'text-[#D17A60]' : 'text-[#5A5A40]'}`}
          >
            <span className="sm:hidden">{weekHeadersShort[idx]}</span>
            <span className="hidden sm:inline">{wh}</span>
          </div>
        ))}
      </div>

      {/* 依週期分組的格子 */}
      <div className="p-1.5 sm:p-3 bg-[#E9E7D4]/30 space-y-3 sm:space-y-4">
        {cycleGroups.map((cg) => {
          const weekRows = buildCycleWeeks(cg.days);

          return (
            <div
              key={cg.cStartStr}
              className="bg-white/90 border-2 border-[#5A5A40]/40 rounded-xl sm:rounded-2xl p-1.5 sm:p-3 shadow-md space-y-1.5 sm:space-y-2 relative"
            >
              <div className="flex flex-wrap items-center justify-between bg-[#F8F7EB] border border-[#E9E7D4] px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-bold text-[#5A5A40] gap-1.5">
                <span className="bg-[#5A5A40] text-white px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-mono shadow-sm">
                  第 {cg.cycleNumber} 週期
                  <span className="hidden sm:inline">
                    {' '}
                    ({cycleDays} 天 / {cycleDays / 7} 週)
                  </span>
                </span>
                <span className="text-[9px] sm:text-[11px] text-[#5A5A40] font-mono font-bold bg-[#5A5A40]/10 px-1.5 sm:px-2.5 py-0.5 rounded-lg border border-[#5A5A40]/20 truncate max-w-full">
                  <span className="sm:hidden">
                    {cg.cStartStr.slice(5)}～{cg.cEndStr.slice(5)}
                  </span>
                  <span className="hidden sm:inline">
                    週期範圍：{cg.cStartStr} ~ {cg.cEndStr}
                  </span>
                </span>
              </div>

              <div className="space-y-1 sm:space-y-1.5">
                {weekRows.map((week, wIdx) => (
                  <div key={wIdx} className="grid grid-cols-7 gap-0.5 sm:gap-1">
                    {week.map((day, dIdx) => {
                      if (!day) {
                        return (
                          <div
                            key={`empty-${dIdx}`}
                            className="min-h-[56px] sm:min-h-[110px]"
                          />
                        );
                      }

                      const dayShift = getEffectiveShift(
                        selectedEmployee.schedules,
                        day.dateStr,
                        nationalHolidays
                      );
                      // 空班哨兵：畫面不顯示休／例／國假色塊，視為尚未排班
                      const shiftType =
                        dayShift && !isEmptyShiftTypeId(dayShift.shiftTypeId)
                          ? allShiftTypes.find((s) => s.id === dayShift.shiftTypeId)
                          : undefined;

                      const isHighlighted = highlightDates.includes(day.dateStr);
                      const isSnappedTarget =
                        snappedFeedback?.wasAdjusted &&
                        snappedFeedback.snappedDate === day.dateStr;
                      const isSelected = selectedDates.includes(day.dateStr);
                      const isPinned = !!dayShift?.isPinned;

                      // 拖曳中預先標示不合法落點
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
                          selectedEmployee.cycleStartDate,
                          nationalHolidays
                        );
                        if (!testResult.allowed || testResult.snappedDate !== day.dateStr) {
                          isIllegalTarget = true;
                        }
                      }

                      return (
                        <div
                          key={day.dateStr}
                          onClick={(e) => handleDateClick(day.dateStr, e)}
                          className={`min-h-[56px] sm:min-h-[110px] p-1 sm:p-2 rounded-lg sm:rounded-xl border flex flex-col justify-between transition-all relative ${
                            isIllegalTarget
                              ? 'opacity-30 blur-[0.5px] grayscale bg-slate-100 border-slate-300 pointer-events-none select-none'
                              : isSelected
                              ? 'bg-[#5A5A40]/15 border-[#5A5A40] ring-1 sm:ring-2 ring-[#5A5A40] shadow-md z-20'
                              : !day.isCurrentMonth
                              ? 'bg-[#F8F7EB]/40 border-[#E9E7D4] opacity-40'
                              : day.isToday
                              ? 'bg-[#5A5A40]/10 border-[#5A5A40] ring-1 ring-[#5A5A40]/30'
                              : isHighlighted
                              ? 'bg-[#D17A60]/10 border-[#D17A60] ring-1 sm:ring-2 ring-[#D17A60] animate-pulse'
                              : 'bg-white border-[#E9E7D4] hover:border-[#5A5A40]'
                          }`}
                        >
                          {isIllegalTarget && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-30 rounded-lg sm:rounded-xl pointer-events-none">
                              <span className="text-[8px] sm:text-[10px] font-bold text-red-600 bg-white/90 px-1 py-0.5 rounded shadow">
                                規則限制
                              </span>
                            </div>
                          )}

                          <div className="flex items-start justify-between gap-0.5">
                            <div className="flex items-center gap-0.5 min-w-0">
                              <span
                                className={`font-mono font-black text-[11px] sm:text-sm ${
                                  day.isToday
                                    ? 'text-[#5A5A40] bg-[#5A5A40]/15 px-1 py-0.5 rounded'
                                    : day.isWeekend
                                    ? 'text-[#D17A60]'
                                    : 'text-[#2D2D2D]'
                                }`}
                              >
                                {day.dayNumber}
                              </span>
                              {day.isToday && (
                                <span className="hidden sm:inline text-[9px] text-[#5A5A40] font-bold">
                                  今
                                </span>
                              )}
                              {isSelected && (
                                <CheckSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#5A5A40] flex-shrink-0" />
                              )}
                            </div>

                            {/* 假日：窄螢幕僅紅點，桌面顯示名稱 */}
                            {day.nationalHoliday && (
                              <>
                                <span
                                  className="md:hidden w-1.5 h-1.5 rounded-full bg-[#D17A60] flex-shrink-0 mt-1"
                                  title={day.nationalHoliday.name}
                                />
                                <span
                                  className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded font-medium bg-[#D17A60]/15 text-[#D17A60] border border-[#D17A60]/30 truncate max-w-[80px]"
                                  title={day.nationalHoliday.name}
                                >
                                  {day.nationalHoliday.name.split(' ')[0]}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="mt-0.5 sm:my-1 flex-1 flex flex-col justify-end">
                            <ShiftBlockTile
                              dateStr={day.dateStr}
                              shiftType={shiftType}
                              onSlideShift={onSlideShift}
                              isPinned={isPinned}
                              onTogglePin={onTogglePin}
                              isDragOver={dragOverDate === day.dateStr}
                              onDragStart={(e, dStr) => {
                                e.dataTransfer.setData('text/plain', dStr);
                                setDraggedDate(dStr);
                              }}
                              onDragOver={() => setDragOverDate(day.dateStr)}
                              onDragEnd={() => {
                                setDragOverDate(null);
                                setDraggedDate(null);
                              }}
                              onDrop={(e, targetDateStr) => {
                                setDragOverDate(null);
                                // 優先用 dataTransfer，避免 dragEnd 提早清空 state 導致放不下
                                const fromDate =
                                  e.dataTransfer.getData('text/plain') || draggedDate;
                                if (fromDate && fromDate !== targetDateStr) {
                                  onDragDropShift(fromDate, targetDateStr);
                                }
                                setDraggedDate(null);
                              }}
                              isSnappedTarget={isSnappedTarget}
                              isIllegalTarget={isIllegalTarget}
                              colorOnlyOnNarrow
                              overtimeHours={
                                selectedEmployee.schedules[day.dateStr]?.overtimeHours || 0
                              }
                              compLeaveHours={
                                selectedEmployee.schedules[day.dateStr]?.compLeaveHours || 0
                              }
                              compLeaveBankHours={compLeaveBankHours}
                              onAdjustOvertime={onAdjustOvertime}
                              onTakeCompLeave={onTakeCompLeave}
                              onSetDayHours={onSetDayHours}
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

      {/* 選取後才顯示黑色操作列 */}
      {selectedDates.length > 0 && (
        <div className="sticky bottom-4 mx-auto max-w-3xl w-[94%] sm:w-[92%] bg-[#2D2D2D] text-white p-3 rounded-2xl shadow-2xl border border-[#5A5A40] z-50 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center space-x-2 text-left w-full sm:w-auto min-w-0">
            <span className="bg-[#5A5A40] text-white p-1.5 rounded-xl font-bold flex-shrink-0">
              <Layers className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold">
                已選取{' '}
                <span className="text-yellow-400 font-mono text-sm">{selectedDates.length}</span> 日
              </div>
              <p className="text-[10px] text-gray-300 hidden md:block">
                點選班別套用；右側 + 可新增班別
              </p>
              <p className="text-[10px] text-gray-300 block md:hidden">點選班別套用</p>
            </div>
            <button
              onClick={() => {
                setSelectedDates([]);
                setLastClickedDate(null);
              }}
              className="sm:hidden text-xs bg-red-500/20 text-red-300 hover:bg-red-500/40 px-2 py-1 rounded-lg border border-red-500/30 flex-shrink-0 font-bold"
            >
              取消
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
            {allShiftTypes.map((st) => (
              <button
                key={st.id}
                onClick={() => handleApplyBatchShift(st.id)}
                className="min-w-8 h-8 sm:h-auto sm:px-2.5 sm:py-1 px-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-transform hover:scale-105 active:scale-95 shadow cursor-pointer border border-white/20 flex items-center justify-center"
                style={{ backgroundColor: st.color, color: getContrastingTextColor(st.color) }}
                title={`批次設置為：${st.name}`}
              >
                {st.code}
              </button>
            ))}
            <button
              onClick={() => handleApplyBatchShift(EMPTY_SHIFT_TYPE_ID)}
              className="min-w-8 h-8 sm:h-auto sm:px-2.5 sm:py-1 px-1.5 rounded-lg text-[10px] sm:text-xs font-bold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer border border-slate-500"
              title="清除當天排班（非休息日／例假／國定假日）"
            >
              空
            </button>
            {onOpenShiftModal && (
              <button
                type="button"
                onClick={onOpenShiftModal}
                className="min-w-8 h-8 sm:h-auto sm:px-2.5 sm:py-1 px-1.5 rounded-lg text-[10px] sm:text-xs font-bold bg-[#5A5A40] hover:bg-[#484833] text-white transition-colors cursor-pointer border border-white/20 flex items-center justify-center gap-0.5"
                title="新增／編輯班別"
                aria-label="新增班別"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
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
