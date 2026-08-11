import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * 刪除國定假日／補假確認 Modal 的顯示明細。
 */
export interface HolidayDeleteConfirmDetails {
  /** 將刪除的國定假日原日（YYYY-MM-DD）。 */
  originalDates: string[];
  /** 將刪除的補假（調）日（使用者直接選中）。 */
  makeupDates: string[];
  /** 因刪原日而一併刪除的補假日。 */
  cascadeMakeupDates: string[];
  /** 確認後改成的班別顯示名稱。 */
  nextShiftLabel: string;
}

/**
 * Modal 屬性。
 */
interface DeleteNationalHolidayConfirmModalProps {
  /** 是否顯示。 */
  isOpen: boolean;
  /** 刪除明細；關閉時可為 null。 */
  details: HolidayDeleteConfirmDetails | null;
  /** 確認刪除並改班。 */
  onConfirm: () => void;
  /** 取消，不變更班表與假日。 */
  onCancel: () => void;
}

/**
 * 意圖把「國／調」改成其他班別時的確認 Modal。
 * 刪原日時會說明關聯補假（調）一併刪除，並提醒紅色標註將消失。
 */
export const DeleteNationalHolidayConfirmModal: React.FC<
  DeleteNationalHolidayConfirmModalProps
> = ({ isOpen, details, onConfirm, onCancel }) => {
  if (!isOpen || !details) return null;

  const { originalDates, makeupDates, cascadeMakeupDates, nextShiftLabel } = details;
  const hasOriginal = originalDates.length > 0;
  const hasMakeup = makeupDates.length > 0 || cascadeMakeupDates.length > 0;

  const title =
    hasOriginal && hasMakeup
      ? '刪除國定假日與補班？'
      : hasOriginal
        ? '刪除此國定假日？'
        : '刪除此國定假日補班？';

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-national-holiday-title"
        className="bg-white border border-[#E9E7D4] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-[#E9E7D4]">
          <div className="flex items-start gap-2 min-w-0">
            <div className="p-2 bg-[#D17A60]/15 text-[#D17A60] rounded-xl border border-[#D17A60]/25 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3
                id="delete-national-holiday-title"
                className="text-base font-bold text-[#2D2D2D] font-serif"
              >
                {title}
              </h3>
              <p className="text-sm text-[#8A8A70] mt-0.5">
                確認後將刪除假日紀錄、移除紅色標註，並改為「{nextShiftLabel}」。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-[#8A8A70] hover:bg-[#E9E7D4] shrink-0 cursor-pointer"
            aria-label="取消"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-sm text-[#2D2D2D] max-h-[50dvh] overflow-y-auto">
          {originalDates.length > 0 && (
            <div className="rounded-xl border border-[#E9E7D4] bg-[#FAF9F5] p-3">
              <p className="font-bold text-[#C46B4A] mb-1">將刪除的國定假日</p>
              <ul className="list-disc pl-5 space-y-0.5 font-mono text-[#5A5A40]">
                {originalDates.map((d) => (
                  <li key={`orig-${d}`}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {cascadeMakeupDates.length > 0 && (
            <div className="rounded-xl border border-[#E9E7D4] bg-[#FAF9F5] p-3">
              <p className="font-bold text-[#C46B4A] mb-1">將一併刪除的關聯補假（調）</p>
              <ul className="list-disc pl-5 space-y-0.5 font-mono text-[#5A5A40]">
                {cascadeMakeupDates.map((d) => (
                  <li key={`cascade-${d}`}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {makeupDates.length > 0 && (
            <div className="rounded-xl border border-[#E9E7D4] bg-[#FAF9F5] p-3">
              <p className="font-bold text-[#C46B4A] mb-1">將刪除的國定假日補班（調）</p>
              <ul className="list-disc pl-5 space-y-0.5 font-mono text-[#5A5A40]">
                {makeupDates.map((d) => (
                  <li key={`mk-${d}`}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[#8A8A70] leading-relaxed">
            刪除後格子將不再顯示紅色的國定假日提醒（例如「國定假日（手動排班）」）。
          </p>
        </div>

        <div className="flex gap-2 p-4 border-t border-[#E9E7D4] bg-[#FAF9F5] rounded-b-2xl">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#E9E7D4] bg-white text-[#5A5A40] font-bold hover:bg-[#E9E7D4]/40 transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#D17A60] text-white font-bold hover:bg-[#C46B4A] transition-colors cursor-pointer shadow-sm"
          >
            確認刪除並改班
          </button>
        </div>
      </div>
    </div>
  );
};
