import React, { useEffect, useRef, useState } from 'react';
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
  Settings,
  ChevronDown,
  CircleHelp,
  Scale,
  AlertTriangle,
  Heart,
} from 'lucide-react';
import { ScheduleSystemType } from '../types';

/** 桌面下拉選單識別碼。 */
type DesktopMenuId = 'settings' | 'help' | null;

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
  /** 開啟免責說明。 */
  onOpenDisclaimerModal?: () => void;
  /** 開啟法規說明。 */
  onOpenLegalModal?: () => void;
  /** 開啟關於我／贊助。 */
  onOpenAboutModal?: () => void;
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
 * 系統頂部導覽列：品牌、違規狀態，以及匯出／設定／說明三分組入口。
 * 窄螢幕以同構分組收合至漢堡選單，避免工具列擁擠。
 */
export const Header: React.FC<HeaderProps> = ({
  onOpenHolidaysModal,
  onOpenShiftModal,
  onOpenEmployeeModal,
  onOpenSetupWizardModal,
  onOpenUserGuideModal,
  onOpenDisclaimerModal,
  onOpenLegalModal,
  onOpenAboutModal,
  onClearAllData,
  onPrint,
  onResetSchedules,
  violationCount,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [desktopMenu, setDesktopMenu] = useState<DesktopMenuId>(null);
  const desktopMenusRef = useRef<HTMLDivElement>(null);

  // 切換到桌面寬度時強制關閉行動選單，避免殘留展開狀態
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setMenuOpen(false);
      else setDesktopMenu(null);
    };
    handleChange(mq);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  // 點擊選單外側或按 Esc 時關閉桌面下拉
  useEffect(() => {
    if (!desktopMenu) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (desktopMenusRef.current && !desktopMenusRef.current.contains(e.target as Node)) {
        setDesktopMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDesktopMenu(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [desktopMenu]);

  /**
   * 執行動作後關閉行動選單（僅窄螢幕需要）。
   * @param action 使用者觸發的回呼
   */
  const runAndCloseMobile = (action: () => void) => {
    action();
    setMenuOpen(false);
  };

  /**
   * 執行動作後關閉桌面下拉選單。
   * @param action 使用者觸發的回呼
   */
  const runAndCloseDesktop = (action: () => void) => {
    action();
    setDesktopMenu(null);
  };

  /**
   * 切換桌面下拉選單（再開另一個時關閉前一個）。
   * @param id 目標選單識別碼
   */
  const toggleDesktopMenu = (id: Exclude<DesktopMenuId, null>) => {
    setDesktopMenu((prev) => (prev === id ? null : id));
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
    'px-3 py-1.5 rounded-lg bg-white hover:bg-[#E9E7D4] text-[#5A5A40] text-sm font-medium border border-[#E9E7D4] flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer';
  const toolBtnMobileClass =
    'w-full px-3 py-2.5 rounded-xl bg-white hover:bg-[#E9E7D4] text-[#5A5A40] text-sm font-medium border border-[#E9E7D4] flex items-center gap-2 transition-colors cursor-pointer text-left';
  const toolIconClass = 'w-3.5 h-3.5 text-[#5A5A40] flex-shrink-0';
  const toolIconMobileClass = 'w-4 h-4 text-[#5A5A40] flex-shrink-0';
  const dropdownItemClass =
    'w-full px-3 py-2 text-left text-sm font-medium text-[#5A5A40] hover:bg-[#E9E7D4] flex items-center gap-2 transition-colors cursor-pointer';
  const dropdownDangerItemClass =
    'w-full px-3 py-2 text-left text-sm font-medium text-[#D17A60] hover:bg-[#D17A60]/10 flex items-center gap-2 transition-colors cursor-pointer';
  const sectionLabelClass = 'px-1 pt-2 pb-1 text-xs font-bold tracking-wide text-[#8A8A70] uppercase';

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
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#2D2D2D] truncate">
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
                  className="px-2.5 py-1 rounded-full text-sm font-medium bg-[#D17A60]/15 text-[#D17A60] border border-[#D17A60]/30 animate-pulse cursor-pointer hover:bg-[#D17A60]/25 transition-colors"
                  title="點擊前往班表檢核表"
                >
                  ⚠️ {violationCount}
                </button>
              ) : (
                <span className="px-2 py-1 rounded-full text-sm font-medium bg-[#4A7C59]/15 text-[#4A7C59] border border-[#4A7C59]/30 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </span>
              )}
            </div>

            {/* 桌面端違規狀態 */}
            <div className="hidden lg:flex items-center mr-1">
              {violationCount > 0 ? (
                <button
                  onClick={scrollToAudit}
                  className="px-3 py-1 rounded-lg text-sm font-medium bg-[#D17A60]/15 text-[#D17A60] border border-[#D17A60]/30 flex items-center gap-1.5 animate-pulse cursor-pointer hover:bg-[#D17A60]/25 transition-colors"
                  title="點擊前往班表檢核表查看需留意項目"
                >
                  <span className="w-2 h-2 rounded-full bg-[#D17A60]" />
                  模擬檢核：發現 {violationCount} 項需留意
                </button>
              ) : (
                <div
                  className="px-3 py-1 rounded-lg text-sm font-medium bg-[#4A7C59]/15 text-[#4A7C59] border border-[#4A7C59]/30 flex items-center gap-1.5"
                  title="依內建規則之模擬結果，非正式法律意見或勞動檢查結論"
                >
                  <ShieldCheck className="w-4 h-4" />
                  依目前規則未偵測到違規
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

            {/* 桌面端：匯出 + 設定／說明下拉 */}
            <div ref={desktopMenusRef} className="hidden md:flex items-center gap-2 justify-end">
              <button onClick={onPrint} className={toolBtnClass} title="匯出或列印班表">
                <Download className={toolIconClass} />
                <span>匯出</span>
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDesktopMenu('settings')}
                  className={toolBtnClass}
                  aria-expanded={desktopMenu === 'settings'}
                  aria-haspopup="menu"
                  title="開啟設定選單"
                >
                  <Settings className={toolIconClass} />
                  <span>設定</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      desktopMenu === 'settings' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {desktopMenu === 'settings' && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-1.5 w-52 rounded-xl border border-[#E9E7D4] bg-white shadow-lg py-1 z-50 overflow-hidden"
                  >
                    {onOpenSetupWizardModal && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runAndCloseDesktop(onOpenSetupWizardModal)}
                        className={dropdownItemClass}
                      >
                        <Sparkles className={toolIconClass} />
                        初始設定導引
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runAndCloseDesktop(onOpenHolidaysModal)}
                      className={dropdownItemClass}
                    >
                      <Sun className={toolIconClass} />
                      國定假日
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runAndCloseDesktop(onOpenShiftModal)}
                      className={dropdownItemClass}
                    >
                      <Layers className={toolIconClass} />
                      班別設定
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runAndCloseDesktop(onOpenEmployeeModal)}
                      className={dropdownItemClass}
                    >
                      <Users className={toolIconClass} />
                      同仁名單
                    </button>
                    <div className="my-1 border-t border-[#E9E7D4]" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runAndCloseDesktop(onResetSchedules)}
                      className={dropdownItemClass}
                    >
                      <RefreshCw className={toolIconClass} />
                      重置本月班表
                    </button>
                    {onClearAllData && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runAndCloseDesktop(onClearAllData)}
                        className={dropdownDangerItemClass}
                      >
                        <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                        清除所有資料
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDesktopMenu('help')}
                  className={toolBtnClass}
                  aria-expanded={desktopMenu === 'help'}
                  aria-haspopup="menu"
                  title="開啟說明選單"
                >
                  <CircleHelp className={toolIconClass} />
                  <span>說明</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      desktopMenu === 'help' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {desktopMenu === 'help' && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-1.5 w-48 rounded-xl border border-[#E9E7D4] bg-white shadow-lg py-1 z-50 overflow-hidden"
                  >
                    {onOpenUserGuideModal && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runAndCloseDesktop(onOpenUserGuideModal)}
                        className={dropdownItemClass}
                      >
                        <BookOpen className={toolIconClass} />
                        使用說明
                      </button>
                    )}
                    {onOpenDisclaimerModal && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runAndCloseDesktop(onOpenDisclaimerModal)}
                        className={dropdownItemClass}
                      >
                        <AlertTriangle className={toolIconClass} />
                        免責說明
                      </button>
                    )}
                    {onOpenLegalModal && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runAndCloseDesktop(onOpenLegalModal)}
                        className={dropdownItemClass}
                      >
                        <Scale className={toolIconClass} />
                        法規說明
                      </button>
                    )}
                    {onOpenAboutModal && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runAndCloseDesktop(onOpenAboutModal)}
                        className={dropdownItemClass}
                      >
                        <Heart className={toolIconClass} />
                        關於我
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 窄螢幕展開式功能選單（與桌面同構三分組） */}
        <div
          id="header-action-menu"
          className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
            menuOpen ? 'max-h-[70vh] opacity-100 pb-3' : 'max-h-0 opacity-0 pointer-events-none'
          }`}
        >
          <div className="pt-1 border-t border-[#E9E7D4] space-y-3 overflow-y-auto max-h-[calc(70vh-0.5rem)]">
            <section className="space-y-1.5">
              <p className={sectionLabelClass}>設定</p>
              <div className="grid grid-cols-2 gap-2">
                {onOpenSetupWizardModal && (
                  <button
                    type="button"
                    onClick={() => runAndCloseMobile(onOpenSetupWizardModal)}
                    className={toolBtnMobileClass}
                  >
                    <Sparkles className={toolIconMobileClass} />
                    初始設定
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => runAndCloseMobile(onOpenHolidaysModal)}
                  className={toolBtnMobileClass}
                >
                  <Sun className={toolIconMobileClass} />
                  國定假日
                </button>
                <button
                  type="button"
                  onClick={() => runAndCloseMobile(onOpenShiftModal)}
                  className={toolBtnMobileClass}
                >
                  <Layers className={toolIconMobileClass} />
                  班別設定
                </button>
                <button
                  type="button"
                  onClick={() => runAndCloseMobile(onOpenEmployeeModal)}
                  className={toolBtnMobileClass}
                >
                  <Users className={toolIconMobileClass} />
                  同仁名單
                </button>
                <button
                  type="button"
                  onClick={() => runAndCloseMobile(onResetSchedules)}
                  className={toolBtnMobileClass}
                >
                  <RefreshCw className={toolIconMobileClass} />
                  重置班表
                </button>
                {onClearAllData && (
                  <button
                    type="button"
                    onClick={() => runAndCloseMobile(onClearAllData)}
                    className={toolBtnMobileClass}
                  >
                    <Trash2 className={toolIconMobileClass} />
                    清除資料
                  </button>
                )}
              </div>
            </section>

            <section className="space-y-1.5">
              <p className={sectionLabelClass}>匯出</p>
              <button
                type="button"
                onClick={() => runAndCloseMobile(onPrint)}
                className={toolBtnMobileClass}
              >
                <Download className={toolIconMobileClass} />
                匯出 / 列印
              </button>
            </section>

            <section className="space-y-1.5">
              <p className={sectionLabelClass}>說明</p>
              <div className="grid grid-cols-2 gap-2">
                {onOpenUserGuideModal && (
                  <button
                    type="button"
                    onClick={() => runAndCloseMobile(onOpenUserGuideModal)}
                    className={toolBtnMobileClass}
                  >
                    <BookOpen className={toolIconMobileClass} />
                    使用說明
                  </button>
                )}
                {onOpenDisclaimerModal && (
                  <button
                    type="button"
                    onClick={() => runAndCloseMobile(onOpenDisclaimerModal)}
                    className={toolBtnMobileClass}
                  >
                    <AlertTriangle className={toolIconMobileClass} />
                    免責說明
                  </button>
                )}
                {onOpenLegalModal && (
                  <button
                    type="button"
                    onClick={() => runAndCloseMobile(onOpenLegalModal)}
                    className={toolBtnMobileClass}
                  >
                    <Scale className={toolIconMobileClass} />
                    法規說明
                  </button>
                )}
                {onOpenAboutModal && (
                  <button
                    type="button"
                    onClick={() => runAndCloseMobile(onOpenAboutModal)}
                    className={toolBtnMobileClass}
                  >
                    <Heart className={toolIconMobileClass} />
                    關於我
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </header>
  );
};
