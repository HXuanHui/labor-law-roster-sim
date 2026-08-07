import React, { useState } from 'react';
import { Employee, NationalHoliday, ScheduleSystemType, ShiftType } from '../types';
import { ShiftBlockTile } from './ShiftBlockTile';
import { findNearestLegalDate, getEffectiveShift } from '../utils/laborLaws';
import { Users, Calendar, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
import { getTaiwanWeekdayName } from '../utils/perpetualCalendar';

interface RosterTimelineViewProps {
  startDateStr: string; // YYYY-MM-DD
  daysCount: number; // e.g. 14 or 28
  employees: Employee[];
  allShiftTypes: ShiftType[];
  nationalHolidays: NationalHoliday[];
  onSelectShift: (employeeId: string, dateStr: string, shiftTypeId: string) => void;
  onSlideShift: (employeeId: string, dateStr: string, direction: 'left' | 'right') => void;
  onDragDropShift?: (employeeId: string, fromDateStr: string, targetDateStr: string) => void;
  onTogglePin?: (employeeId: string, dateStr: string) => void;
  onChangeStartDate: (newStartDateStr: string) => void;
  selectedEmployeeId: string;
  onSelectEmployee: (id: string) => void;
}

export const RosterTimelineView: React.FC<RosterTimelineViewProps> = ({
  startDateStr,
  daysCount,
  employees,
  allShiftTypes,
  nationalHolidays,
  onSelectShift,
  onSlideShift,
  onDragDropShift,
  onTogglePin,
  onChangeStartDate,
  selectedEmployeeId,
  onSelectEmployee,
}) => {
  const [draggedCell, setDraggedCell] = useState<{ empId: string; dateStr: string } | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ empId: string; dateStr: string } | null>(null);

  const start = parseISO(startDateStr);
  const datesList: string[] = [];
  for (let i = 0; i < daysCount; i++) {
    datesList.push(format(addDays(start, i), 'yyyy-MM-dd'));
  }

  const handlePrevPeriod = () => {
    const newStart = format(addDays(start, -daysCount), 'yyyy-MM-dd');
    onChangeStartDate(newStart);
  };

  const handleNextPeriod = () => {
    const newStart = format(addDays(start, daysCount), 'yyyy-MM-dd');
    onChangeStartDate(newStart);
  };

  return (
    <div className="bg-white border border-[#E9E7D4] rounded-2xl shadow-sm overflow-hidden">
      {/* Timeline Header */}
      <div className="bg-[#F8F7EB] p-4 border-b border-[#E9E7D4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl border border-[#5A5A40]/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#2D2D2D] font-serif flex items-center gap-2">
              <span>全人員排班時間軸矩陣</span>
              <span className="text-xs px-2 py-0.5 rounded bg-[#E9E7D4] text-[#5A5A40] font-mono">
                {daysCount} 天週期檢視
              </span>
            </h2>
            <p className="text-xs text-[#8A8A70]">
              跨同仁雙向平移班別，可個別平移或即時觀察勞動基準法連續工時狀況
            </p>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrevPeriod}
            className="p-1.5 rounded-lg bg-white border border-[#D9D7C2] text-[#5A5A40] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>前 {daysCount} 天</span>
          </button>
          <span className="text-xs font-mono text-[#2D2D2D] px-2 font-bold">
            {startDateStr} ~ {datesList[datesList.length - 1]}
          </span>
          <button
            onClick={handleNextPeriod}
            className="p-1.5 rounded-lg bg-white border border-[#D9D7C2] text-[#5A5A40] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
          >
            <span>後 {daysCount} 天</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Roster Scrollable Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F8F7EB] border-b border-[#E9E7D4] text-xs font-bold text-[#8A8A70]">
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
                    <div className="text-[10px] text-[#8A8A70] font-normal">{monthNum}/{dayNum}</div>
                    <div className="font-bold text-xs">{weekday}</div>
                    {holiday && (
                      <div className="text-[9px] text-[#D17A60] truncate max-w-[70px] mx-auto mt-0.5" title={holiday.name}>
                        🏮 {holiday.name.split(' ')[0]}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E9E7D4] text-xs">
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
                  {/* Sticky Employee Name Column */}
                  <td className="p-3 sticky left-0 bg-white z-10 border-r border-[#E9E7D4] font-medium">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-full bg-[#5A5A40]/20 text-[#5A5A40] font-bold flex items-center justify-center text-xs border border-[#5A5A40]/30">
                        {emp.name[0]}
                      </div>
                      <div>
                        <div className="font-bold text-[#2D2D2D] text-xs flex items-center gap-1">
                          <span>{emp.name}</span>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#5A5A40]" />}
                        </div>
                        <div className="text-[10px] text-[#8A8A70]">{emp.role}</div>
                      </div>
                    </div>
                  </td>

                  {/* Dates Shift Cells */}
                  {datesList.map((dStr) => {
                    const dayShift = getEffectiveShift(emp.schedules, dStr);
                    const shiftType = dayShift
                      ? allShiftTypes.find((s) => s.id === dayShift.shiftTypeId)
                      : undefined;

                    let isIllegalTarget = false;
                    if (draggedCell && draggedCell.empId === emp.id && draggedCell.dateStr !== dStr) {
                      const sourceShift = getEffectiveShift(emp.schedules, draggedCell.dateStr);
                      const movingShiftTypeId = sourceShift ? sourceShift.shiftTypeId : 'shift_morning';
                      const testResult = findNearestLegalDate(
                        emp.schedules,
                        draggedCell.dateStr,
                        dStr,
                        movingShiftTypeId,
                        emp.scheduleSystem || '2-week',
                        allShiftTypes
                      );
                      if (!testResult.allowed || testResult.snappedDate !== dStr) {
                        isIllegalTarget = true;
                      }
                    }

                    return (
                      <td key={dStr} className="p-1 text-center border-r border-[#E9E7D4]">
                        <ShiftBlockTile
                          dateStr={dStr}
                          shiftType={shiftType}
                          allShiftTypes={allShiftTypes}
                          onSelectShift={(d, stId) => onSelectShift(emp.id, d, stId)}
                          onSlideShift={(d, dir) => onSlideShift(emp.id, d, dir)}
                          isPinned={!!dayShift?.isPinned}
                          onTogglePin={(d) => onTogglePin && onTogglePin(emp.id, d)}
                          isDragOver={dragOverCell?.empId === emp.id && dragOverCell?.dateStr === dStr}
                          onDragStart={(e, dateStr) => {
                            setDraggedCell({ empId: emp.id, dateStr });
                          }}
                          onDragOver={() => {
                            setDragOverCell({ empId: emp.id, dateStr: dStr });
                          }}
                          onDrop={(e, targetDateStr) => {
                            setDragOverCell(null);
                            if (draggedCell && draggedCell.empId === emp.id && draggedCell.dateStr !== targetDateStr) {
                              if (onDragDropShift) {
                                onDragDropShift(emp.id, draggedCell.dateStr, targetDateStr);
                              }
                            }
                            setDraggedCell(null);
                          }}
                          isCompact={true}
                          isIllegalTarget={isIllegalTarget}
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
    </div>
  );
};
