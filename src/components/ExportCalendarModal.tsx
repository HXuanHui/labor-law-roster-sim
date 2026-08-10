import React, { useState, useMemo } from 'react';
import { Employee, ShiftType, NationalHoliday, ScheduleSystemType } from '../types';
import { SYSTEM_CONFIGS } from '../constants/systems';
import { getEffectiveShift, getShiftType } from '../utils/laborLaws';
import { getContrastingTextColor } from '../utils/colorContrast';
import {
  X,
  Printer,
  Calendar,
  Users,
  Download,
  Info,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sun,
  FileText
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  parseISO,
  getDaysInMonth
} from 'date-fns';

/**
 * 匯出／列印行事曆 Modal 的屬性。
 */
interface ExportCalendarModalProps {
  /** 是否開啟 Modal。 */
  isOpen: boolean;
  /** 關閉 Modal 回呼。 */
  onClose: () => void;
  /** 全部同仁清單。 */
  employees: Employee[];
  /** 目前在主畫面選中的同仁 ID（用於預設檢視對象）。 */
  selectedEmployeeId: string;
  /** 班別設定（含色塊與工時）。 */
  shiftTypes: ShiftType[];
  /** 國定假日清單。 */
  nationalHolidays: NationalHoliday[];
  /** 目前系統預設制度（保留相容）。 */
  currentSystem: ScheduleSystemType;
}

/**
 * 匯出排班年曆／月曆，並透過瀏覽器列印或另存 PDF。
 * @param props - Modal 屬性（開關狀態、同仁與班別資料）。
 * @returns Modal 內容；關閉時回傳 null。
 */
export const ExportCalendarModal: React.FC<ExportCalendarModalProps> = ({
  isOpen,
  onClose,
  employees,
  selectedEmployeeId,
  shiftTypes,
  nationalHolidays,
  currentSystem,
}) => {
  const [exportScope, setExportScope] = useState<'year' | 'month'>('year');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [targetEmployeeId, setTargetEmployeeId] = useState<string>(selectedEmployeeId || (employees[0]?.id || 'all'));
  const [showNotes, setShowNotes] = useState<boolean>(true);

  // 必須在 early return 之前呼叫 hooks，避免開關 modal 時 hooks 數量不一致導致整頁崩潰
  const targetEmployees = useMemo(() => {
    if (targetEmployeeId === 'all') return employees;
    const found = employees.find((e) => e.id === targetEmployeeId);
    return found ? [found] : employees;
  }, [employees, targetEmployeeId]);

  if (!isOpen) return null;

  const yearOptions = [2025, 2026, 2027, 2028];
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const weekDayHeaders = ['日', '一', '二', '三', '四', '五', '六'];

  // Helper to get shift styling & info for a date
  const getDayShiftInfo = (emp: Employee, dateStr: string) => {
    const dayShift = getEffectiveShift(emp.schedules, dateStr, nationalHolidays);
    const shiftType = getShiftType(dayShift.shiftTypeId, shiftTypes);
    const isHoliday = nationalHolidays.some((h) => h.date === dateStr);
    const holidayObj = nationalHolidays.find((h) => h.date === dateStr);

    return {
      dayShift,
      shiftType,
      isHoliday,
      holidayObj,
    };
  };

  // Helper to generate calendar matrix for a specific month
  const getMonthMatrix = (year: number, monthZeroBased: number) => {
    const firstDay = new Date(year, monthZeroBased, 1);
    const daysInM = getDaysInMonth(firstDay);
    const startDayOfWeek = getDay(firstDay); // 0 = Sun

    const cells: Array<{ dayNumber: number | null; dateStr: string | null }> = [];

    // Empty cells before 1st
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push({ dayNumber: null, dateStr: null });
    }

    // Days 1..N
    for (let d = 1; d <= daysInM; d++) {
      const dateObj = new Date(year, monthZeroBased, d);
      const dateStr = format(dateObj, 'yyyy-MM-dd');
      cells.push({ dayNumber: d, dateStr });
    }

    // 補滿 6 週（42 格），年曆各月卡片高度一致，利於 A4 單頁對齊
    while (cells.length < 42) {
      cells.push({ dayNumber: null, dateStr: null });
    }

    return { startDayOfWeek, daysInM, cells };
  };

  // Compute month stats (off days & work days / hours) for a given employee & month
  /**
   * 統計指定月份工作／休假天數；空班（已清除排班）兩者皆不計入。
   * @param emp 同仁
   * @param year 西元年
   * @param monthZeroBased 月份 0–11
   * @returns 休假天、工作天與工時
   */
  const getMonthStats = (emp: Employee, year: number, monthZeroBased: number) => {
    const daysInM = getDaysInMonth(new Date(year, monthZeroBased, 1));
    let offDays = 0;
    let workDays = 0;
    let workHours = 0;

    for (let d = 1; d <= daysInM; d++) {
      const dateStr = format(new Date(year, monthZeroBased, d), 'yyyy-MM-dd');
      const { shiftType } = getDayShiftInfo(emp, dateStr);
      // 無 ShiftType（含空班哨兵）＝未排班，不計工作日也不計休假日
      if (!shiftType) continue;
      if (shiftType.category === 'work') {
        workDays++;
        workHours += shiftType.workHours;
      } else {
        offDays++;
      }
    }

    return { offDays, workDays, workHours };
  };

  /**
   * 觸發瀏覽器原生列印對話框（可另存 PDF）。
   */
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="export-print-root fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="export-print-sheet bg-white border border-[#E9E7D4] rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#2D2D2D]">
        
        {/* Top Control Bar (Non-Printable) */}
        <div className="bg-[#F8F7EB] border-b border-[#E9E7D4] p-4 flex flex-col gap-3 no-print">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-[#5A5A40] text-white rounded-xl shadow-sm">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#2D2D2D] flex items-center gap-2">
                  <span>匯出排班行事曆</span>
                  <span className="text-xs bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded-lg border border-[#5A5A40]/20 font-mono">
                    列印/PDF格式
                  </span>
                </h3>
                <p className="text-xs text-[#8A8A70]">可切換年曆或月曆檢視，自動帶入同仁班型與自訂班別配色</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-[#E9E7D4] text-[#8A8A70] hover:text-[#2D2D2D] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-[#E9E7D4]">
            {/* 1. Scope (Year vs Month) */}
            <div>
              <label className="block text-[11px] font-bold text-[#8A8A70] mb-1">匯出模式</label>
              <div className="flex bg-[#E9E7D4] p-1 rounded-xl border border-[#D9D7C2]">
                <button
                  type="button"
                  onClick={() => setExportScope('year')}
                  className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    exportScope === 'year'
                      ? 'bg-[#5A5A40] text-white shadow-sm'
                      : 'text-[#5A5A40] hover:bg-[#D9D7C2]/60'
                  }`}
                >
                  年曆 (全年度)
                </button>
                <button
                  type="button"
                  onClick={() => setExportScope('month')}
                  className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    exportScope === 'month'
                      ? 'bg-[#5A5A40] text-white shadow-sm'
                      : 'text-[#5A5A40] hover:bg-[#D9D7C2]/60'
                  }`}
                >
                  月曆 (單月)
                </button>
              </div>
            </div>

            {/* 2. Target Employee */}
            <div>
              <label className="block text-[11px] font-bold text-[#8A8A70] mb-1">檢視人員</label>
              <select
                value={targetEmployeeId}
                onChange={(e) => setTargetEmployeeId(e.target.value)}
                className="w-full bg-white border border-[#D9D7C2] text-[#2D2D2D] font-bold text-xs rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#5A5A40] cursor-pointer"
              >
                <option value="all">全體同仁 ({employees.length}人)</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Year */}
            <div>
              <label className="block text-[11px] font-bold text-[#8A8A70] mb-1">年份</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full bg-white border border-[#D9D7C2] text-[#2D2D2D] font-bold text-xs rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#5A5A40] cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y} 年
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Month (if Scope is Month) */}
            <div>
              <label className="block text-[11px] font-bold text-[#8A8A70] mb-1">月份</label>
              <select
                disabled={exportScope === 'year'}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full bg-white border border-[#D9D7C2] text-[#2D2D2D] font-bold text-xs rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#5A5A40] disabled:opacity-50 cursor-pointer"
              >
                {monthNames.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Print Button & Notes toggle */}
            <div className="flex items-end gap-2">
              <label className="flex items-center space-x-1.5 text-xs text-[#2D2D2D] cursor-pointer select-none mb-2">
                <input
                  type="checkbox"
                  checked={showNotes}
                  onChange={(e) => setShowNotes(e.target.checked)}
                  className="rounded border-[#D9D7C2] text-[#5A5A40] focus:ring-[#5A5A40]"
                />
                <span className="text-xs font-semibold">包含假解說明</span>
              </label>

              <button
                onClick={handlePrint}
                className="flex-1 py-1.5 px-3 bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>列印 / 另存PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Printable Calendar Body */}
        <div className="export-print-body flex-1 overflow-y-auto p-4 sm:p-6 bg-[#FAF9F5]">
          
          {/* Loop per target employee：每位同仁一頁，列印時依模式／說明縮放以貼合 A4 橫向 */}
          {targetEmployees.map((emp, empIdx) => (
            <div
              key={emp.id}
              className={[
                'export-print-page space-y-6',
                exportScope === 'year' ? 'export-print-page--year' : 'export-print-page--month',
                showNotes ? 'export-print-page--with-notes' : 'export-print-page--no-notes',
                empIdx > 0 ? 'mt-8 pt-8 border-t-2 border-[#E9E7D4]' : '',
              ].filter(Boolean).join(' ')}
            >
              {/* Printable Header */}
              <div className="export-print-header border-b-2 border-[#2D2D2D] pb-3 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-2">
                <div>
                  <h1 className="export-print-title text-xl sm:text-2xl font-black font-serif text-[#2D2D2D] tracking-wide">
                    {selectedYear} 年 {exportScope === 'month' ? `${selectedMonth}月 ` : ''}排班行事曆
                  </h1>
                  <p className="export-print-meta text-xs text-[#5A5A40] font-semibold mt-0.5">
                    姓名：<span className="font-bold text-[#2D2D2D] mr-3">{emp.name}</span>
                    職稱：<span className="font-bold text-[#2D2D2D] mr-3">{emp.role}</span>
                    部門：<span className="font-bold text-[#2D2D2D] mr-3">{emp.department || '醫療/行政'}</span>
                    適用制度：<span className="font-bold text-[#D17A60]">{SYSTEM_CONFIGS[emp.scheduleSystem]?.name}</span>
                  </p>
                </div>

                <div className="export-print-meta text-right text-[11px] text-[#8A8A70]">
                  <div>製表日期：{format(new Date(), 'yyyy/MM/dd')}</div>
                  <div className="font-mono text-[10px]">自訂班別色塊版</div>
                </div>
              </div>

              {/* Reference Notes / Legend Box (matching image style) */}
              {showNotes && (
                <div className="export-print-notes border border-[#2D2D2D] p-3 rounded-lg text-xs leading-relaxed space-y-1.5 bg-white text-[#2D2D2D]">
                  <div className="font-bold text-[#2D2D2D] flex items-center justify-between border-b border-gray-200 pb-1">
                    <span>1. 行政院休假放假與排班說明：</span>
                    <span className="text-[10px] text-[#8A8A70] font-normal">依《勞動基準法》與主管機關辦公日曆表</span>
                  </div>
                  <p className="text-[11px]">
                    (1) 原國定假日之日期休假，計 10 天：01/01元旦、02/16除夕、02/17初一、02/18初二、02/19初三、02/28和平紀念日、04/04兒童節、04/05清明節、05/01勞動節、06/19端午節、09/25中秋節、10/10國慶日等。
                  </p>
                  <p className="text-[11px]">
                    (2) 國定假日逢週六、日之挪移假日與彈性調整休假，依法挪移至工作日補休；休息日與例假日遵照二/四/八週變形工時週期約定調移。
                  </p>
                  
                  {/* Custom Shift Color Legend */}
                  <div className="pt-1.5 border-t border-gray-200 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-bold text-[#2D2D2D]">2. 班別代碼與自訂配色對照：</span>
                    {shiftTypes.map((st) => (
                      <span
                        key={st.id}
                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border border-black/10 shadow-xs"
                        style={{
                          backgroundColor: st.color,
                          color: getContrastingTextColor(st.color),
                        }}
                      >
                        {st.code}：{st.name} ({st.workHours}H)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Scope === 'year' (12 Months Layout Grid) */}
              {exportScope === 'year' && (
                <div className="export-print-year-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 12 }, (_, mIdx) => {
                    const monthZeroBased = mIdx;
                    const monthNum = mIdx + 1;
                    const { cells } = getMonthMatrix(selectedYear, monthZeroBased);
                    const stats = getMonthStats(emp, selectedYear, monthZeroBased);

                    return (
                      <div
                        key={monthNum}
                        className="export-print-year-month border-2 border-[#2D2D2D] rounded-xl bg-white overflow-hidden shadow-xs flex flex-col justify-between"
                      >
                        {/* Month Header */}
                        <div className="export-print-year-month-title bg-[#5A5A40] text-white text-center py-1 font-bold text-xs font-serif border-b border-[#2D2D2D]">
                          {selectedYear}年 {monthNum}月
                        </div>

                        {/* Calendar Grid */}
                        <div className="export-print-year-month-body p-1 flex-1 flex flex-col min-h-0">
                          {/* Weekdays Header */}
                          <div className="export-print-year-weekdays grid grid-cols-7 text-center font-bold text-[10px] text-[#2D2D2D] border-b border-gray-300 pb-0.5 mb-1">
                            {weekDayHeaders.map((dh, i) => (
                              <div
                                key={i}
                                className={i === 0 ? 'text-[#D17A60]' : i === 6 ? 'text-[#5A5A40]' : 'text-[#2D2D2D]'}
                              >
                                {dh}
                              </div>
                            ))}
                          </div>

                          {/* Day Cells */}
                          <div className="export-print-year-days grid grid-cols-7 gap-0.5 text-center text-[10px] flex-1 min-h-0">
                            {cells.map((cell, cIdx) => {
                              if (!cell.dayNumber || !cell.dateStr) {
                                return <div key={cIdx} className="export-print-year-day h-6 bg-gray-50/50 rounded-xs" />;
                              }

                              const { shiftType } = getDayShiftInfo(emp, cell.dateStr);

                              // Determine background color using shiftType's color or category default
                              let bgStyle: React.CSSProperties = { backgroundColor: '#ffffff', color: '#2D2D2D' };

                              if (shiftType) {
                                bgStyle = {
                                  backgroundColor: shiftType.color,
                                  color: getContrastingTextColor(shiftType.color),
                                };
                              }

                              return (
                                <div
                                  key={cIdx}
                                  className="export-print-year-day h-6 flex flex-col items-center justify-center rounded-xs font-mono font-bold border border-black/10 relative overflow-hidden"
                                  style={bgStyle}
                                  title={`${cell.dateStr} - ${shiftType?.name || '休'}`}
                                >
                                  <span className="export-print-year-day-num leading-none text-[10px]">{cell.dayNumber}</span>
                                  {shiftType && (
                                    <span className="export-print-year-day-code text-[8px] opacity-90 leading-none mt-0.5 scale-90">
                                      {shiftType.code}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Month Summary Footer */}
                        <div className="export-print-year-footer border-t border-[#2D2D2D] bg-[#F8F7EB] px-2 py-1 flex items-center justify-between text-[10px] font-bold text-[#2D2D2D]">
                          <span>休假日：<strong className="text-[#D17A60]">{stats.offDays}</strong> 天</span>
                          <span>工作：<strong className="text-[#5A5A40]">{stats.workDays}</strong> 天 ({stats.workHours}H)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Scope === 'month' (Single Month View) */}
              {exportScope === 'month' && (
                <div className="export-print-month-view border-2 border-[#2D2D2D] rounded-2xl bg-white overflow-hidden shadow-sm flex flex-col min-h-0">
                  {/* Single Month Header */}
                  <div className="export-print-month-title bg-[#5A5A40] text-white p-3 font-bold text-base font-serif flex items-center justify-between">
                    <span>{selectedYear}年 {selectedMonth}月 排班月曆表</span>
                    <span className="export-print-month-stats text-xs font-mono font-normal opacity-90">
                      當月統計：休假日 {getMonthStats(emp, selectedYear, selectedMonth - 1).offDays} 天 | 工作日 {getMonthStats(emp, selectedYear, selectedMonth - 1).workDays} 天 ({getMonthStats(emp, selectedYear, selectedMonth - 1).workHours} 小時)
                    </span>
                  </div>

                  {/* Large Grid Header */}
                  <div className="export-print-month-weekdays grid grid-cols-7 text-center font-bold text-xs bg-[#F8F7EB] border-b-2 border-[#2D2D2D] py-2">
                    {weekDayHeaders.map((dh, i) => (
                      <div
                        key={i}
                        className={i === 0 ? 'text-[#D17A60]' : i === 6 ? 'text-[#5A5A40]' : 'text-[#2D2D2D]'}
                      >
                        {dh}
                      </div>
                    ))}
                  </div>

                  {/* Large Day Cells：6 週固定列，列印時均分剩餘 A4 高度 */}
                  <div className="export-print-month-days grid grid-cols-7 grid-rows-6 border-b border-gray-300 flex-1 min-h-0">
                    {getMonthMatrix(selectedYear, selectedMonth - 1).cells.map((cell, cIdx) => {
                      if (!cell.dayNumber || !cell.dateStr) {
                        return <div key={cIdx} className="export-print-month-day min-h-[72px] bg-gray-50 border-r border-b border-gray-200" />;
                      }

                      const { shiftType, isHoliday, holidayObj } = getDayShiftInfo(emp, cell.dateStr);

                      return (
                        <div
                          key={cIdx}
                          className="export-print-month-day min-h-[72px] p-1.5 border-r border-b border-gray-300 flex flex-col justify-between hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="export-print-month-day-num font-bold font-mono text-sm text-[#2D2D2D]">{cell.dayNumber}</span>
                            {isHoliday && (
                              <span className="export-print-month-holiday text-[9px] bg-[#D17A60] text-white px-1 rounded font-bold truncate">
                                {holidayObj?.name || '國定假'}
                              </span>
                            )}
                          </div>

                          {shiftType ? (
                            <div
                              className="export-print-month-shift p-1 rounded-lg text-xs font-bold text-center mt-1 border border-black/10 shadow-xs"
                              style={{
                                backgroundColor: shiftType.color,
                                color: getContrastingTextColor(shiftType.color),
                              }}
                            >
                              <div className="flex items-center justify-between px-0.5 gap-1">
                                <span className="text-[10px]">{shiftType.code}</span>
                                <span className="truncate">{shiftType.name}</span>
                              </div>
                              <div className="text-[9px] opacity-80 text-right mt-0.5">
                                {shiftType.workHours > 0 ? `${shiftType.workHours}H` : '例休'}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400 text-center py-2">-</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
