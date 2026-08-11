import React, { useEffect, useState } from 'react';
import { Coffee, Heart, Info, MessageCircle, Sparkles, X } from 'lucide-react';
import { RECENT_UPDATES } from '../constants/recentUpdates';

/** 「關於」標籤頁識別碼。 */
export type AboutTabId = 'tool' | 'updates' | 'feedback' | 'support';

/**
 * 「關於」Modal 屬性。
 */
interface AboutModalProps {
  /** 是否顯示。 */
  isOpen: boolean;
  /** 關閉回呼。 */
  onClose: () => void;
  /** 開啟免責說明（自「關於本工具」內文連結）。 */
  onOpenDisclaimer: () => void;
  /**
   * 開啟時預設選中的標籤。
   * 例如頁尾「請我杯咖啡」應直接落到支援維護。
   */
  initialTabId?: AboutTabId;
}

/**
 * 「關於」標籤頁定義。
 */
interface AboutTab {
  /** 標籤識別碼。 */
  id: AboutTabId;
  /** 側欄標題。 */
  title: string;
  /** 圖示元件。 */
  icon: React.ReactNode;
}

/** 說明標籤順序：新增項目時一併遞延後續編號。 */
const ABOUT_TABS: AboutTab[] = [
  { id: 'tool', title: '關於本工具', icon: <Info className="w-5 h-5" /> },
  { id: 'updates', title: '近期更新', icon: <Sparkles className="w-5 h-5" /> },
  { id: 'feedback', title: '意見回饋', icon: <MessageCircle className="w-5 h-5" /> },
  { id: 'support', title: '支援維護', icon: <Coffee className="w-5 h-5" /> },
];

/**
 * 「關於」：以標籤頁呈現工具緣起、近期更新、回饋管道與支援維護。
 *
 * @param props.isOpen 是否顯示
 * @param props.onClose 關閉回呼
 * @param props.onOpenDisclaimer 開啟免責說明
 * @param props.initialTabId 開啟時預設標籤
 */
export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  onOpenDisclaimer,
  initialTabId = 'tool',
}) => {
  const [activeTabId, setActiveTabId] = useState<AboutTabId>(initialTabId);

  // 每次開啟時依呼叫端指定的標籤切換（關閉期間使用者選過的分頁不保留）
  useEffect(() => {
    if (isOpen) {
      setActiveTabId(initialTabId);
    }
  }, [isOpen, initialTabId]);

  if (!isOpen) return null;

  const activeTab = ABOUT_TABS.find((tab) => tab.id === activeTabId) ?? ABOUT_TABS[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
        className="bg-white border border-[#E9E7D4] rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-xl text-[#2D2D2D] space-y-4 my-6"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E9E7D4] pb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl border border-[#5A5A40]/20 flex-shrink-0">
              <Heart className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2
                id="about-modal-title"
                className="text-xl font-bold text-[#2D2D2D] font-serif"
              >
                關於
              </h2>
              <p className="text-sm text-[#8A8A70] mt-0.5">工具緣起、近期更新、回饋與支援維護</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8A8A70] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] transition-colors cursor-pointer flex-shrink-0"
            aria-label="關閉關於"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 min-h-72">
          {/* 側欄標籤：小螢幕橫向捲動，桌面直向排列 */}
          <nav
            className="sm:w-52 shrink-0 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0"
            aria-label="關於分頁"
          >
            {ABOUT_TABS.map((tab, index) => {
              const isActive = tab.id === activeTab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTabId(tab.id)}
                  className={`shrink-0 px-3 py-2.5 rounded-xl text-left text-sm font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                    isActive
                      ? 'bg-[#5A5A40] text-white'
                      : 'bg-[#F8F7EB] text-[#5A5A40] hover:bg-[#E9E7D4]'
                  }`}
                >
                  <span className={`inline-flex ${isActive ? 'text-white' : 'text-[#5A5A40]'}`}>
                    {tab.icon}
                  </span>
                  <span>
                    {index + 1}. {tab.title}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="flex-1 max-h-128 overflow-y-auto pr-1 space-y-4 text-sm leading-relaxed">
            <section className="space-y-3">
              <h3 className="text-base font-bold text-[#5A5A40] flex items-center gap-2">
                <span className="inline-flex text-[#5A5A40]">{activeTab.icon}</span>
                {activeTab.title}
              </h3>

              {activeTab.id === 'tool' && (
                <div className="space-y-3 rounded-xl border border-[#E9E7D4] bg-[#F8F7EB] p-3.5">
                  <p className="text-[#2D2D2D]">
                    周邊很多人為了彈性工時苦惱：上班花很多時間排班表，排完卻又因為錯誤而存檔不了。因此做了這個可快速試錯的工具，也協助規劃休假、加班等安排。
                  </p>
                  <p className="text-[#2D2D2D]">
                    本工具可模擬排班、休假、加班、補休等情境，但
                    <strong className="font-bold">不可作為法律證實工具</strong>
                    ；詳情請參考
                    <button
                      type="button"
                      onClick={onOpenDisclaimer}
                      className="mx-1 underline underline-offset-2 text-[#5A5A40] hover:text-[#484833] font-bold transition-colors cursor-pointer"
                    >
                      免責說明
                    </button>
                    。
                  </p>
                </div>
              )}

              {activeTab.id === 'updates' && (
                <div className="space-y-3">
                  {/* 僅展示常數清單前三筆，維持「近三次」約定 */}
                  {RECENT_UPDATES.slice(0, 3).map((entry) => (
                    <article
                      key={`${entry.date}-${entry.title}`}
                      className="rounded-xl border border-[#E9E7D4] bg-[#F8F7EB] p-3.5 space-y-2"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <time
                          dateTime={entry.date}
                          className="text-xs font-bold text-[#8A8A70] tabular-nums"
                        >
                          {entry.date}
                        </time>
                        <h4 className="text-sm font-bold text-[#2D2D2D]">{entry.title}</h4>
                      </div>
                      <ul className="list-disc pl-5 space-y-1 text-[#2D2D2D]">
                        {entry.highlights.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              )}

              {activeTab.id === 'feedback' && (
                <div className="space-y-3 rounded-xl border border-[#E9E7D4] bg-white p-3.5">
                  <p className="text-[#2D2D2D]">
                    若有建議、提問或功能許願，歡迎到 GitHub Discussions 留言。
                  </p>
                  <a
                    href="https://github.com/HXuanHui/labor-law-roster-sim/discussions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5A5A40] hover:bg-[#484833] text-white text-sm font-bold transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    前往 GitHub Discussions
                  </a>
                </div>
              )}

              {activeTab.id === 'support' && (
                <div className="space-y-3 rounded-xl border border-[#D9A05B]/35 bg-[#D9A05B]/10 p-3.5">
                  <p className="text-[#5A4A30]">
                    如果這個工具對你有幫助，歡迎請我喝杯咖啡支持維護。
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>

        <div className="pt-3 border-t border-[#E9E7D4] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-sm rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
