import React from 'react';
import { Employee, ScheduleSystemType } from '../types';
import { SYSTEM_CONFIGS } from '../constants/systems';
import { Users } from 'lucide-react';

interface SystemSelectorBarProps {
  currentSystem: ScheduleSystemType;
  onSelectSystem: (system: ScheduleSystemType) => void;
  employees?: Employee[];
  selectedEmployeeId?: string;
  onSelectEmployee?: (id: string) => void;
}

export const SystemSelectorBar: React.FC<SystemSelectorBarProps> = ({
  currentSystem,
  onSelectSystem,
  employees = [],
  selectedEmployeeId = '',
  onSelectEmployee,
}) => {
  const systemsList: ScheduleSystemType[] = ['standard', '2-week', '4-week', '8-week'];

  return (
    <div className="bg-[#F8F7EB] border-b border-[#E9E7D4] text-[#2D2D2D] py-2.5 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Left: Active Employee Selector */}
        {employees.length > 0 ? (
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-[#5A5A40] text-white rounded-lg shadow-sm">
              <Users className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-[#8A8A70] whitespace-nowrap">目前檢視同仁：</span>
            <select
              value={selectedEmployeeId}
              onChange={(e) => onSelectEmployee?.(e.target.value)}
              className="bg-white border border-[#D9D7C2] text-[#2D2D2D] font-bold text-xs rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#5A5A40] shadow-sm cursor-pointer"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.role}) - {SYSTEM_CONFIGS[emp.scheduleSystem]?.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div />
        )}

        {/* Right: System Selection Buttons */}
        <div className="flex items-center overflow-x-auto pb-1 sm:pb-0 scrollbar-none self-end sm:self-auto">
          <div className="flex bg-[#E9E7D4] p-1 rounded-xl border border-[#D9D7C2]">
            {systemsList.map((sysKey) => {
              const sys = SYSTEM_CONFIGS[sysKey];
              const isActive = currentSystem === sysKey;
              return (
                <button
                  key={sysKey}
                  onClick={() => onSelectSystem(sysKey)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-[#5A5A40] text-white shadow-sm'
                      : 'text-[#5A5A40] hover:text-[#2D2D2D] hover:bg-[#D9D7C2]/60'
                  }`}
                >
                  <span>{sys.name}</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D17A60] animate-ping" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
