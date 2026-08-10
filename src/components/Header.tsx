import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Users,
  Download,
  ShieldCheck,
  Sun,
  RefreshCw,
  Layers,
  BookOpen,
  Sparkles,
  Trash2,
  Menu,
  X,
} from 'lucide-react';
import { ScheduleSystemType } from '../types';

/**
 * 系統頂部導覽列屬性。
 */
interface HeaderProps {
  /** 目前套用的變形工時制度（保留相容，導覽列本身不切換制度）。 */
  currentSystem: ScheduleSystemType;
  /** 切換制度回呼（保留相容）。 */
  onSelectSystem: (system: ScheduleSystemType) => void;
  /** 開啟國定假日設定。 */
  onOpenHolidaysModal: () => void;
  /** 開啟班別設定。 */
  onOpenShiftModal: () => void;
  /** 開啟同仁名單管理。 */
  onOpenEmployeeModal: () => void;
  /** 開啟初始設定導引。 */
  onOpenSetupWizardModal?: () => void;
  /** 開啟使用說明。 */
  onOpenUserGuideModal?: () => void;
  /** 清除所有本機儲存資料。 */
  onClearAllData?: () => void;
  /** 匯出 JSON 備份。 */
  onExportJSON: () => void;
  /** 開啟匯出／列印面板。 */
  onPrint: () => void;
  /** 重置目前同仁本月班表。 */
  onResetSchedules: () => void;
  /** 即時違規筆數（error 等級）。 */
  violationCount: number;
}

/**
 * 系統頂部導覽列：品牌、違規狀態與設定工具。
 * 窄螢幕將功能按鈕收合至選單，避免工具列換行擁擠。
 */
export const Header: React.FC<HeaderProps> = ({
  onOpenHolidaysModal,
  onOpenShiftModal,
  onOpenEmployeeModal,
  onOpenSetupWizardModal,
  onOpenUserGuideModal,
  onClearAllData,
  onPrint,
  onResetSchedules,
  violationCount,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  // 切換到桌面寬度時強制關閉行動選單，避免殘留展開狀態
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setMenuOpen(false);
    };
    handleChange(mq);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  /**
   * 執行動作後關閉行動選單（僅窄螢幕需要）。
   * @param action 使用者觸發的回呼
   */
  const runAndClose = (action: () => void) => {
    action();
    setMenuOpen(false);
  };

  /**
   * 捲動至班表檢核面板。
   */
  const scrollToAudit = () => {
    const el = document.getElementById('labor-audit-panel');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 導覽工具鈕統一樣式（白底橄欖字），避免功能色過於雜亂
  const toolBtnClass =
    'px-3 py-1.5 rounded-lg bg-white hover:bg-[#E9E7D4] text-[#5A5A40] text-xs font-medium border border-[#E9E7D4] flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer';
  const toolBtnMobileClass =
    'px-3 py-2.5 rounded-xl bg-white hover:bg-[#E9E7D4] text-[#5A5A40] text-xs font-medium border border-[#E9E7D4] flex items-center gap-2 transition-colors cursor-pointer';
  const toolIconClass = 'w-3.5 h-3.5 text-[#5A5A40] flex-shrink-0';
  const toolIconMobileClass = 'w-4 h-4 text-[#5A5A40] flex-shrink-0';

  return (
    <header className="bg-[#F8F7EB] text-[#2D2D2D] border-b border-[#E9E7D4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3 gap-3">
          {/* Logo & App Name */}
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#5A5A40] flex items-center justify-center shadow-sm flex-shrink-0">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#2D2D2D] truncate">
                排班模擬系統
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 窄螢幕違規狀態膠囊 */}
            <div className="flex md:hidden items-center">
              {violationCount > 0 ? (
                <button
                  onClick={scrollToAudit}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#D17A60]/15 text-[#D17A60] border border-[#D17A60]/30 animate-pulse cursor-pointer hover:bg-[#D17A60]/25 transition-colors"
                  title="點擊前往班表檢核表"
                >
                  ⚠️ {violationCount}
                </button>
              ) : (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#4A7C59]/15 text-[#4A7C59] border border-[#4A7C59]/30 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </span>
              )}
            </div>

            {/* 桌面端違規狀態 */}
            <div className="hidden lg:flex items-center mr-1">
              {violationCount > 0 ? (
                <button
                  onClick={scrollToAudit}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-[#D17A60]/15 text-[#D17A60] border border-[#D17A60]/30 flex items-center gap-1.5 animate-pulse cursor-pointer hover:bg-[#D17A60]/25 transition-colors"
                  title="點擊前往班表檢核表查看違規細節"
                >
                  <span className="w-2 h-2 rounded-full bg-[#D17A60]" />
                  即時診斷：發現 {violationCount} 項勞檢警告
                </button>
              ) : (
                <div className="px-3 py-1 rounded-lg text-xs font-medium bg-[#4A7C59]/15 text-[#4A7C59] border border-[#4A7C59]/30 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  勞基法檢核通過
                </div>
              )}
            </div>

            {/* 窄螢幕：功能選單開關 */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden p-2 rounded-xl bg-white border border-[#E9E7D4] text-[#5A5A40] hover:bg-[#E9E7D4] transition-colors cursor-pointer shadow-sm"
              aria-expanded={menuOpen}
              aria-controls="header-action-menu"
              title={menuOpen ? '關閉功能選單' : '開啟功能選單'}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* 桌面端：功能列直出（樣式統一） */}
            <div className="hidden md:flex items-center flex-wrap gap-2 justify-end">
              {onOpenUserGuideModal && (
                <button
                  onClick={onOpenUserGuideModal}
                  className={toolBtnClass}
                  title="查看勞基法變形工時排班指南與操作技巧"
                >
                  <BookOpen className={toolIconClass} />
                  <span>使用說明</span>
                </button>
              )}
              {onOpenSetupWizardModal && (
                <button
                  onClick={onOpenSetupWizardModal}
                  className={toolBtnClass}
                  title="開啟初始排班設定面板 (國定假日、班別、同仁)"
                >
                  <Sparkles className={toolIconClass} />
                  <span>初始設定導引</span>
                </button>
              )}
              <button
                onClick={onOpenHolidaysModal}
                className={toolBtnClass}
                title="設定自訂與國定假日"
              >
                <Sun className={toolIconClass} />
                <span>國定假日</span>
              </button>
              <button
                onClick={onOpenShiftModal}
                className={toolBtnClass}
                title="管理班別代碼與工時"
              >
                <Layers className={toolIconClass} />
                <span>班別設定</span>
              </button>
              <button
                onClick={onOpenEmployeeModal}
                className={toolBtnClass}
                title="管理同仁名單與適用工時制度"
              >
                <Users className={toolIconClass} />
                <span>同仁名單</span>
              </button>
              <button onClick={onPrint} className={toolBtnClass} title="匯出或列印班表">
                <Download className={toolIconClass} />
                <span>匯出 / 列印</span>
              </button>
              {onClearAllData && (
                <button
                  onClick={onClearAllData}
                  className={toolBtnClass}
                  title="一鍵清除所有 LocalStorage 已存資料 (同仁、班別、假日)"
                >
                  <Trash2 className={toolIconClass} />
                  <span className="hidden lg:inline">清除所有資料</span>
                </button>
              )}
              <button
                onClick={onResetSchedules}
                className="p-1.5 rounded-lg bg-white hover:bg-[#E9E7D4] text-[#5A5A40] border border-[#E9E7D4] transition-colors cursor-pointer shadow-sm"
                title="重置目前同仁本月班表"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 窄螢幕展開式功能選單 */}
        <div
          id="header-action-menu"
          className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
            menuOpen ? 'max-h-[420px] opacity-100 pb-3' : 'max-h-0 opacity-0 pointer-events-none'
          }`}
        >
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#E9E7D4]">
            {onOpenUserGuideModal && (
              <button
                onClick={() => runAndClose(onOpenUserGuideModal)}
                className={toolBtnMobileClass}
              >
                <BookOpen className={toolIconMobileClass} />
                使用說明
              </button>
            )}
            {onOpenSetupWizardModal && (
              <button
                onClick={() => runAndClose(onOpenSetupWizardModal)}
                className={toolBtnMobileClass}
              >
                <Sparkles className={toolIconMobileClass} />
                初始設定
              </button>
            )}
            <button
              onClick={() => runAndClose(onOpenHolidaysModal)}
              className={toolBtnMobileClass}
            >
              <Sun className={toolIconMobileClass} />
              國定假日
            </button>
            <button onClick={() => runAndClose(onOpenShiftModal)} className={toolBtnMobileClass}>
              <Layers className={toolIconMobileClass} />
              班別設定
            </button>
            <button
              onClick={() => runAndClose(onOpenEmployeeModal)}
              className={toolBtnMobileClass}
            >
              <Users className={toolIconMobileClass} />
              同仁名單
            </button>
            <button onClick={() => runAndClose(onPrint)} className={toolBtnMobileClass}>
              <Download className={toolIconMobileClass} />
              匯出 / 列印
            </button>
            {onClearAllData && (
              <button onClick={() => runAndClose(onClearAllData)} className={toolBtnMobileClass}>
                <Trash2 className={toolIconMobileClass} />
                清除資料
              </button>
            )}
            <button onClick={() => runAndClose(onResetSchedules)} className={toolBtnMobileClass}>
              <RefreshCw className={toolIconMobileClass} />
              重置班表
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
