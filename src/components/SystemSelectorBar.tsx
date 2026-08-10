import React, { useEffect, useState } from 'react';
import { Employee, ScheduleSystemType } from '../types';
import { SYSTEM_CONFIGS } from '../constants/systems';
import { ChevronDown, SlidersHorizontal, UserRound } from 'lucide-react';

/**
 * 同仁與工時制度選擇列屬性。
 */
interface SystemSelectorBarProps {
  /** 目前套用的變形工時制度。 */
  currentSystem: ScheduleSystemType;
  /** 切換制度回呼。 */
  onSelectSystem: (system: ScheduleSystemType) => void;
  /** 可選同仁清單。 */
  employees?: Employee[];
  /** 目前檢視同仁 ID。 */
  selectedEmployeeId?: string;
  /** 切換檢視同仁回呼。 */
  onSelectEmployee?: (id: string) => void;
}

/** 同仁／制度觸發鈕共用外觀（白底橄欖字＋圓角陰影）。 */
const triggerClass =
  'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-[#D9D7C2] text-xs font-bold text-[#5A5A40] shadow-sm cursor-pointer';

/**
 * 同仁下拉與變形工時制度切換列。
 * 窄螢幕將工時制度按鈕收合至展開面板；同仁選擇外觀與制度觸發鈕對齊。
 */
export const SystemSelectorBar: React.FC<SystemSelectorBarProps> = ({
  currentSystem,
  onSelectSystem,
  employees = [],
  selectedEmployeeId = '',
  onSelectEmployee,
}) => {
  const systemsList: ScheduleSystemType[] = ['standard', '2-week', '4-week', '8-week'];
  const [systemPanelOpen, setSystemPanelOpen] = useState(false);

  // 進入桌面寬度時關閉收合面板
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setSystemPanelOpen(false);
    };
    handleChange(mq);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const activeSystemName = SYSTEM_CONFIGS[currentSystem]?.name ?? currentSystem;
  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);
  const selectedEmployeeLabel = selectedEmployee
    ? `${selectedEmployee.name} (${selectedEmployee.role})`
    : '選擇同仁';

  /**
   * 制度按鈕群組（桌面直出／行動收合內容共用）。
   * @param compact 是否使用較緊湊的標籤文字
   * @returns 制度切換 UI
   */
  const renderSystemButtons = (compact: boolean) => (
    <div
      className={`flex bg-[#E9E7D4] p-1 rounded-xl border border-[#D9D7C2] ${
        compact ? 'flex-col w-full gap-0.5' : ''
      }`}
    >
      {systemsList.map((sysKey) => {
        const sys = SYSTEM_CONFIGS[sysKey];
        const isActive = currentSystem === sysKey;
        return (
          <button
            key={sysKey}
            type="button"
            onClick={() => {
              onSelectSystem(sysKey);
              setSystemPanelOpen(false);
            }}
            className={`${
              compact ? 'w-full justify-between px-3 py-2' : 'px-3 py-1.5'
            } rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
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
  );

  return (
    <div className="bg-[#F8F7EB] border-b border-[#E9E7D4] text-[#2D2D2D] py-2.5 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* 同仁選擇：外觀對齊制度觸發鈕 */}
        {employees.length > 0 ? (
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <div className={`${triggerClass} pointer-events-none`} aria-hidden>
              <span className="flex items-center gap-2 min-w-0">
                <UserRound className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{selectedEmployeeLabel}</span>
              </span>
              <ChevronDown className="w-4 h-4 flex-shrink-0 opacity-70" />
            </div>
            {/* 透明原生 select 覆蓋於裝飾層上，保留原生可用性 */}
            <select
              value={selectedEmployeeId}
              onChange={(e) => onSelectEmployee?.(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="選擇檢視同仁"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.role})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div />
        )}

        {/* 桌面：制度按鈕直出 */}
        <div className="hidden sm:flex items-center self-end sm:self-auto">
          {renderSystemButtons(false)}
        </div>

        {/* 窄螢幕：制度收合 toggle */}
        <div className="sm:hidden">
          <button
            type="button"
            onClick={() => setSystemPanelOpen((v) => !v)}
            className={triggerClass}
            aria-expanded={systemPanelOpen}
            aria-controls="system-selector-panel"
          >
            <span className="flex items-center gap-2 min-w-0">
              <SlidersHorizontal className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">工時制度：{activeSystemName}</span>
            </span>
            <ChevronDown
              className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${
                systemPanelOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
          <div
            id="system-selector-panel"
            className={`overflow-hidden transition-all duration-300 ease-out ${
              systemPanelOpen
                ? 'max-h-64 opacity-100 mt-2'
                : 'max-h-0 opacity-0 pointer-events-none'
            }`}
          >
            {renderSystemButtons(true)}
          </div>
        </div>
      </div>
    </div>
  );
};
