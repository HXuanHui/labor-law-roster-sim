import React, { useEffect, useState } from 'react';
import { CalendarPlus, Check, X } from 'lucide-react';
import { PendingMakeupItem } from '../utils/holidayMakeup';
import { formatTaiwanDate } from '../utils/perpetualCalendar';

interface HolidayMakeupBatchConfirmProps {
  /** 待確認之補假提案清單。 */
  items: PendingMakeupItem[];
  /**
   * 確認保留勾選項目。
   * @param selected 使用者勾選項目
   */
  onConfirm: (selected: PendingMakeupItem[]) => void;
  /** 全部略過本次補假建議。 */
  onSkipAll: () => void;
}

/**
 * 初始化／重置國定假日時，批次列出建議補假（含撞日遞延結果）供一次確認。
 */
export const HolidayMakeupBatchConfirm: React.FC<HolidayMakeupBatchConfirmProps> = ({
  items,
  onConfirm,
  onSkipAll,
}) => {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    // 預設全選
    setSelectedKeys(new Set(items.map((i) => i.originalDate)));
  }, [items]);

  if (items.length === 0) return null;

  /**
   * 切換單一提案勾選。
   * @param originalDate 原假日日期鍵
   */
  const toggle = (originalDate: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(originalDate)) next.delete(originalDate);
      else next.add(originalDate);
      return next;
    });
  };

  /** 送出勾選項。 */
  const handleConfirm = () => {
    onConfirm(items.filter((i) => selectedKeys.has(i.originalDate)));
  };

  return (
    <div
      className="rounded-xl border border-[#D17A60]/40 bg-[#D17A60]/10 p-3 space-y-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <CalendarPlus className="w-4 h-4 text-[#D17A60] shrink-0 mt-0.5" />
        <div className="text-sm text-[#2D2D2D] space-y-1">
          <p className="font-semibold">
            偵測到 {items.length} 筆國定假日逢六／日，請確認是否排入補假（班別「調」）
          </p>
          <p className="text-[#8A8A70]">
            六→往前、日→往後；若候選日已有假日則自動遞延。審查時計入被佔用的休／例；計薪視同國定假日。
          </p>
        </div>
      </div>

      <ul className="max-h-[30vh] sm:max-h-48 overflow-y-auto space-y-1.5 pr-1">
        {items.map((item) => {
          const checked = selectedKeys.has(item.originalDate);
          return (
            <li
              key={item.originalDate}
              className="flex items-start gap-2 bg-white/70 border border-[#E9E7D4] rounded-lg px-2.5 py-2 text-sm"
            >
              <input
                type="checkbox"
                className="mt-0.5 accent-[#5A5A40] cursor-pointer"
                checked={checked}
                onChange={() => toggle(item.originalDate)}
                aria-label={`保留 ${item.originalName} 之補假`}
              />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[#2D2D2D] truncate">
                  {item.originalName}
                  <span className="font-mono font-normal text-[#8A8A70] ml-1">
                    {item.originalDate}
                  </span>
                  <span className="text-[#8A8A70] font-normal">
                    （{item.originalWeekdayLabel}）
                  </span>
                </div>
                <div className="text-[#5A5A40] mt-0.5">
                  → 補假{' '}
                  <span className="font-mono font-bold text-[#D17A60]">
                    {item.makeupDate}
                  </span>{' '}
                  {formatTaiwanDate(item.makeupDate)} · 班別「調」· 審查計入
                  {item.substitutesForLabel}
                </div>
                {item.wasDeferred && (
                  <div className="text-[#D17A60] mt-0.5">
                    已自 {item.preferredMakeupDate} 遞延（該日或其他假日衝突）
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          onClick={onSkipAll}
          className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-[#D9D7C2] text-[#5A5A40] hover:bg-white transition-colors cursor-pointer flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" />
          全部略過
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-[#5A5A40] hover:bg-[#484833] text-white transition-colors cursor-pointer flex items-center gap-1"
        >
          <Check className="w-3.5 h-3.5" />
          確認保留勾選項（{selectedKeys.size}）
        </button>
      </div>
    </div>
  );
};
