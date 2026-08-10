import React, { useEffect, useState } from 'react';
import { Employee, NationalHoliday, ShiftType } from '../types';
import { ShiftBlockTile } from './ShiftBlockTile';
import { findNearestLegalDate, getEffectiveShift, isEmptyShiftTypeId } from '../utils/laborLaws';
import { EMPTY_SHIFT_TYPE_ID } from '../constants/shifts';
import { getContrastingTextColor } from '../utils/colorContrast';
import { Users, ChevronLeft, ChevronRight, Layers, XCircle, Plus } from 'lucide-react';
import { addDays, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { getTaiwanWeekdayName } from '../utils/perpetualCalendar';

/**
 * 全人員時間軸矩陣檢視屬性。
 */
interface RosterTimelineViewProps {
  /** 檢視起始日 YYYY-MM-DD。 */
  startDateStr: string;
  /** 顯示天數（通常等於週期天數）。 */
  daysCount: number;
  /** 同仁清單。 */
  employees: Employee[];
  /** 全部班別定義。 */
  allShiftTypes: ShiftType[];
  /** 國定／自訂假日。 */
  nationalHolidays: NationalHoliday[];
  /** 指定同仁單日選班回呼。 */
  onSelectShift: (employeeId: string, dateStr: string, shiftTypeId: string) => void;
  /**
   * 套用「調」班前請求指定畫面上的「國」班來源。
   * @param cells 目標格（同仁＋日期）
   */
  onRequestMakeupShift?: (cells: { empId: string; dateStr: string }[]) => void;
  /** 班別左右平移回呼。 */
  onSlideShift: (employeeId: string, dateStr: string, direction: 'left' | 'right') => void;
  /** 拖放換日回呼。 */
  onDragDropShift?: (employeeId: string, fromDateStr: string, targetDateStr: string) => void;
  /** 釘選切換回呼。 */
  onTogglePin?: (employeeId: string, dateStr: string) => void;
  /** 變更起始日回呼。 */
  onChangeStartDate: (newStartDateStr: string) => void;
  /** 目前聚焦同仁 ID。 */
  selectedEmployeeId: string;
  /** 切換聚焦同仁回呼。 */
  onSelectEmployee: (id: string) => void;
  /** 開啟班別設定（黑列常駐 +）。 */
  onOpenShiftModal?: () => void;
  /** 加減加班時數。 */
  onAdjustOvertime?: (employeeId: string, dateStr: string, deltaHours: number) => void;
  /** 支用或還原補休（正＝支用、負＝還原）。 */
  onTakeCompLeave?: (employeeId: string, dateStr: string, deltaHours?: number) => void;
  /** 直接設定當日顯示總工時。 */
  onSetDayHours?: (employeeId: string, dateStr: string, displayHours: number) => void;
}

/**
 * 全人員排班時間軸矩陣。
 * 點擊格子改以底部黑色操作列套用班別，不再使用白色選班面板。
 */
export const RosterTimelineView: React.FC<RosterTimelineViewProps> = ({
  startDateStr,
  daysCount,
  employees,
  allShiftTypes,
  nationalHolidays,
  onSelectShift,
  onRequestMakeupShift,
  onSlideShift,
  onDragDropShift,
  onTogglePin,
  onChangeStartDate,
  selectedEmployeeId,
  onSelectEmployee,
  onOpenShiftModal,
  onAdjustOvertime,
  onTakeCompLeave,
  onSetDayHours,
}) => {
  const [draggedCell, setDraggedCell] = useState<{ empId: string; dateStr: string } | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ empId: string; dateStr: string } | null>(null);
  /** 已選取的儲存格（同仁 + 日期），供黑列批次套用 */
  const [selectedCells, setSelectedCells] = useState<
    { empId: string; dateStr: string }[]
  >([]);

  // Esc 清空選取
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        setSelectedCells([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const start = parseISO(startDateStr);
  const datesList: string[] = [];
  for (let i = 0; i < daysCount; i++) {
    datesList.push(format(addDays(start, i), 'yyyy-MM-dd'));
  }

  /** 切換至前一週期區間。 */
  const handlePrevPeriod = () => {
    const newStart = format(addDays(start, -daysCount), 'yyyy-MM-dd');
    onChangeStartDate(newStart);
  };

  /** 切換至後一週期區間。 */
  const handleNextPeriod = () => {
    const newStart = format(addDays(start, daysCount), 'yyyy-MM-dd');
    onChangeStartDate(newStart);
  };

  /**
   * 計算同仁在指定日期所屬月份的可支用補休庫存。
   * @param emp 同仁
   * @param dateStr 參考日期
   * @returns 庫存小時數
   */
  const getCompLeaveBank = (emp: Employee, dateStr: string): number => {
    const monthStart = format(startOfMonth(parseISO(dateStr)), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(parseISO(dateStr)), 'yyyy-MM-dd');
    let ot = 0;
    let used = 0;
    Object.values(emp.schedules).forEach((ds) => {
      if (ds.date >= monthStart && ds.date <= monthEnd) {
        ot += ds.overtimeHours || 0;
        used += ds.compLeaveHours || 0;
      }
    });
    return Math.max(0, Math.round((ot - used) * 10) / 10);
  };

  /**
   * 點擊儲存格：切換選取狀態並聚焦該同仁。
   * @param empId 同仁 ID
   * @param dateStr 日期
   * @param e 滑鼠事件
   */
  const handleCellClick = (empId: string, dateStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectEmployee(empId);

    const keyMatch = (c: { empId: string; dateStr: string }) =>
      c.empId === empId && c.dateStr === dateStr;

    if (e.ctrlKey || e.metaKey || selectedCells.length > 0) {
      if (selectedCells.some(keyMatch)) {
        setSelectedCells((prev) => prev.filter((c) => !keyMatch(c)));
      } else {
        setSelectedCells((prev) => [...prev, { empId, dateStr }]);
      }
    } else {
      if (selectedCells.length === 1 && keyMatch(selectedCells[0])) {
        setSelectedCells([]);
      } else {
        setSelectedCells([{ empId, dateStr }]);
      }
    }
  };

  /**
   * 依黑列按鈕批次套用班別（略過釘選格）。
   * 「調」改走來源「國」班挑選流程。
   * @param shiftTypeId 目標班別 ID
   */
  const handleApplyBatchShift = (shiftTypeId: string) => {
    const unpinned = selectedCells.filter(({ empId, dateStr }) => {
      const emp = employees.find((e) => e.id === empId);
      return !emp?.schedules[dateStr]?.isPinned;
    });
    if (unpinned.length === 0) return;

    if (shiftTypeId === 'shift_national_holiday_makeup' && onRequestMakeupShift) {
      onRequestMakeupShift(unpinned);
      setSelectedCells([]);
      return;
    }

    unpinned.forEach(({ empId, dateStr }) => {
      onSelectShift(empId, dateStr, shiftTypeId);
    });
    setSelectedCells([]);
  };

  /**
   * 判斷儲存格是否已選取。
   * @param empId 同仁 ID
   * @param dateStr 日期
   * @returns 是否選取中
   */
  const isCellSelected = (empId: string, dateStr: string) =>
    selectedCells.some((c) => c.empId === empId && c.dateStr === dateStr);

  return (
    <div className="bg-white border border-[#E9E7D4] rounded-2xl shadow-sm overflow-hidden relative">
      {/* Timeline Header */}
      <div className="bg-[#F8F7EB] p-4 border-b border-[#E9E7D4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl border border-[#5A5A40]/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#2D2D2D] font-serif flex items-center gap-2">
              <span>全人員排班時間軸矩陣</span>
              <span className="text-sm px-2 py-0.5 rounded bg-[#E9E7D4] text-[#5A5A40] font-mono">
                {daysCount} 天週期檢視
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-wrap">
          <button
            onClick={handlePrevPeriod}
            className="p-1.5 rounded-lg bg-white border border-[#D9D7C2] text-[#5A5A40] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] text-sm font-semibold flex items-center gap-1 transition-colors shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>前 {daysCount} 天</span>
          </button>
          <span className="text-sm font-mono text-[#2D2D2D] px-2 font-bold">
            {startDateStr} ~ {datesList[datesList.length - 1]}
          </span>
          <button
            onClick={handleNextPeriod}
            className="p-1.5 rounded-lg bg-white border border-[#D9D7C2] text-[#5A5A40] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] text-sm font-semibold flex items-center gap-1 transition-colors shadow-sm"
          >
            <span>後 {daysCount} 天</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F8F7EB] border-b border-[#E9E7D4] text-sm font-bold text-[#8A8A70]">
              <th className="p-3 sticky left-0 bg-[#F8F7EB] z-20 min-w-[150px] border-r border-[#E9E7D4] shadow-sm">
                同仁姓名 / 職稱
              </th>
              {datesList.map((dStr) => {
                const dayNum = dStr.split('-')[2];
                const monthNum = dStr.split('-')[1];
                const weekday = getTaiwanWeekdayName(dStr);
                const isWeekend = weekday === '週六' || weekday === '週日';
                const holiday = nationalHolidays.find((h) => h.date === dStr);

                return (
                  <th
                    key={dStr}
                    className={`p-2 min-w-[85px] text-center border-r border-[#E9E7D4] ${
                      isWeekend ? 'bg-[#D17A60]/10 text-[#D17A60]' : 'text-[#5A5A40]'
                    }`}
                  >
                    <div className="text-xs text-[#8A8A70] font-normal">
                      {monthNum}/{dayNum}
                    </div>
                    <div className="font-bold text-sm">{weekday}</div>
                    {holiday && (
                      <div
                        className="text-sm text-[#D17A60] truncate max-w-[70px] mx-auto mt-0.5"
                        title={holiday.name}
                      >
                        {holiday.name.split(' ')[0]}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E9E7D4] text-sm">
            {employees.map((emp) => {
              const isSelected = emp.id === selectedEmployeeId;

              return (
                <tr
                  key={emp.id}
                  onClick={() => onSelectEmployee(emp.id)}
                  className={`transition-colors hover:bg-[#F8F7EB] cursor-pointer ${
                    isSelected ? 'bg-[#5A5A40]/10' : ''
                  }`}
                >
                  <td
                    className={`p-3 sticky left-0 z-10 border-r border-[#E9E7D4] font-medium ${
                      isSelected ? 'bg-[#F2F1E8]' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-full bg-[#5A5A40]/20 text-[#5A5A40] font-bold flex items-center justify-center text-sm border border-[#5A5A40]/30">
                        {emp.name[0]}
                      </div>
                      <div>
                        <div className="font-bold text-[#2D2D2D] text-sm flex items-center gap-1">
                          <span>{emp.name}</span>
                          {isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#5A5A40]" />
                          )}
                        </div>
                        <div className="text-xs text-[#8A8A70]">{emp.role}</div>
                      </div>
                    </div>
                  </td>

                  {datesList.map((dStr) => {
                    const dayShift = getEffectiveShift(emp.schedules, dStr, nationalHolidays);
                    // 空班哨兵：不顯示班別色塊，亦不當作休／例／國假
                    const shiftType =
                      dayShift && !isEmptyShiftTypeId(dayShift.shiftTypeId)
                        ? allShiftTypes.find((s) => s.id === dayShift.shiftTypeId)
                        : undefined;
                    const cellSelected = isCellSelected(emp.id, dStr);

                    let isIllegalTarget = false;
                    if (
                      draggedCell &&
                      draggedCell.empId === emp.id &&
                      draggedCell.dateStr !== dStr
                    ) {
                      const sourceShift = getEffectiveShift(emp.schedules, draggedCell.dateStr, nationalHolidays);
                      const movingShiftTypeId = sourceShift
                        ? sourceShift.shiftTypeId
                        : 'shift_morning';
                      const testResult = findNearestLegalDate(
                        emp.schedules,
                        draggedCell.dateStr,
                        dStr,
                        movingShiftTypeId,
                        emp.scheduleSystem || '2-week',
                        allShiftTypes,
                        28,
                        emp.cycleStartDate,
                        nationalHolidays
                      );
                      if (!testResult.allowed || testResult.snappedDate !== dStr) {
                        isIllegalTarget = true;
                      }
                    }

                    return (
                      <td
                        key={dStr}
                        className={`p-1 text-center border-r border-[#E9E7D4] ${
                          cellSelected
                            ? 'bg-[#5A5A40]/15 ring-2 ring-inset ring-[#5A5A40]'
                            : ''
                        }`}
                        onClick={(e) => handleCellClick(emp.id, dStr, e)}
                      >
                        <ShiftBlockTile
                          dateStr={dStr}
                          shiftType={shiftType}
                          onSlideShift={(d, dir) => onSlideShift(emp.id, d, dir)}
                          isPinned={!!dayShift?.isPinned}
                          onTogglePin={(d) => onTogglePin && onTogglePin(emp.id, d)}
                          isDragOver={
                            dragOverCell?.empId === emp.id && dragOverCell?.dateStr === dStr
                          }
                          onDragStart={(e, dateStr) => {
                            // empId|date，放下時不必依賴 React state
                            e.dataTransfer.setData(
                              'text/plain',
                              `${emp.id}|${dateStr}`
                            );
                            setDraggedCell({ empId: emp.id, dateStr });
                          }}
                          onDragOver={() => {
                            setDragOverCell({ empId: emp.id, dateStr: dStr });
                          }}
                          onDragEnd={() => {
                            setDragOverCell(null);
                            setDraggedCell(null);
                          }}
                          onDrop={(e, targetDateStr) => {
                            setDragOverCell(null);
                            const payload =
                              e.dataTransfer.getData('text/plain') ||
                              (draggedCell
                                ? `${draggedCell.empId}|${draggedCell.dateStr}`
                                : '');
                            const [fromEmpId, fromDateStr] = payload.split('|');
                            if (
                              fromEmpId === emp.id &&
                              fromDateStr &&
                              fromDateStr !== targetDateStr &&
                              onDragDropShift
                            ) {
                              onDragDropShift(emp.id, fromDateStr, targetDateStr);
                            }
                            setDraggedCell(null);
                          }}
                          isCompact={true}
                          isIllegalTarget={isIllegalTarget}
                          colorOnlyOnNarrow={false}
                          overtimeHours={emp.schedules[dStr]?.overtimeHours || 0}
                          compLeaveHours={emp.schedules[dStr]?.compLeaveHours || 0}
                          compLeaveBankHours={getCompLeaveBank(emp, dStr)}
                          onAdjustOvertime={
                            onAdjustOvertime
                              ? (d, delta) => onAdjustOvertime(emp.id, d, delta)
                              : undefined
                          }
                          onTakeCompLeave={
                            onTakeCompLeave
                              ? (d, delta) => onTakeCompLeave(emp.id, d, delta)
                              : undefined
                          }
                          onSetDayHours={
                            onSetDayHours
                              ? (d, hours) => onSetDayHours(emp.id, d, hours)
                              : undefined
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 選取後才顯示黑色操作列 */}
      {selectedCells.length > 0 && (
        <div className="sticky bottom-4 mx-auto max-w-3xl w-[94%] sm:w-[92%] bg-[#2D2D2D] text-white p-3 rounded-2xl shadow-2xl border border-[#5A5A40] z-50 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center space-x-2 text-left w-full sm:w-auto">
            <span className="bg-[#5A5A40] text-white p-1.5 rounded-xl font-bold flex-shrink-0">
              <Layers className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">
                已選取{' '}
                <span className="text-yellow-400 font-mono text-sm">{selectedCells.length}</span> 格
              </div>
              <p className="text-xs text-gray-300">點選班別即可套用（Esc 取消）</p>
            </div>
            <button
              onClick={() => setSelectedCells([])}
              className="sm:hidden text-sm bg-red-500/20 text-red-300 hover:bg-red-500/40 px-2 py-1 rounded-lg border border-red-500/30 flex-shrink-0 font-bold"
            >
              取消
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
            {allShiftTypes.map((st) => (
              <button
                key={st.id}
                onClick={() => handleApplyBatchShift(st.id)}
                className="min-w-8 h-8 sm:h-auto sm:px-2.5 sm:py-1 px-1.5 rounded-lg text-xs sm:text-sm font-bold transition-transform hover:scale-105 active:scale-95 shadow cursor-pointer border border-white/20 flex items-center justify-center"
                style={{ backgroundColor: st.color, color: getContrastingTextColor(st.color) }}
                title={`批次設置為：${st.name}`}
              >
                {st.code}
              </button>
            ))}
            <button
              onClick={() => handleApplyBatchShift(EMPTY_SHIFT_TYPE_ID)}
              className="min-w-8 h-8 sm:h-auto sm:px-2.5 sm:py-1 px-1.5 rounded-lg text-xs sm:text-sm font-bold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer border border-slate-500"
              title="清除當天排班（非休息日／例假／國定假日）"
            >
              空
            </button>
            {onOpenShiftModal && (
              <button
                type="button"
                onClick={onOpenShiftModal}
                className="min-w-8 h-8 sm:h-auto sm:px-2.5 sm:py-1 px-1.5 rounded-lg text-xs sm:text-sm font-bold bg-[#5A5A40] hover:bg-[#484833] text-white transition-colors cursor-pointer border border-white/20 flex items-center justify-center"
                title="新增／編輯班別"
                aria-label="新增班別"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setSelectedCells([])}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-red-500/80 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-colors cursor-pointer"
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
