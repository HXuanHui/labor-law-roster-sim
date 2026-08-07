import React from 'react';
import { Calendar, Settings, Users, Download, ShieldCheck, Sun, Plus, RefreshCw, Layers, BookOpen, Sparkles, Trash2 } from 'lucide-react';
import { ScheduleSystemType } from '../types';
import { SYSTEM_CONFIGS } from '../constants/systems';

interface HeaderProps {
  currentSystem: ScheduleSystemType;
  onSelectSystem: (system: ScheduleSystemType) => void;
  onOpenHolidaysModal: () => void;
  onOpenShiftModal: () => void;
  onOpenEmployeeModal: () => void;
  onOpenSetupWizardModal?: () => void;
  onOpenUserGuideModal?: () => void;
  onClearAllData?: () => void;
  onExportJSON: () => void;
  onPrint: () => void;
  onResetSchedules: () => void;
  violationCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentSystem,
  onSelectSystem,
  onOpenHolidaysModal,
  onOpenShiftModal,
  onOpenEmployeeModal,
  onOpenSetupWizardModal,
  onOpenUserGuideModal,
  onClearAllData,
  onExportJSON,
  onPrint,
  onResetSchedules,
  violationCount,
}) => {
  return (
    <header className="bg-[#F8F7EB] text-[#2D2D2D] border-b border-[#E9E7D4] sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between py-3 gap-3">
          {/* Logo & App Name */}
          <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-[#5A5A40] flex items-center justify-center shadow-sm">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-[#2D2D2D]">
                  排班模擬系統
                </h1>
              </div>
            </div>

            {/* Violation Alert Pill (Mobile/Desktop) */}
            <div className="flex md:hidden items-center">
              {violationCount > 0 ? (
                <button
                  onClick={() => {
                    const el = document.getElementById('labor-audit-panel');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#D17A60]/15 text-[#D17A60] border border-[#D17A60]/30 animate-pulse cursor-pointer hover:bg-[#D17A60]/25 transition-colors"
                  title="點擊前往班表檢核表"
                >
                  ⚠️ {violationCount} 違規
                </button>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#4A7C59]/15 text-[#4A7C59] border border-[#4A7C59]/30 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#4A7C59]" /> 合規
                </span>
              )}
            </div>
          </div>

          {/* Action Tools Bar */}
          <div className="flex items-center flex-wrap gap-2 w-full md:w-auto justify-end">
            {/* Status indicator on desktop */}
            <div className="hidden lg:flex items-center mr-2">
              {violationCount > 0 ? (
                <button
                  onClick={() => {
                    const el = document.getElementById('labor-audit-panel');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-[#D17A60]/15 text-[#D17A60] border border-[#D17A60]/30 flex items-center gap-1.5 animate-pulse cursor-pointer hover:bg-[#D17A60]/25 transition-colors"
                  title="點擊前往班表檢核表查看違規細節"
                >
                  <span className="w-2 h-2 rounded-full bg-[#D17A60]"></span>
                  即時診斷：發現 {violationCount} 項勞檢警告
                </button>
              ) : (
                <div className="px-3 py-1 rounded-lg text-xs font-medium bg-[#4A7C59]/15 text-[#4A7C59] border border-[#4A7C59]/30 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#4A7C59]" />
                  勞基法檢核通過
                </div>
              )}
            </div>

            {/* User Guide Button */}
            {onOpenUserGuideModal && (
              <button
                onClick={onOpenUserGuideModal}
                className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200 flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                title="查看勞基法變形工時排班指南與操作技巧"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                <span>使用說明</span>
              </button>
            )}

            {/* Initial Setup Wizard Button */}
            {onOpenSetupWizardModal && (
              <button
                onClick={onOpenSetupWizardModal}
                className="px-3 py-1.5 rounded-lg bg-[#5A5A40]/10 hover:bg-[#5A5A40]/20 text-[#5A5A40] text-xs font-bold border border-[#5A5A40]/30 flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                title="開啟初始排班設定面板 (國定假日、班別、同仁)"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#5A5A40]" />
                <span>初始設定導引</span>
              </button>
            )}

            {/* National Holidays Settings */}
            <button
              onClick={onOpenHolidaysModal}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#E9E7D4] text-[#5A5A40] text-xs font-medium border border-[#E9E7D4] flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              title="設定自訂與國定假日"
            >
              <Sun className="w-3.5 h-3.5 text-[#D17A60]" />
              <span>國定假日</span>
            </button>

            {/* Shift Type Settings */}
            <button
              onClick={onOpenShiftModal}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#E9E7D4] text-[#5A5A40] text-xs font-medium border border-[#E9E7D4] flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              title="管理班別代碼與工時"
            >
              <Layers className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>班別設定</span>
            </button>

            {/* Employee Management */}
            <button
              onClick={onOpenEmployeeModal}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#E9E7D4] text-[#5A5A40] text-xs font-medium border border-[#E9E7D4] flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              title="管理同仁名單與適用工時制度"
            >
              <Users className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>同仁名單</span>
            </button>

            {/* Print / Export */}
            <button
              onClick={onPrint}
              className="px-3 py-1.5 rounded-lg bg-[#5A5A40] hover:bg-[#484833] text-white text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>匯出 / 列印</span>
            </button>

            {/* Clear All Saved Data */}
            {onClearAllData && (
              <button
                onClick={onClearAllData}
                className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 border border-red-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                title="一鍵清除所有 LocalStorage 已存資料 (同仁、班別、假日)"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                <span className="hidden sm:inline">清除所有資料</span>
              </button>
            )}

            {/* Reset */}
            <button
              onClick={onResetSchedules}
              className="p-1.5 rounded-lg bg-white hover:bg-[#D17A60]/20 text-[#8A8A70] hover:text-[#D17A60] border border-[#E9E7D4] transition-colors cursor-pointer"
              title="重置目前同仁本月班表"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

