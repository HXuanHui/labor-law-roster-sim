import React, { useEffect, useRef, useState } from 'react';
import { Employee, ScheduleSystemType } from '../types';
import { SYSTEM_CONFIGS } from '../constants/systems';
import { Calendar, ChevronDown, LayoutGrid, SlidersHorizontal, UserRound } from 'lucide-react';

/** 班表主檢視模式。 */
export type RosterViewMode = 'month' | 'timeline';

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
  /** 目前班表檢視模式（月曆／全人員矩陣）。 */
  viewMode: RosterViewMode;
  /** 切換班表檢視模式回呼。 */
  onChangeViewMode: (mode: RosterViewMode) => void;
}

/** 同仁／收合觸發鈕共用外觀（白底橄欖字＋圓角陰影）。 */
const triggerClass =
  'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-[#D9D7C2] text-sm font-bold text-[#5A5A40] shadow-sm cursor-pointer';

/** 分段選取列外層底色（對齊原本變形工時樣式）。 */
const segmentTrackClass =
  'flex bg-[#E9E7D4] p-1 rounded-xl border border-[#D9D7C2]';

/**
 * 依是否選中回傳分段按鈕 class。
 * @param isActive 是否為目前選項
 * @param compact 是否為行動版直向清單樣式
 * @returns Tailwind class 字串
 */
const segmentBtnClass = (isActive: boolean, compact = false) =>
  `${
    compact ? 'w-full justify-between px-3 py-2' : 'px-3 py-1.5'
  } rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
    isActive
      ? 'bg-[#5A5A40] text-white shadow-sm'
      : 'text-[#5A5A40] hover:text-[#2D2D2D] hover:bg-[#D9D7C2]/60'
  }`;

/**
 * 同仁、變形工時制度與班表檢視模式切換列。
 * 矩陣模式隱藏制度切換以精簡抬頭；月曆模式制度與模式位置對調。
 */
export const SystemSelectorBar: React.FC<SystemSelectorBarProps> = ({
  currentSystem,
  onSelectSystem,
  employees = [],
  selectedEmployeeId = '',
  onSelectEmployee,
  viewMode,
  onChangeViewMode,
}) => {
  const systemsList: ScheduleSystemType[] = ['standard', '2-week', '4-week', '8-week'];
  const [systemPanelOpen, setSystemPanelOpen] = useState(false);
  const [employeeMenuOpen, setEmployeeMenuOpen] = useState(false);
  const employeeMenuRef = useRef<HTMLDivElement>(null);
  /** 矩陣模式不顯示制度列（避免擠壓抬頭）。 */
  const showSystemControls = viewMode === 'month';

  // 進入桌面寬度時關閉行動收合面板
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setSystemPanelOpen(false);
    };
    handleChange(mq);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  // 點擊外側或 Esc 關閉同仁選單
  useEffect(() => {
    if (!employeeMenuOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (employeeMenuRef.current && !employeeMenuRef.current.contains(e.target as Node)) {
        setEmployeeMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEmployeeMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [employeeMenuOpen]);

  // 切換到矩陣模式時關閉同仁選單與制度面板
  useEffect(() => {
    if (viewMode !== 'month') {
      setEmployeeMenuOpen(false);
      setSystemPanelOpen(false);
    }
  }, [viewMode]);

  const activeSystemName = SYSTEM_CONFIGS[currentSystem]?.name ?? currentSystem;
  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);
  const selectedEmployeeLabel = selectedEmployee
    ? `${selectedEmployee.name} (${selectedEmployee.role})`
    : '選擇同仁';

  // 僅月曆模式需要挑選單一同仁；矩陣模式改看全體
  const showEmployeePicker = viewMode === 'month' && employees.length > 0;

  /**
   * 制度分段按鈕（桌面橫列／行動直列共用）。
   * @param compact 是否使用直向清單
   * @returns 制度切換 UI
   */
  const renderSystemButtons = (compact: boolean) => (
    <div className={`${segmentTrackClass} ${compact ? 'flex-col w-full gap-0.5' : ''}`}>
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
            className={segmentBtnClass(isActive, compact)}
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

  /**
   * 月曆／全人員矩陣分段切換。
   * @returns 模式切換 UI
   */
  const renderViewModeToggle = () => (
    <div className={segmentTrackClass} role="group" aria-label="班表檢視模式">
      <button
        type="button"
        onClick={() => onChangeViewMode('month')}
        className={segmentBtnClass(viewMode === 'month')}
        aria-pressed={viewMode === 'month'}
        title="月曆模式"
      >
        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="hidden sm:inline">月曆模式</span>
        <span className="sm:hidden">月曆</span>
      </button>
      <button
        type="button"
        onClick={() => onChangeViewMode('timeline')}
        className={segmentBtnClass(viewMode === 'timeline')}
        aria-pressed={viewMode === 'timeline'}
        title="全人員矩陣模式"
      >
        <LayoutGrid className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="hidden sm:inline">全人員矩陣</span>
        <span className="sm:hidden">矩陣</span>
      </button>
    </div>
  );

  /**
   * 窄螢幕制度收合觸發列。
   * @returns 制度 UI
   */
  const renderMobileSystemCollapse = () => (
    <div className="sm:hidden w-full">
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
  );

  return (
    <div className="bg-[#F8F7EB] border-b border-[#E9E7D4] text-[#2D2D2D] py-2.5 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-2.5">
        {/*
          月曆：左同仁、右制度＋模式（制度與模式對調：先模式後制度→改先制度後模式？）
          使用者要求與「月曆｜矩陣」調換 → 窄螢幕原「列一模式／列二制度」改為「列一制度／列二模式」；
          矩陣：隱藏制度，模式改放原本制度列位置以利美觀。
        */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {showEmployeePicker ? (
              <div ref={employeeMenuRef} className="relative min-w-0 flex-1 sm:max-w-xs">
                <button
                  type="button"
                  onClick={() => setEmployeeMenuOpen((v) => !v)}
                  className={triggerClass}
                  aria-expanded={employeeMenuOpen}
                  aria-haspopup="listbox"
                  aria-label="選擇檢視同仁"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <UserRound className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{selectedEmployeeLabel}</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 flex-shrink-0 opacity-70 transition-transform duration-200 ${
                      employeeMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {employeeMenuOpen && (
                  <div
                    role="listbox"
                    aria-label="同仁清單"
                    className="absolute left-0 right-0 mt-1.5 z-50 rounded-xl border border-[#D9D7C2] bg-[#E9E7D4] p-1 shadow-lg max-h-64 overflow-y-auto"
                  >
                    {employees.map((emp) => {
                      const isActive = emp.id === selectedEmployeeId;
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onClick={() => {
                            onSelectEmployee?.(emp.id);
                            setEmployeeMenuOpen(false);
                          }}
                          className={segmentBtnClass(isActive, true)}
                        >
                          <span className="truncate">
                            {emp.name} ({emp.role})
                          </span>
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D17A60] animate-ping flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden sm:block flex-1 sm:max-w-xs" />
            )}

            {/* 窄螢幕矩陣：模式與標題列同列（制度已藏） */}
            {viewMode === 'timeline' && (
              <div className="flex sm:hidden flex-shrink-0">{renderViewModeToggle()}</div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            {/* 桌面：先制度、後模式（與舊版調換）；矩陣隱藏制度 */}
            {showSystemControls && (
              <div className="hidden sm:flex items-center">{renderSystemButtons(false)}</div>
            )}
            <div className="hidden sm:flex items-center">{renderViewModeToggle()}</div>

            {/* 窄螢幕月曆：制度在模式上方（列順序對調） */}
            {showSystemControls && renderMobileSystemCollapse()}
            {viewMode === 'month' && (
              <div className="flex sm:hidden w-full">{renderViewModeToggle()}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
