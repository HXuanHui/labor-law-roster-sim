import React, { useMemo } from 'react';
import { Calendar, Check, X } from 'lucide-react';
import { Employee, NationalHoliday } from '../types';
import { formatTaiwanDate, getTaiwanWeekdayName } from '../utils/perpetualCalendar';
import { resolveSubstitutesFor } from '../utils/holidayMakeup';
import { parseISO } from 'date-fns';

/**
 * 畫面上可作為「調」來源的「國」班候選。
 */
export interface MakeupSourceCandidate {
  /** 「國」班所在日期。 */
  date: string;
  /** 顯示名稱（假日清單名稱或「國定假日班」）。 */
  label: string;
  /** 星期（0=日…6=六）。 */
  weekday: number;
  /** 若為六／日，預設替補配額。 */
  substitutesFor?: 'rest' | 'mandatory';
}

interface MakeupSourcePickerModalProps {
  /** 是否開啟。 */
  isOpen: boolean;
  /** 即將套用「調」的目標日期。 */
  targetDate: string;
  /** 候選來源（畫面上的國班日）。 */
  candidates: MakeupSourceCandidate[];
  /** 確認：選定來源「國」班日期。 */
  onConfirm: (sourceDate: string, substitutesFor: 'rest' | 'mandatory') => void;
  /** 取消。 */
  onCancel: () => void;
}

/**
 * 手動套用「調」時，從畫面上的「國」班選擇此補假所對應／代替的國定假日。
 */
export const MakeupSourcePickerModal: React.FC<MakeupSourcePickerModalProps> = ({
  isOpen,
  targetDate,
  candidates,
  onConfirm,
  onCancel,
}) => {
  const [selectedSource, setSelectedSource] = React.useState<string>('');
  /** 來源若為平日，需手動指定替休或替例。 */
  const [manualSub, setManualSub] = React.useState<'rest' | 'mandatory'>('rest');

  React.useEffect(() => {
    if (!isOpen) return;
    setSelectedSource(candidates[0]?.date ?? '');
    setManualSub('rest');
  }, [isOpen, candidates]);

  const selected = useMemo(
    () => candidates.find((c) => c.date === selectedSource),
    [candidates, selectedSource]
  );

  if (!isOpen) return null;

  /**
   * 確認選擇並回傳替補配額。
   */
  const handleConfirm = () => {
    if (!selectedSource) return;
    const sub =
      selected?.substitutesFor ??
      (selected && (selected.weekday === 0 || selected.weekday === 6)
        ? resolveSubstitutesFor(selected.weekday as 0 | 6)
        : manualSub);
    onConfirm(selectedSource, sub);
  };

  const needsManualSub =
    !!selected && selected.weekday !== 0 && selected.weekday !== 6;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white border border-[#E9E7D4] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85dvh] sm:max-h-[80vh] shadow-2xl flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-[#E9E7D4] shrink-0">
          <div className="flex items-start gap-2 min-w-0">
            <div className="p-2 bg-[#C46B4A]/15 text-[#C46B4A] rounded-xl border border-[#C46B4A]/25 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#2D2D2D] font-serif">指定「調」對應的國定假日</h3>
              <p className="text-sm text-[#8A8A70] mt-0.5">
                目標補假日{' '}
                <span className="font-mono font-bold text-[#D17A60]">{targetDate}</span>
                （{formatTaiwanDate(targetDate)}）— 請選擇畫面上哪個「國」班日被週末／例休排擠
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-[#8A8A70] hover:bg-[#E9E7D4] shrink-0"
            aria-label="取消"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {candidates.length === 0 ? (
            <p className="text-sm text-[#D17A60] p-3 bg-[#D17A60]/10 rounded-xl border border-[#D17A60]/20">
              畫面上目前沒有「國」班可供對應。請先將原國定假日那天設為「國」，再設定「調」。
            </p>
          ) : (
            candidates.map((c) => {
              const active = c.date === selectedSource;
              return (
                <button
                  key={c.date}
                  type="button"
                  onClick={() => setSelectedSource(c.date)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                    active
                      ? 'border-[#5A5A40] bg-[#5A5A40]/10 ring-1 ring-[#5A5A40]'
                      : 'border-[#E9E7D4] bg-[#F8F7EB] hover:border-[#5A5A40]/50'
                  }`}
                >
                  <div className="font-mono font-bold text-[#D17A60]">{c.date}</div>
                  <div className="text-[#2D2D2D] font-semibold mt-0.5 truncate">{c.label}</div>
                  <div className="text-xs text-[#8A8A70] mt-0.5">
                    {getTaiwanWeekdayName(c.date)}
                    {c.substitutesFor
                      ? ` · 將計入${c.substitutesFor === 'rest' ? '休息日' : '例假日'}`
                      : ' · 平日國假（需手動指定替休／例）'}
                  </div>
                </button>
              );
            })
          )}

          {needsManualSub && (
            <div className="rounded-xl border border-[#E9E7D4] bg-white p-3 space-y-2">
              <p className="text-sm font-semibold text-[#5A5A40]">此「國」班在平日，請指定「調」代替哪種假</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setManualSub('rest')}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border ${
                    manualSub === 'rest'
                      ? 'bg-[#94A381] text-white border-[#94A381]'
                      : 'border-[#D9D7C2] text-[#5A5A40]'
                  }`}
                >
                  代替休息日
                </button>
                <button
                  type="button"
                  onClick={() => setManualSub('mandatory')}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border ${
                    manualSub === 'mandatory'
                      ? 'bg-[#D17A60] text-white border-[#D17A60]'
                      : 'border-[#D9D7C2] text-[#5A5A40]'
                  }`}
                >
                  代替例假日
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-[#E9E7D4] flex gap-2 justify-end shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-sm font-semibold rounded-xl border border-[#D9D7C2] text-[#5A5A40]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedSource}
            className="px-3 py-2 text-sm font-semibold rounded-xl bg-[#5A5A40] hover:bg-[#484833] disabled:opacity-40 text-white flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" />
            確認套用調
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * 自同仁班表＋假日清單收集畫面上的「國」班日，供「調」對應挑選。
 * 含：班表已寫「國」、以及假日清單原日（畫面會顯示為國）。
 * @param emp 同仁
 * @param holidays 假日清單（取名稱）
 * @param preferDates 額外關注日期（目前選取等）
 * @returns 候選列表（週末優先）
 */
export function collectNationalShiftCandidates(
  emp: Employee | undefined,
  holidays: NationalHoliday[],
  preferDates: string[] = []
): MakeupSourceCandidate[] {
  if (!emp) return [];

  const dateSet = new Set<string>();

  // 班表明確寫入「國」
  Object.keys(emp.schedules).forEach((d) => {
    if (emp.schedules[d]?.shiftTypeId === 'shift_national_holiday') {
      dateSet.add(d);
    }
  });

  // 假日清單原日：畫面上應顯示為國（含尚未寫入班表者）
  holidays.forEach((h) => {
    if (h.kind === 'makeup') return;
    const written = emp.schedules[h.date]?.shiftTypeId;
    // 未寫入或其他非衝突班別時仍列為候選；若已改成工作班則不列
    if (
      !written ||
      written === 'shift_national_holiday' ||
      written === 'shift_empty'
    ) {
      dateSet.add(h.date);
    }
  });

  preferDates.forEach((d) => {
    if (emp.schedules[d]?.shiftTypeId === 'shift_national_holiday') {
      dateSet.add(d);
    }
  });

  const candidates: MakeupSourceCandidate[] = Array.from(dateSet).map((date) => {
    const weekday = parseISO(`${date}T12:00:00`).getDay();
    const holiday = holidays.find((h) => h.date === date && h.kind !== 'makeup');
    const substitutesFor =
      weekday === 0 || weekday === 6
        ? resolveSubstitutesFor(weekday as 0 | 6)
        : undefined;
    return {
      date,
      label: holiday?.name || '國定假日班（手動排班）',
      weekday,
      substitutesFor,
    };
  });

  // 週末國假優先列前，再按日期
  return candidates.sort((a, b) => {
    const aWeekend = a.weekday === 0 || a.weekday === 6 ? 0 : 1;
    const bWeekend = b.weekday === 0 || b.weekday === 6 ? 0 : 1;
    if (aWeekend !== bWeekend) return aWeekend - bWeekend;
    return a.date.localeCompare(b.date);
  });
}
