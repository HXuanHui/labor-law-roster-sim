import React from 'react';
import { CalendarPlus, Check, X } from 'lucide-react';
import { MakeupProposal } from '../utils/holidayMakeup';
import { formatTaiwanDate } from '../utils/perpetualCalendar';

interface HolidayMakeupConfirmBannerProps {
  /** 補假提案內容。 */
  proposal: MakeupProposal;
  /** 將寫入之補假名稱。 */
  makeupName: string;
  /** 使用者確認保留補假。 */
  onAccept: () => void;
  /** 使用者略過補假。 */
  onSkip: () => void;
}

/**
 * 國定假日逢六／日時，請使用者確認是否保留系統建議之補假日（班別「調」）。
 */
export const HolidayMakeupConfirmBanner: React.FC<HolidayMakeupConfirmBannerProps> = ({
  proposal,
  makeupName,
  onAccept,
  onSkip,
}) => {
  return (
    <div
      className="rounded-xl border border-[#D17A60]/40 bg-[#D17A60]/10 p-3 space-y-2"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <CalendarPlus className="w-4 h-4 text-[#D17A60] shrink-0 mt-0.5" />
        <div className="text-xs text-[#2D2D2D] space-y-1">
          <p className="font-semibold">
            此假日為{proposal.originalWeekdayLabel}，系統建議產生補假（班別「調」）
          </p>
          <p className="text-[#5A5A40]">
            建議補假日：
            <span className="font-mono font-bold text-[#D17A60] mx-1">
              {proposal.makeupDate}
            </span>
            （{formatTaiwanDate(proposal.makeupDate)} · {proposal.makeupWeekdayLabel}）
          </p>
          <p className="text-[#8A8A70]">
            名稱：{makeupName} · 審查計入{proposal.substitutesForLabel}（計薪視同國定假日）
          </p>
          {proposal.wasDeferred && (
            <p className="text-[#D17A60]">
              首選 {proposal.preferredMakeupDate} 已有假日，已自動遞延至 {proposal.makeupDate}。
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          onClick={onSkip}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D9D7C2] text-[#5A5A40] hover:bg-white transition-colors cursor-pointer flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" />
          略過補假
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#5A5A40] hover:bg-[#484833] text-white transition-colors cursor-pointer flex items-center gap-1"
        >
          <Check className="w-3.5 h-3.5" />
          保留補假
        </button>
      </div>
    </div>
  );
};
