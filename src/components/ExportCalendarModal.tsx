import React, { useState, useMemo } from 'react';
import { Employee, ShiftType, NationalHoliday, ScheduleSystemType } from '../types';
import { SYSTEM_CONFIGS } from '../constants/systems';
import { getEffectiveShift, getShiftType } from '../utils/laborLaws';
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

interface ExportCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  selectedEmployeeId: string;
  shiftTypes: ShiftType[];
  nationalHolidays: NationalHoliday[];
  currentSystem: ScheduleSystemType;
}

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

  if (!isOpen) return null;

  // Selected target employees
  const targetEmployees = useMemo(() => {
    if (targetEmployeeId === 'all') return employees;
    const found = employees.find((e) => e.id === targetEmployeeId);
    return found ? [found] : employees;
  }, [employees, targetEmployeeId]);

  const yearOptions = [2025, 2026, 2027, 2028];
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const weekDayHeaders = ['日', '一', '二', '三', '四', '五', '六'];

  // Helper to get shift styling & info for a date
  const getDayShiftInfo = (emp: Employee, dateStr: string) => {
    const dayShift = getEffectiveShift(emp.schedules, dateStr);
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

    return { startDayOfWeek, daysInM, cells };
  };

  // Compute month stats (off days & work days / hours) for a given employee & month
  const getMonthStats = (emp: Employee, year: number, monthZeroBased: number) => {
    const daysInM = getDaysInMonth(new Date(year, monthZeroBased, 1));
    let offDays = 0;
    let workDays = 0;
    let workHours = 0;

    for (let d = 1; d <= daysInM; d++) {
      const dateStr = format(new Date(year, monthZeroBased, d), 'yyyy-MM-dd');
      const { shiftType } = getDayShiftInfo(emp, dateStr);
      if (shiftType) {
        if (shiftType.category === 'work') {
          workDays++;
          workHours += shiftType.workHours;
        } else {
          offDays++;
        }
      } else {
        offDays++;
      }
    }

    return { offDays, workDays, workHours };
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-[#E9E7D4] rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#2D2D2D]">
        
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#FAF9F5] print:p-0 print:bg-white print:overflow-visible">
          
          {/* Loop per target employee */}
          {targetEmployees.map((emp, empIdx) => (
            <div
              key={emp.id}
              className={`space-y-6 ${empIdx > 0 ? 'mt-8 pt-8 border-t-2 border-[#E9E7D4] print:mt-0 print:pt-0 print:border-none print:break-before-page' : ''}`}
            >
              {/* Printable Header */}
              <div className="border-b-2 border-[#2D2D2D] pb-3 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-2">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black font-serif text-[#2D2D2D] tracking-wide">
                    {selectedYear} 年 {exportScope === 'month' ? `${selectedMonth}月 ` : ''}排班行事曆
                  </h1>
                  <p className="text-xs text-[#5A5A40] font-semibold mt-0.5">
                    姓名：<span className="font-bold text-[#2D2D2D] mr-3">{emp.name}</span>
                    職稱：<span className="font-bold text-[#2D2D2D] mr-3">{emp.role}</span>
                    部門：<span className="font-bold text-[#2D2D2D] mr-3">{emp.department || '醫療/行政'}</span>
                    適用制度：<span className="font-bold text-[#D17A60]">{SYSTEM_CONFIGS[emp.scheduleSystem]?.name}</span>
                  </p>
                </div>

                <div className="text-right text-[11px] text-[#8A8A70]">
                  <div>製表日期：{format(new Date(), 'yyyy/MM/dd')}</div>
                  <div className="font-mono text-[10px]">自訂班別色塊版</div>
                </div>
              </div>

              {/* Reference Notes / Legend Box (matching image style) */}
              {showNotes && (
                <div className="border border-[#2D2D2D] p-3 rounded-lg text-xs leading-relaxed space-y-1.5 bg-white print:bg-white text-[#2D2D2D]">
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
                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold text-white border border-black/10 shadow-xs"
                        style={{ backgroundColor: st.color, color: st.textColor || '#ffffff' }}
                      >
                        {st.code}：{st.name} ({st.workHours}H)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Scope === 'year' (12 Months Layout Grid) */}
              {exportScope === 'year' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-3 print:gap-3">
                  {Array.from({ length: 12 }, (_, mIdx) => {
                    const monthZeroBased = mIdx;
                    const monthNum = mIdx + 1;
                    const { cells } = getMonthMatrix(selectedYear, monthZeroBased);
                    const stats = getMonthStats(emp, selectedYear, monthZeroBased);

                    return (
                      <div
                        key={monthNum}
                        className="border-2 border-[#2D2D2D] rounded-xl bg-white overflow-hidden shadow-xs print:shadow-none flex flex-col justify-between"
                      >
                        {/* Month Header */}
                        <div className="bg-[#5A5A40] text-white text-center py-1 font-bold text-xs font-serif border-b border-[#2D2D2D]">
                          {selectedYear}年 {monthNum}月
                        </div>

                        {/* Calendar Grid */}
                        <div className="p-1">
                          {/* Weekdays Header */}
                          <div className="grid grid-cols-7 text-center font-bold text-[10px] text-[#2D2D2D] border-b border-gray-300 pb-0.5 mb-1">
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
                          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px]">
                            {cells.map((cell, cIdx) => {
                              if (!cell.dayNumber || !cell.dateStr) {
                                return <div key={cIdx} className="h-6 bg-gray-50/50 rounded-xs" />;
                              }

                              const { shiftType, isHoliday } = getDayShiftInfo(emp, cell.dateStr);

                              // Determine background color using shiftType's color or category default
                              let bgStyle: React.CSSProperties = { backgroundColor: '#ffffff', color: '#2D2D2D' };

                              if (shiftType) {
                                bgStyle = {
                                  backgroundColor: shiftType.color,
                                  color: shiftType.textColor || '#ffffff',
                                };
                              }

                              const isSun = cIdx % 7 === 0;
                              const isSat = cIdx % 7 === 6;

                              return (
                                <div
                                  key={cIdx}
                                  className="h-6 flex flex-col items-center justify-center rounded-xs font-mono font-bold border border-black/10 relative overflow-hidden"
                                  style={bgStyle}
                                  title={`${cell.dateStr} - ${shiftType?.name || '休'}`}
                                >
                                  <span className="leading-none text-[10px]">{cell.dayNumber}</span>
                                  {shiftType && (
                                    <span className="text-[8px] opacity-90 leading-none mt-0.5 scale-90">
                                      {shiftType.code}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Month Summary Footer */}
                        <div className="border-t border-[#2D2D2D] bg-[#F8F7EB] px-2 py-1 flex items-center justify-between text-[10px] font-bold text-[#2D2D2D]">
                          <span>休假日：<strong className="text-[#D17A60]">{stats.offDays}</strong> 天</span>
                          <span>工作/開診：<strong className="text-[#5A5A40]">{stats.workDays}</strong> 天 ({stats.workHours}H)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Scope === 'month' (Single Month View) */}
              {exportScope === 'month' && (
                <div className="border-2 border-[#2D2D2D] rounded-2xl bg-white overflow-hidden shadow-sm">
                  {/* Single Month Header */}
                  <div className="bg-[#5A5A40] text-white p-3 font-bold text-base font-serif flex items-center justify-between">
                    <span>{selectedYear}年 {selectedMonth}月 排班月曆表</span>
                    <span className="text-xs font-mono font-normal opacity-90">
                      當月統計：休假日 {getMonthStats(emp, selectedYear, selectedMonth - 1).offDays} 天 | 工作日 {getMonthStats(emp, selectedYear, selectedMonth - 1).workDays} 天 ({getMonthStats(emp, selectedYear, selectedMonth - 1).workHours} 小時)
                    </span>
                  </div>

                  {/* Large Grid Header */}
                  <div className="grid grid-cols-7 text-center font-bold text-xs bg-[#F8F7EB] border-b-2 border-[#2D2D2D] py-2">
                    {weekDayHeaders.map((dh, i) => (
                      <div
                        key={i}
                        className={i === 0 ? 'text-[#D17A60]' : i === 6 ? 'text-[#5A5A40]' : 'text-[#2D2D2D]'}
                      >
                        {dh}
                      </div>
                    ))}
                  </div>

                  {/* Large Day Cells */}
                  <div className="grid grid-cols-7 border-b border-gray-300">
                    {getMonthMatrix(selectedYear, selectedMonth - 1).cells.map((cell, cIdx) => {
                      if (!cell.dayNumber || !cell.dateStr) {
                        return <div key={cIdx} className="min-h-[72px] bg-gray-50 border-r border-b border-gray-200" />;
                      }

                      const { dayShift, shiftType, isHoliday, holidayObj } = getDayShiftInfo(emp, cell.dateStr);

                      return (
                        <div
                          key={cIdx}
                          className="min-h-[72px] p-1.5 border-r border-b border-gray-300 flex flex-col justify-between hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold font-mono text-sm text-[#2D2D2D]">{cell.dayNumber}</span>
                            {isHoliday && (
                              <span className="text-[9px] bg-[#D17A60] text-white px-1 rounded font-bold">
                                {holidayObj?.name || '國定假'}
                              </span>
                            )}
                          </div>

                          {shiftType ? (
                            <div
                              className="p-1 rounded-lg text-xs font-bold text-center mt-1 border border-black/10 shadow-xs"
                              style={{ backgroundColor: shiftType.color, color: shiftType.textColor || '#ffffff' }}
                            >
                              <div className="flex items-center justify-between px-0.5">
                                <span className="text-[10px]">{shiftType.code}</span>
                                <span>{shiftType.name}</span>
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
