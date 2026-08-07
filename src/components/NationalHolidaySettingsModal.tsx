import React, { useState } from 'react';
import { NationalHoliday } from '../types';
import { Sun, Plus, Trash2, X, RotateCcw, Check, Calendar } from 'lucide-react';
import { formatTaiwanDate } from '../utils/perpetualCalendar';

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

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newName.trim()) {
      setErrorMsg('請完整輸入國定假日日期與名稱');
      return;
    }

    onAddHoliday({
      date: newDate,
      name: newName.trim(),
      isStatutory,
    });

    setNewDate('');
    setNewName('');
    setErrorMsg('');
  };

  // Sort holidays by date
  const sortedHolidays = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  // Build unique holiday name suggestions (combining standard statutory names and currently saved holiday names)
  const existingNames = holidays.map((h) => h.name).filter(Boolean);
  const holidayNameOptions = Array.from(new Set([...STANDARD_HOLIDAY_SUGGESTIONS, ...existingNames]));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#E9E7D4] rounded-2xl max-w-2xl w-full p-6 shadow-xl text-[#2D2D2D] animate-in zoom-in-95 duration-200 space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E9E7D4] pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#D17A60]/15 text-[#D17A60] rounded-xl border border-[#D17A60]/30">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2D2D2D] font-serif">國定假日與紀念日設定</h2>
              <p className="text-xs text-[#8A8A70]">
                自行輸入或編輯國定假日與公司自訂放假日（對照勞基法第39條出勤給薪）
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8A8A70] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add New Holiday Form */}
        <form onSubmit={handleAdd} className="bg-[#F8F7EB] p-4 rounded-xl border border-[#E9E7D4] space-y-3">
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
                onClick={onResetHolidays}
                className="text-[#8A8A70] hover:text-[#2D2D2D] flex items-center gap-1 text-[11px] hover:underline cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>重置為法定預設值</span>
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
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
                    <div className="font-semibold text-[#2D2D2D]">{h.name}</div>
                    <div className="text-[10px] text-[#8A8A70]">
                      {formatTaiwanDate(h.date)} · {h.isStatutory ? '法定國定假日' : '自訂公司假日'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onDeleteHoliday(h.id)}
                  className="p-1.5 text-[#8A8A70] hover:text-[#D17A60] hover:bg-[#D17A60]/10 rounded-lg transition-colors"
                  title="刪除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-[#E9E7D4] pt-3 flex justify-end">
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
