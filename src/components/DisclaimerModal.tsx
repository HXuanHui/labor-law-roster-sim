import React from 'react';
import { AlertTriangle, Database, FileText, X } from 'lucide-react';

/**
 * 免責說明 Modal 屬性。
 */
interface DisclaimerModalProps {
  /** 是否顯示。 */
  isOpen: boolean;
  /** 關閉回呼。 */
  onClose: () => void;
}

/**
 * 免責說明：涵蓋模擬用途免責、使用者資料留存與本機留存方式。
 *
 * @param props.isOpen 是否顯示
 * @param props.onClose 關閉回呼
 */
export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-modal-title"
        className="bg-white border border-[#E9E7D4] rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-xl text-[#2D2D2D] space-y-4 my-6"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E9E7D4] pb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 bg-[#D9A05B]/15 text-[#5A4A30] rounded-xl border border-[#D9A05B]/35 flex-shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2
                id="disclaimer-modal-title"
                className="text-xl font-bold text-[#2D2D2D] font-serif"
              >
                免責說明
              </h2>
              <p className="text-sm text-[#8A8A70] mt-0.5">模擬用途、資料留存與使用風險提醒</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8A8A70] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] transition-colors cursor-pointer flex-shrink-0"
            aria-label="關閉免責說明"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-4 text-sm leading-relaxed">
          <section className="space-y-2 rounded-xl border border-[#D9A05B]/35 bg-[#D9A05B]/10 p-3.5">
            <h3 className="text-base font-bold text-[#5A4A30] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              一、免責說明
            </h3>
            <ul className="list-disc list-inside space-y-1.5 text-[#5A4A30]">
              <li>
                本網站（排班模擬系統）僅供排班規劃、教育訓練與內建規則之
                <strong className="font-bold">模擬提示</strong>
                ，非正式法律意見、律師諮詢或勞動檢查結論。
              </li>
              <li>
                檢核結果可能因行業適用範圍、勞資協議、事業單位特殊約定、主管機關函釋或法令修正而與實際適用情形不同。
              </li>
              <li>
                使用者應以現行法令、主管機關解釋、單位人事／工時制度及執業意見為最終依歸；因使用本網站所致之任何損害或爭議，開發者不負賠償或保證責任。
              </li>
            </ul>
          </section>

          <section className="space-y-2 rounded-xl border border-[#E9E7D4] bg-[#F8F7EB] p-3.5">
            <h3 className="text-base font-bold text-[#5A5A40] flex items-center gap-2">
              <Database className="w-5 h-5" />
              二、使用者資料留存說明
            </h3>
            <p className="text-[#2D2D2D]">
              為方便您重複開啟瀏覽器後延續編輯，本網站會在您的裝置上留存您主動建立或修改的資料，包含：
            </p>
            <ul className="list-disc list-inside space-y-1 text-[#5A5A40]">
              <li>同仁名單與其班表紀錄</li>
              <li>自訂班別設定</li>
              <li>國定假日／補假設定</li>
              <li>是否已完成初始設定導引之狀態標記</li>
            </ul>
            <p className="text-[#2D2D2D]">
              本網站<strong className="font-bold">不會</strong>
              將上述資料上傳至伺服器或雲端帳號；亦不會以本系統替您向任何機關申報出勤或加班。資料用途僅限於本機畫面顯示、模擬檢核與您主動操作之匯出／列印。
            </p>
          </section>

          <section className="space-y-2 rounded-xl border border-[#E9E7D4] bg-white p-3.5">
            <h3 className="text-base font-bold text-[#5A5A40] flex items-center gap-2">
              <FileText className="w-5 h-5" />
              三、資料留存方式說明
            </h3>
            <ul className="list-disc list-inside space-y-1.5 text-[#5A5A40]">
              <li>
                技術方式：使用瀏覽器
                <code className="mx-1 px-1.5 py-0.5 rounded bg-[#F8F7EB] border border-[#E9E7D4] text-xs">
                  localStorage
                </code>
                （本機鍵值儲存）持久化。
              </li>
              <li>
                主要鍵名：
                <code className="mx-1 px-1.5 py-0.5 rounded bg-[#F8F7EB] border border-[#E9E7D4] text-xs">
                  perpetual_employees
                </code>
                、
                <code className="mx-1 px-1.5 py-0.5 rounded bg-[#F8F7EB] border border-[#E9E7D4] text-xs">
                  perpetual_shifts
                </code>
                、
                <code className="mx-1 px-1.5 py-0.5 rounded bg-[#F8F7EB] border border-[#E9E7D4] text-xs">
                  perpetual_national_holidays
                </code>
                、
                <code className="mx-1 px-1.5 py-0.5 rounded bg-[#F8F7EB] border border-[#E9E7D4] text-xs">
                  perpetual_setup_completed
                </code>
                。
              </li>
              <li>
                存留期間：資料會一直保留在該瀏覽器設定檔中，直到您清除網站資料、更換瀏覽器／裝置，或點選系統「一鍵清除所有儲存資料」。
              </li>
              <li>
                清除方式：頂部工具列的清除按鈕可一次刪除上述本機資料並回到初始設定導引；或自行於瀏覽器設定中清除此網站的本機儲存。
              </li>
              <li>
                風險提醒：清除瀏覽器快取／網站資料、使用無痕模式結束，或不同裝置之間，皆無法自動同步或還原本機留存內容；重要班表請自行匯出備份。
              </li>
            </ul>
          </section>
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
