import React, { useState } from 'react';
import { BookOpen, X, ShieldCheck, Calendar, Layers, Users, Pin, ArrowRightLeft, CheckSquare, Trash2, HelpCircle } from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'law' | 'operate' | 'storage'>('law');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#E9E7D4] rounded-2xl max-w-3xl w-full p-6 shadow-xl text-[#2D2D2D] space-y-5 my-8 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E9E7D4] pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl border border-[#5A5A40]/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2D2D2D] font-serif">排班模擬系統 — 使用說明指南</h2>
              <p className="text-xs text-[#8A8A70]">變形工時排班原則、智慧卡位工具與操作快捷說明</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8A8A70] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#E9E7D4] space-x-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('law')}
            className={`px-4 py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'law'
                ? 'border-[#5A5A40] text-[#5A5A40] bg-[#F8F7EB]'
                : 'border-transparent text-[#8A8A70] hover:text-[#2D2D2D]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>1. 勞基法變形工時法條</span>
          </button>
          <button
            onClick={() => setActiveTab('operate')}
            className={`px-4 py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'operate'
                ? 'border-[#5A5A40] text-[#5A5A40] bg-[#F8F7EB]'
                : 'border-transparent text-[#8A8A70] hover:text-[#2D2D2D]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>2. 排班操作與快捷技巧</span>
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`px-4 py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'storage'
                ? 'border-[#5A5A40] text-[#5A5A40] bg-[#F8F7EB]'
                : 'border-transparent text-[#8A8A70] hover:text-[#2D2D2D]'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>3. 資料儲存與重置</span>
          </button>
        </div>

        {/* Tab 1: Labor Laws */}
        {activeTab === 'law' && (
          <div className="space-y-4 text-xs text-[#2D2D2D] leading-relaxed max-h-96 overflow-y-auto pr-1">
            <div className="bg-[#F8F7EB] p-4 rounded-xl border border-[#E9E7D4] space-y-2">
              <h3 className="font-bold text-[#5A5A40] text-sm flex items-center gap-2">
                <span className="bg-[#5A5A40] text-white px-2 py-0.5 rounded text-xs font-mono">第30條第2項</span>
                雙週變形工時制度 (14天週期)
              </h3>
              <p className="text-[#5A5A40]">
                <strong>適用產業：</strong>經勞動部指定之行業（如零售、餐飲、製造、服務業等）。<br />
                <strong>排班規範：</strong>每 2 週內例假日及休息日至少應有 4 日（其中例假日至少 2 日，休息日至少 2 日）。每 7 日內至少應有 1 日例假日。每日正常工時得調移分配至其他工作日，每日不得超過 10 小時。
              </p>
            </div>

            <div className="bg-[#F8F7EB] p-4 rounded-xl border border-[#E9E7D4] space-y-2">
              <h3 className="font-bold text-[#5A5A40] text-sm flex items-center gap-2">
                <span className="bg-[#5A5A40] text-white px-2 py-0.5 rounded text-xs font-mono">第30條之1</span>
                四週變形工時制度 (28天週期)
              </h3>
              <p className="text-[#5A5A40]">
                <strong>適用產業：</strong>醫療保健、餐飲業、加油站、觀光飯店、超商百貨等指定行業。<br />
                <strong>排班規範：</strong>每 4 週內例假日及休息日至少應有 8 日（其中例假日至少 4 日，休息日至少 4 日）。每 2 週內例假日至少應有 2 日。允許調移例假日，不受「不得連續工作超過 6 日」之限制（但仍須注意職安預防）。
              </p>
            </div>

            <div className="bg-[#F8F7EB] p-4 rounded-xl border border-[#E9E7D4] space-y-2">
              <h3 className="font-bold text-[#5A5A40] text-sm flex items-center gap-2">
                <span className="bg-[#5A5A40] text-white px-2 py-0.5 rounded text-xs font-mono">第30條第3項</span>
                八週變形工時制度 (56天週期)
              </h3>
              <p className="text-[#5A5A40]">
                <strong>適用產業：</strong>製造業、運輸業、客運等特定經勞動部指定行業。<br />
                <strong>排班規範：</strong>每 8 週內例假日及休息日至少應有 16 日（其中例假日至少 8 日，休息日至少 8 日）。每 2 週內例假日至少應有 2 日。
              </p>
            </div>

            <div className="bg-[#F8F7EB] p-4 rounded-xl border border-[#E9E7D4] space-y-2">
              <h3 className="font-bold text-[#5A5A40] text-sm flex items-center gap-2">
                <span className="bg-[#5A5A40] text-white px-2 py-0.5 rounded text-xs font-mono">第34條第2項</span>
                輪班間隔時間與連續工作限制
              </h3>
              <p className="text-[#5A5A40]">
                <strong>輪班間隔：</strong>工作班次更換時，至少應有連續 11 小時之休息時間。<br />
                <strong>國定假日：</strong>《勞基法》第 37 條規定之國定假日，採出勤給予雙倍薪或經同仁同意調移補休。
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Operation & Shortcuts */}
        {activeTab === 'operate' && (
          <div className="space-y-4 text-xs text-[#2D2D2D] leading-relaxed max-h-96 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#F8F7EB] p-3.5 rounded-xl border border-[#E9E7D4] space-y-1.5">
                <div className="font-bold text-[#5A5A40] flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-[#5A5A40]" />
                  <span>點選與批次劃班 (ESC 取消)</span>
                </div>
                <p className="text-[#8A8A70]">
                  點擊月曆格子可開啟班別選單。按住滑鼠可選擇多個日期，頂部會出現「批次套用工具列」，可一次將班別賦予多個日期。按 <kbd className="px-1 py-0.5 bg-black/10 rounded font-mono text-[10px]">ESC</kbd> 鍵可取消選取。
                </p>
              </div>

              <div className="bg-[#F8F7EB] p-3.5 rounded-xl border border-[#E9E7D4] space-y-1.5">
                <div className="font-bold text-[#5A5A40] flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4 text-[#5A5A40]" />
                  <span>方塊滑動平移 (Slide)</span>
                </div>
                <p className="text-[#8A8A70]">
                  將滑鼠懸停於班別方塊上時，可點擊方塊左兩側的 ◀ 或 ▶ 箭號，迅速將該班別向前或向後平移一日，方便快速微調排班。
                </p>
              </div>

              <div className="bg-[#F8F7EB] p-3.5 rounded-xl border border-[#E9E7D4] space-y-1.5">
                <div className="font-bold text-[#5A5A40] flex items-center gap-1.5">
                  <Pin className="w-4 h-4 text-[#5A5A40]" />
                  <span>📌 圖卡釘選鎖定 (Pin)</span>
                </div>
                <p className="text-[#8A8A70]">
                  點選班別方塊右上角的大頭針圖示，即可「釘選鎖定」該班別。經釘選鎖定的日期不會在批次修改或自動輔助校正時被意外覆蓋。
                </p>
              </div>

              <div className="bg-[#F8F7EB] p-3.5 rounded-xl border border-[#E9E7D4] space-y-1.5">
                <div className="font-bold text-[#5A5A40] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#4A7C59]" />
                  <span>即時診斷與自動輔助校正 (Snap)</span>
                </div>
                <p className="text-[#8A8A70]">
                  畫面下方勞檢診斷會即時監控連班天數、例休數與11小時間隔。如有違規，可點選診斷卡片旁的「自動輔助校正」，系統會自動卡位至近最合法日期。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Storage & Reset */}
        {activeTab === 'storage' && (
          <div className="space-y-4 text-xs text-[#2D2D2D] leading-relaxed max-h-96 overflow-y-auto pr-1">
            <div className="bg-[#F8F7EB] p-4 rounded-xl border border-[#E9E7D4] space-y-2">
              <h3 className="font-bold text-[#5A5A40] text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-[#5A5A40]" />
                離線儲存與資料安全
              </h3>
              <p className="text-[#5A5A40]">
                本系統採 100% 離線運作機制，您所設定的國定假日、自訂班別代碼、同仁名單與班表紀錄均安全儲存於您本地瀏覽器的 LocalStorage 中，不會上傳至任何雲端伺服器。
              </p>
            </div>

            <div className="bg-[#F8F7EB] p-4 rounded-xl border border-[#E9E7D4] space-y-2">
              <h3 className="font-bold text-[#D17A60] text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-[#D17A60]" />
                一鍵清除所有儲存資料 (Reset All Data)
              </h3>
              <p className="text-[#5A5A40]">
                頂部工具列右上角提供<strong>「一鍵清除所有儲存資料」</strong>按鈕。點選並確認後，將會完整清空本地瀏覽器儲存的所有紀錄（班別、假日、同仁與班表），並重新啟動「初始設定導引 Panel」。
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-[#E9E7D4] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            瞭解並關閉
          </button>
        </div>
      </div>
    </div>
  );
};
