import React, { useEffect, useMemo, useState } from 'react';
import { NationalHoliday } from '../types';
import { Sun, Plus, Trash2, X, RotateCcw } from 'lucide-react';
import { formatTaiwanDate } from '../utils/perpetualCalendar';
import {
  buildMakeupHolidayName,
  buildMakeupHolidayPayload,
  collectPendingMakeupProposals,
  findMakeupHolidaysForSource,
  hasHolidayOnDate,
  MakeupProposal,
  PendingMakeupItem,
  proposeMakeupDate,
} from '../utils/holidayMakeup';
import { HolidayMakeupConfirmBanner } from './HolidayMakeupConfirmBanner';
import { HolidayMakeupBatchConfirm } from './HolidayMakeupBatchConfirm';

interface NationalHolidaySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  holidays: NationalHoliday[];
  onAddHoliday: (holiday: Omit<NationalHoliday, 'id'>) => void;
  onDeleteHoliday: (id: string) => void;
  onResetHolidays: () => void;
  onClearAllHolidays?: () => void;
}

const STANDARD_HOLIDAY_SUGGESTIONS = [
  '元旦 (中華民國開國紀念日)',
  '農曆除夕',
  '春節 (初一)',
  '春節 (初二)',
  '春節 (初三)',
  '和平紀念日 (228)',
  '兒童節',
  '民族掃墓節 (清明節)',
  '勞動節 (5/1)',
  '端午節',
  '中秋節',
  '國慶日 (10/10)',
  '國定假日補假',
  '颱風假',
  '公司創立紀念日',
];

/** 待使用者確認之補假草稿（原日已寫入後等待確認）。 */
interface PendingMakeup {
  proposal: MakeupProposal;
  originalName: string;
  isStatutory: boolean;
}

/**
 * 國定假日與紀念日設定面板。
 * 新增假日若逢六／日，會建議補假並交由使用者確認是否保留。
 */
export const NationalHolidaySettingsModal: React.FC<NationalHolidaySettingsModalProps> = ({
  isOpen,
  onClose,
  holidays,
  onAddHoliday,
  onDeleteHoliday,
  onResetHolidays,
  onClearAllHolidays,
}) => {
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [isStatutory, setIsStatutory] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingMakeup, setPendingMakeup] = useState<PendingMakeup | null>(null);
  /** 使用者本次略過的批次補假原日。 */
  const [batchSkippedSources, setBatchSkippedSources] = useState<Set<string>>(() => new Set());

  // 開啟面板時重掃尚未建立之補假
  useEffect(() => {
    if (isOpen) {
      setBatchSkippedSources(new Set());
      setPendingMakeup(null);
    }
  }, [isOpen]);

  const pendingBatchAll = useMemo(
    () => collectPendingMakeupProposals(holidays),
    [holidays]
  );
  const pendingBatchVisible = useMemo(
    () => pendingBatchAll.filter((i) => !batchSkippedSources.has(i.originalDate)),
    [pendingBatchAll, batchSkippedSources]
  );

  /**
   * 批次確認保留勾選補假。
   * @param selected 勾選項目
   */
  const handleBatchConfirm = (selected: PendingMakeupItem[]) => {
    selected.forEach((item) => {
      onAddHoliday(buildMakeupHolidayPayload(item, item.originalName, item.isStatutory));
    });
    setBatchSkippedSources((prev) => {
      const next = new Set(prev);
      pendingBatchVisible.forEach((i) => next.add(i.originalDate));
      return next;
    });
  };

  /** 批次全部略過。 */
  const handleBatchSkipAll = () => {
    setBatchSkippedSources((prev) => {
      const next = new Set(prev);
      pendingBatchVisible.forEach((i) => next.add(i.originalDate));
      return next;
    });
  };

  if (!isOpen) return null;

  /**
   * 新增國定／自訂假日；若逢六／日則寫入原日後顯示補假確認列。
   */
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newName.trim()) {
      setErrorMsg('請完整輸入國定假日日期與名稱');
      return;
    }

    // 同一日期已有假日時拒絕重複新增原日
    if (hasHolidayOnDate(holidays, newDate)) {
      setErrorMsg(`日期 ${newDate} 已有假日紀錄，請先刪除或改選其他日期`);
      return;
    }

    const trimmedName = newName.trim();
    onAddHoliday({
      date: newDate,
      name: trimmedName,
      isStatutory,
      kind: 'original',
    });

    // 週末國定假日：依佔用日規劃補假（撞日自動往前／後遞延）
    const occupied = [...holidays.map((h) => h.date), newDate];
    const proposal = proposeMakeupDate(newDate, occupied);
    if (proposal) {
      setPendingMakeup({
        proposal,
        originalName: trimmedName,
        isStatutory,
      });
    } else {
      setPendingMakeup(null);
    }

    setNewDate('');
    setNewName('');
    setErrorMsg('');
  };

  /** 使用者確認保留補假：寫入補假列（含替休／例紀錄）。 */
  const handleAcceptMakeup = () => {
    if (!pendingMakeup) return;
    const { proposal, originalName, isStatutory: statutory } = pendingMakeup;
    const occupied = holidays.map((h) => h.date);
    const fresh = proposeMakeupDate(proposal.originalDate, occupied) ?? proposal;
    if (!hasHolidayOnDate(holidays, fresh.makeupDate)) {
      onAddHoliday(buildMakeupHolidayPayload(fresh, originalName, statutory));
    }
    setPendingMakeup(null);
  };

  /** 使用者略過補假。 */
  const handleSkipMakeup = () => {
    setPendingMakeup(null);
  };

  /**
   * 刪除假日；若為原日且有關聯補假，詢問是否一併刪除。
   * @param holiday 欲刪除之假日
   */
  const handleDelete = (holiday: NationalHoliday) => {
    // 補假本身直接刪除，不追溯原日
    if (holiday.kind === 'makeup') {
      onDeleteHoliday(holiday.id);
      // 若刪除的補假正是待確認之外的項目，不影響 pending；清除同源 pending 即可
      if (pendingMakeup?.proposal.originalDate === holiday.sourceDate) {
        setPendingMakeup(null);
      }
      return;
    }

    const linked = findMakeupHolidaysForSource(holidays, holiday.date);
    if (linked.length > 0) {
      const ok = window.confirm(
        `「${holiday.name}」另有 ${linked.length} 筆關聯補假。\n是否一併刪除補假？\n\n按「確定」＝原日與補假皆刪；按「取消」＝僅刪原日、保留補假。`
      );
      if (ok) {
        linked.forEach((m) => onDeleteHoliday(m.id));
      }
    }
    onDeleteHoliday(holiday.id);

    // 刪除原日後取消對應的補假確認草稿
    if (pendingMakeup?.proposal.originalDate === holiday.date) {
      setPendingMakeup(null);
    }
  };

  // Sort holidays by date
  const sortedHolidays = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  // Build unique holiday name suggestions (combining standard statutory names and currently saved holiday names)
  const existingNames = holidays.map((h) => h.name).filter(Boolean);
  const holidayNameOptions = Array.from(new Set([...STANDARD_HOLIDAY_SUGGESTIONS, ...existingNames]));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-4 overflow-hidden">
      <div className="bg-white border-0 sm:border border-[#E9E7D4] rounded-none sm:rounded-2xl w-full sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[min(92dvh,860px)] shadow-xl text-[#2D2D2D] animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E9E7D4] pb-3 pt-4 px-4 sm:px-6 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 bg-[#D17A60]/15 text-[#D17A60] rounded-xl border border-[#D17A60]/30 shrink-0">
              <Sun className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[#2D2D2D] font-serif truncate">國定假日與紀念日設定</h2>
              <p className="text-[11px] sm:text-xs text-[#8A8A70] line-clamp-2">
                自行輸入或編輯國定假日與公司自訂放假日（對照勞基法第39條出勤給薪）
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8A8A70] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-4 sm:space-y-5">
        {/* 既有週末國假尚未建立補假時批次確認（重置預設後也會出現） */}
        {pendingBatchVisible.length > 0 && (
          <HolidayMakeupBatchConfirm
            items={pendingBatchVisible}
            onConfirm={handleBatchConfirm}
            onSkipAll={handleBatchSkipAll}
          />
        )}

        {/* Add New Holiday Form */}
        <form onSubmit={handleAdd} className="bg-[#F8F7EB] p-3 sm:p-4 rounded-xl border border-[#E9E7D4] space-y-3">
          <div className="text-xs font-bold text-[#5A5A40] uppercase tracking-wider flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" />
            <span>新增自訂/國定假日</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[#8A8A70] mb-1">選擇日期</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-xs text-[#2D2D2D] font-mono outline-none focus:ring-2 focus:ring-[#5A5A40]"
              />
            </div>

            <div>
              <label className="block text-xs text-[#8A8A70] mb-1">假日名稱 (下拉選擇或自行輸入)</label>
              <input
                type="text"
                list="holiday-name-suggestions"
                placeholder="選擇或輸入假日名稱"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-xs text-[#2D2D2D] outline-none focus:ring-2 focus:ring-[#5A5A40]"
              />
              <datalist id="holiday-name-suggestions">
                {holidayNameOptions.map((name, idx) => (
                  <option key={idx} value={name} />
                ))}
              </datalist>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>新增假日</span>
              </button>
            </div>
          </div>

          {errorMsg && <p className="text-xs text-[#D17A60]">{errorMsg}</p>}

          {/* 週末補假確認列 */}
          {pendingMakeup && (
            <HolidayMakeupConfirmBanner
              proposal={pendingMakeup.proposal}
              makeupName={buildMakeupHolidayName(pendingMakeup.originalName)}
              onAccept={handleAcceptMakeup}
              onSkip={handleSkipMakeup}
            />
          )}
        </form>

        {/* Current Holidays List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#8A8A70]">
            <span>現行國定與自訂假日清單 ({sortedHolidays.length})</span>
            <div className="flex items-center space-x-3">
              {onClearAllHolidays && sortedHolidays.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('確定要全部刪除所有已存國定與自訂假日嗎？')) {
                      onClearAllHolidays();
                      setPendingMakeup(null);
                      setBatchSkippedSources(new Set());
                    }
                  }}
                  className="text-[#D17A60] hover:text-[#a84d34] flex items-center gap-1 text-[11px] hover:underline cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>全部刪除</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onResetHolidays();
                  setPendingMakeup(null);
                  setBatchSkippedSources(new Set());
                }}
                className="text-[#8A8A70] hover:text-[#2D2D2D] flex items-center gap-1 text-[11px] hover:underline cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>重置為法定預設值</span>
              </button>
            </div>
          </div>

          <div className="max-h-[40vh] sm:max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {sortedHolidays.map((h) => (
              <div
                key={h.id}
                className="bg-[#F8F7EB] border border-[#E9E7D4] p-2.5 rounded-xl flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-3">
                  <span className="font-mono font-bold text-[#D17A60] px-2 py-0.5 bg-[#D17A60]/10 rounded border border-[#D17A60]/20">
                    {h.date}
                  </span>
                  <div>
                    <div className="font-semibold text-[#2D2D2D] flex items-center gap-1.5 flex-wrap">
                      <span>{h.name}</span>
                      {h.kind === 'makeup' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#C46B4A]/15 text-[#C46B4A] border border-[#C46B4A]/25">
                          調
                          {h.substitutesFor === 'rest'
                            ? '·替休'
                            : h.substitutesFor === 'mandatory'
                              ? '·替例'
                              : ''}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#8A8A70]">
                      {formatTaiwanDate(h.date)} · {h.isStatutory ? '法定國定假日' : '自訂公司假日'}
                      {h.kind === 'makeup' && h.sourceDate
                        ? ` · 對應原日 ${h.sourceDate}`
                        : ''}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(h)}
                  className="p-1.5 text-[#8A8A70] hover:text-[#D17A60] hover:bg-[#D17A60]/10 rounded-lg transition-colors"
                  title="刪除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        </div>

        {/* Modal Footer */}
        <div className="shrink-0 border-t border-[#E9E7D4] px-4 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-end bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#5A5A40] hover:bg-[#484833] text-white font-semibold text-xs rounded-xl transition-colors shadow-sm"
          >
            完成儲存
          </button>
        </div>
      </div>
    </div>
  );
};
