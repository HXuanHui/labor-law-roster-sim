import React, { useEffect, useMemo, useState } from 'react';
import { NationalHoliday, ShiftType, Employee, ScheduleSystemType } from '../types';
import { Sun, Layers, Users, CheckCircle, ArrowRight, ArrowLeft, Plus, Trash2, X, Sparkles, RotateCcw, Edit2, Check, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { SYSTEM_CONFIGS } from '../constants/systems';
import { getContrastingTextColor } from '../utils/colorContrast';
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
import { SYSTEM_PROTECTED_SHIFT_IDS } from '../constants/shifts';

/** 待使用者確認之補假草稿。 */
interface PendingMakeup {
  proposal: MakeupProposal;
  originalName: string;
  isStatutory: boolean;
}

interface SetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  nationalHolidays: NationalHoliday[];
  onAddHoliday: (holiday: Omit<NationalHoliday, 'id'>) => void;
  onDeleteHoliday: (id: string) => void;
  onResetHolidays: () => void;
  onClearAllHolidays: () => void;
  shiftTypes: ShiftType[];
  onAddShiftType: (st: Omit<ShiftType, 'id'> | ShiftType) => void;
  onUpdateShiftType?: (st: ShiftType) => void;
  onDeleteShiftType: (id: string) => void;
  onResetShiftTypes: () => void;
  employees: Employee[];
  onAddEmployee: (name: string, role: string, system: ScheduleSystemType, cycleStartDate: string) => void;
  onDeleteEmployee: (id: string) => void;
  onCompleteSetup: () => void;
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

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({
  isOpen,
  onClose,
  nationalHolidays,
  onAddHoliday,
  onDeleteHoliday,
  onResetHolidays,
  onClearAllHolidays,
  shiftTypes,
  onAddShiftType,
  onUpdateShiftType,
  onDeleteShiftType,
  onResetShiftTypes,
  employees,
  onAddEmployee,
  onDeleteEmployee,
  onCompleteSetup,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Form states for Step 1: Holiday
  const [hDate, setHDate] = useState('');
  const [hName, setHName] = useState('');
  const [hError, setHError] = useState('');
  const [pendingMakeup, setPendingMakeup] = useState<PendingMakeup | null>(null);
  /** 使用者本次「全部略過」的原日，避免初始化批次提示反覆彈出。 */
  const [batchSkippedSources, setBatchSkippedSources] = useState<Set<string>>(() => new Set());

  // 每次開啟導引面板：重新掃描尚未建立之補假（清除上次略過狀態）
  useEffect(() => {
    if (isOpen) {
      setBatchSkippedSources(new Set());
      setPendingMakeup(null);
    }
  }, [isOpen]);

  // 初始化／既有清單中尚缺補假的週末國假 → 批次確認
  const pendingBatchAll = useMemo(
    () => collectPendingMakeupProposals(nationalHolidays),
    [nationalHolidays]
  );
  const pendingBatchVisible = useMemo(
    () => pendingBatchAll.filter((i) => !batchSkippedSources.has(i.originalDate)),
    [pendingBatchAll, batchSkippedSources]
  );

  /**
   * 批次確認保留勾選之補假（寫入後由 App 自動排「調」班）。
   * @param selected 勾選項目
   */
  const handleBatchConfirm = (selected: PendingMakeupItem[]) => {
    selected.forEach((item) => {
      onAddHoliday(buildMakeupHolidayPayload(item, item.originalName, item.isStatutory));
    });
    // 未勾選者視為本次略過，避免殘留提示
    setBatchSkippedSources((prev) => {
      const next = new Set(prev);
      pendingBatchVisible.forEach((i) => next.add(i.originalDate));
      return next;
    });
  };

  /** 批次全部略過補假建議。 */
  const handleBatchSkipAll = () => {
    setBatchSkippedSources((prev) => {
      const next = new Set(prev);
      pendingBatchVisible.forEach((i) => next.add(i.originalDate));
      return next;
    });
  };
  // Form states for Step 2: Shift
  const [sName, setSName] = useState('');
  const [sCode, setSCode] = useState('');
  const [sStart, setSStart] = useState('09:00');
  const [sEnd, setSEnd] = useState('18:00');
  const [sBreak, setSBreak] = useState('1');
  const [sHours, setSHours] = useState('8');
  const [sColor, setSColor] = useState('#5A5A40');
  const [sCategory, setSCategory] = useState<'work' | 'rest' | 'mandatory' | 'national_holiday'>('work');

  // Editing state for Step 2
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [editShiftForm, setEditShiftForm] = useState<Partial<ShiftType>>({});

  const calculateHours = (sTime: string, eTime: string, bHours: number) => {
    if (!sTime || !eTime) return 8;
    const [h1, m1] = sTime.split(':').map(Number);
    const [h2, m2] = eTime.split(':').map(Number);
    let totalMins = h2 * 60 + m2 - (h1 * 60 + m1);
    if (totalMins <= 0) totalMins += 24 * 60; // Overnight shift
    const grossHours = totalMins / 60;
    const netHours = Math.max(0, grossHours - bHours);
    return Math.round(netHours * 10) / 10;
  };

  const handleStartChange = (val: string) => {
    setSStart(val);
    if (sCategory === 'work') {
      const h = calculateHours(val, sEnd, Number(sBreak));
      setSHours(String(h));
    }
  };

  const handleEndChange = (val: string) => {
    setSEnd(val);
    if (sCategory === 'work') {
      const h = calculateHours(sStart, val, Number(sBreak));
      setSHours(String(h));
    }
  };

  // Form states for Step 3: Employee
  const defaultDate = format(new Date(), 'yyyy-MM-01');
  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState('專任人員');
  const [empSystem, setEmpSystem] = useState<ScheduleSystemType>('2-week');
  const [empCycleStart, setEmpCycleStart] = useState(defaultDate);

  if (!isOpen) return null;

  /**
   * 新增假日；若逢六／日則寫入原日後顯示補假確認列。
   */
  const handleAddHolidaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hDate) {
      setHError('請選擇假日日期');
      return;
    }
    if (hasHolidayOnDate(nationalHolidays, hDate)) {
      setHError(`日期 ${hDate} 已有假日紀錄，請先刪除或改選其他日期`);
      return;
    }

    const trimmedName = hName.trim() || '自訂假日';
    // 導引面板新增者視為自訂假日；法定預設改由「恢復預設」載入
    onAddHoliday({
      date: hDate,
      name: trimmedName,
      isStatutory: false,
      kind: 'original',
    });

    // 佔用＝既有假日＋剛新增原日；六／日則規劃補假（撞日自動遞延）
    const occupied = [...nationalHolidays.map((h) => h.date), hDate];
    const proposal = proposeMakeupDate(hDate, occupied);
    if (proposal) {
      setPendingMakeup({
        proposal,
        originalName: trimmedName,
        isStatutory: false,
      });
    } else {
      setPendingMakeup(null);
    }

    setHDate('');
    setHName('');
    setHError('');
  };

  /** 確認保留補假（含 substitutesFor，供審查替休／例）。 */
  const handleAcceptMakeup = () => {
    if (!pendingMakeup) return;
    const { proposal, originalName, isStatutory } = pendingMakeup;
    // 若期間清單又變了，依最新佔用再算一次遞延
    const occupied = nationalHolidays.map((h) => h.date);
    const fresh =
      proposeMakeupDate(proposal.originalDate, occupied) ?? proposal;
    if (!hasHolidayOnDate(nationalHolidays, fresh.makeupDate)) {
      onAddHoliday(buildMakeupHolidayPayload(fresh, originalName, isStatutory));
    }
    setPendingMakeup(null);
  };

  /** 略過補假。 */
  const handleSkipMakeup = () => {
    setPendingMakeup(null);
  };

  /**
   * 完成設定：若尚有未確認補假建議，警告並帶回步驟 1。
   */
  const handleCompleteSetup = () => {
    if (pendingBatchVisible.length > 0) {
      window.alert(
        `尚有 ${pendingBatchVisible.length} 筆國定假日補假建議未確認。\n請先於上方清單勾選「確認保留」或「全部略過」後再完成設定。`
      );
      setCurrentStep(1);
      return;
    }
    onCompleteSetup();
  };

  /**
   * 刪除假日；原日若有關聯補假則詢問是否一併刪除。
   * @param holiday 欲刪除之假日
   */
  const handleDeleteHoliday = (holiday: NationalHoliday) => {
    if (holiday.kind === 'makeup') {
      onDeleteHoliday(holiday.id);
      if (pendingMakeup?.proposal.originalDate === holiday.sourceDate) {
        setPendingMakeup(null);
      }
      return;
    }

    const linked = findMakeupHolidaysForSource(nationalHolidays, holiday.date);
    if (linked.length > 0) {
      const ok = window.confirm(
        `「${holiday.name}」另有 ${linked.length} 筆關聯補假。\n是否一併刪除補假？\n\n按「確定」＝原日與補假皆刪；按「取消」＝僅刪原日、保留補假。`
      );
      if (ok) {
        linked.forEach((m) => onDeleteHoliday(m.id));
      }
    }
    onDeleteHoliday(holiday.id);

    if (pendingMakeup?.proposal.originalDate === holiday.date) {
      setPendingMakeup(null);
    }
  };

  const handleAddShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sName.trim() || !sCode.trim()) return;
    onAddShiftType({
      id: `shift_custom_${Date.now()}`,
      name: sName.trim(),
      code: sCode.trim().toUpperCase(),
      startTime: sStart,
      endTime: sEnd,
      breakHours: Number(sBreak) || 1,
      workHours: sCategory === 'work' ? Number(sHours) || 8 : 0,
      color: sColor,
      // 依背景亮度寫入深／淺字色
      textColor: getContrastingTextColor(sColor),
      category: sCategory,
    });
    setSName('');
    setSCode('');
  };

  const handleStartEditShift = (st: ShiftType) => {
    setEditingShiftId(st.id);
    setEditShiftForm({ ...st });
  };

  const handleSaveEditShift = () => {
    if (!editingShiftId || !editShiftForm.code || !editShiftForm.name) return;
    if (onUpdateShiftType) {
      const nextColor = editShiftForm.color || '#5A5A40';
      // 儲存時重算對比字色，避免舊 textColor 與新背景不符
      onUpdateShiftType({
        ...(editShiftForm as ShiftType),
        color: nextColor,
        textColor: getContrastingTextColor(nextColor),
      });
    }
    setEditingShiftId(null);
    setEditShiftForm({});
  };

  const handleAddEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim()) return;
    onAddEmployee(empName.trim(), empRole, empSystem, empCycleStart || defaultDate);
    setEmpName('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-4 overflow-hidden">
      <div className="bg-white border-0 sm:border border-[#E9E7D4] rounded-none sm:rounded-2xl w-full sm:max-w-3xl h-[100dvh] sm:h-auto sm:max-h-[min(92dvh,900px)] shadow-2xl text-[#2D2D2D] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E9E7D4] pb-3 pt-4 px-4 sm:px-6 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 bg-[#5A5A40] text-white rounded-xl shadow-sm shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-[#2D2D2D] font-serif truncate">事業單位排班初始導引 Panel</h2>
              <p className="text-sm text-[#8A8A70] line-clamp-2">請透過 3 個簡單步驟完成基本設定（假日、班別代碼與同仁名單）</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8A8A70] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-4 sm:space-y-6">
        {/* 任何步驟皆顯示：初始化必檢補假（避免只在步驟1才看得到） */}
        {pendingBatchVisible.length > 0 && (
          <HolidayMakeupBatchConfirm
            items={pendingBatchVisible}
            onConfirm={handleBatchConfirm}
            onSkipAll={handleBatchSkipAll}
          />
        )}

        {/* Step Indicator Bar */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 bg-[#F8F7EB] p-1.5 sm:p-2 rounded-xl border border-[#E9E7D4] text-xs sm:text-sm font-bold">
          <button
            onClick={() => setCurrentStep(1)}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all cursor-pointer ${
              currentStep === 1
                ? 'bg-[#5A5A40] text-white shadow-sm'
                : 'text-[#8A8A70] hover:bg-white hover:text-[#2D2D2D]'
            }`}
          >
            <Sun className="w-4 h-4 shrink-0" />
            <span className="truncate"><span className="sm:hidden">1. 假日</span><span className="hidden sm:inline">1. 國定與自訂假日</span></span>
          </button>
          <button
            onClick={() => setCurrentStep(2)}
            className={`flex items-center justify-center gap-1 sm:gap-2 py-2 px-1.5 sm:px-3 rounded-lg transition-all cursor-pointer ${
              currentStep === 2
                ? 'bg-[#5A5A40] text-white shadow-sm'
                : 'text-[#8A8A70] hover:bg-white hover:text-[#2D2D2D]'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span className="truncate"><span className="sm:hidden">2. 班別</span><span className="hidden sm:inline">2. 班別代碼與工時</span></span>
          </button>
          <button
            onClick={() => setCurrentStep(3)}
            className={`flex items-center justify-center gap-1 sm:gap-2 py-2 px-1.5 sm:px-3 rounded-lg transition-all cursor-pointer ${
              currentStep === 3
                ? 'bg-[#5A5A40] text-white shadow-sm'
                : 'text-[#8A8A70] hover:bg-white hover:text-[#2D2D2D]'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="truncate"><span className="sm:hidden">3. 同仁</span><span className="hidden sm:inline">3. 新增同仁名單</span></span>
          </button>
        </div>

        {/* STEP 1: Holidays */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="bg-[#F8F7EB] p-4 rounded-xl border border-[#E9E7D4] space-y-3">
              <div className="text-sm font-bold text-[#5A5A40] flex items-center justify-between">
                <span>步驟 1：檢視或自訂國定與特休假日</span>
                <span className="text-sm text-[#8A8A70] font-normal">現有假日：{nationalHolidays.length} 天</span>
              </div>

              <form onSubmit={handleAddHolidaySubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="date"
                  value={hDate}
                  onChange={(e) => setHDate(e.target.value)}
                  className="bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#5A5A40]"
                />
                <input
                  type="text"
                  list="setup-holiday-suggestions"
                  placeholder="選擇或輸入假日名稱"
                  value={hName}
                  onChange={(e) => setHName(e.target.value)}
                  className="bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#5A5A40]"
                />
                <datalist id="setup-holiday-suggestions">
                  {STANDARD_HOLIDAY_SUGGESTIONS.map((name, idx) => (
                    <option key={idx} value={name} />
                  ))}
                </datalist>
                <button
                  type="submit"
                  className="bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-sm rounded-xl py-2 px-3 flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>新增假日</span>
                </button>
              </form>

              {hError && <p className="text-sm text-[#D17A60]">{hError}</p>}

              {/* 週末補假確認列 */}
              {pendingMakeup && (
                <HolidayMakeupConfirmBanner
                  proposal={pendingMakeup.proposal}
                  makeupName={buildMakeupHolidayName(pendingMakeup.originalName)}
                  onAccept={handleAcceptMakeup}
                  onSkip={handleSkipMakeup}
                />
              )}
            </div>

            {/* Holiday List & Quick Actions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-bold text-[#8A8A70]">
                <span>已建置假日 ({nationalHolidays.length})</span>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllHolidays();
                      setPendingMakeup(null);
                      setBatchSkippedSources(new Set());
                    }}
                    className="text-[#D17A60] hover:underline flex items-center gap-1 text-sm cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>全部清空</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onResetHolidays();
                      setPendingMakeup(null);
                      // 重置後重新掃描補假建議
                      setBatchSkippedSources(new Set());
                    }}
                    className="text-[#8A8A70] hover:underline flex items-center gap-1 text-sm cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>恢復預設國定假日</span>
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1">
                {nationalHolidays.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between bg-white p-2 rounded-xl border border-[#E9E7D4] text-sm"
                  >
                    <div>
                      <span className="font-mono font-bold text-[#5A5A40] mr-2">{h.date}</span>
                      <span className="text-[#2D2D2D]">{h.name}</span>
                      {h.kind === 'makeup' && (
                        <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded bg-[#C46B4A]/15 text-[#C46B4A] border border-[#C46B4A]/25">
                          調
                          {h.substitutesFor === 'rest'
                            ? '·替休'
                            : h.substitutesFor === 'mandatory'
                              ? '·替例'
                              : ''}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteHoliday(h)}
                      className="text-[#8A8A70] hover:text-[#D17A60] p-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Shifts */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="bg-[#F8F7EB] p-4 rounded-xl border border-[#E9E7D4] space-y-3">
              <div className="text-sm font-bold text-[#5A5A40] flex items-center justify-between">
                <span>步驟 2：詳細設定事業單位班別名稱、簡碼與上下班工時</span>
                <button
                  type="button"
                  onClick={onResetShiftTypes}
                  className="text-sm text-[#8A8A70] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>重置為預設班別</span>
                </button>
              </div>

              <form onSubmit={handleAddShiftSubmit} className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-xs text-[#8A8A70] mb-0.5">班別簡碼 (例: 早)</label>
                    <input
                      type="text"
                      maxLength={3}
                      placeholder="簡碼"
                      value={sCode}
                      onChange={(e) => setSCode(e.target.value)}
                      className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2.5 py-1.5 text-sm font-mono outline-none focus:ring-2 focus:ring-[#5A5A40]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8A8A70] mb-0.5">班別全名 (例: 門市早班)</label>
                    <input
                      type="text"
                      placeholder="班別名稱"
                      value={sName}
                      onChange={(e) => setSName(e.target.value)}
                      className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#5A5A40]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8A8A70] mb-0.5">班別屬性</label>
                    <select
                      value={sCategory}
                      onChange={(e) => setSCategory(e.target.value as any)}
                      className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#5A5A40]"
                    >
                      <option value="work">工作日 (一般排班)</option>
                      <option value="rest">休息日 (休)</option>
                      <option value="mandatory">例假日 (例)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#8A8A70] mb-0.5">代表色彩</label>
                    <input
                      type="color"
                      value={sColor}
                      onChange={(e) => setSColor(e.target.value)}
                      className="w-full h-8 bg-white border border-[#D9D7C2] rounded-xl cursor-pointer p-0.5"
                    />
                  </div>
                </div>

                {sCategory === 'work' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-[#E9E7D4]">
                    <div>
                      <label className="block text-xs text-[#8A8A70] mb-0.5">上班時間</label>
                      <input
                        type="time"
                        value={sStart}
                        onChange={(e) => handleStartChange(e.target.value)}
                        className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2 py-1 text-sm font-mono outline-none focus:ring-2 focus:ring-[#5A5A40]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#8A8A70] mb-0.5">下班時間</label>
                      <input
                        type="time"
                        value={sEnd}
                        onChange={(e) => handleEndChange(e.target.value)}
                        className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2 py-1 text-sm font-mono outline-none focus:ring-2 focus:ring-[#5A5A40]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#8A8A70] mb-0.5">休息時間 (H)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={sBreak}
                        onChange={(e) => {
                          const b = e.target.value;
                          setSBreak(b);
                          setSHours(String(calculateHours(sStart, sEnd, Number(b))));
                        }}
                        className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2 py-1 text-sm font-mono outline-none focus:ring-2 focus:ring-[#5A5A40]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#8A8A70] mb-0.5">每日工時 (H)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={sHours}
                        onChange={(e) => setSHours(e.target.value)}
                        className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2 py-1 text-sm font-mono font-bold text-[#5A5A40] outline-none focus:ring-2 focus:ring-[#5A5A40]"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-sm rounded-xl py-1.5 px-4 flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>新增此班別</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Current Shift List with Edit Option */}
            <div className="space-y-1.5">
              <div className="text-sm font-bold text-[#8A8A70]">現有班別清單 (點擊編輯可詳細修正時間與工時)</div>
              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                {shiftTypes.map((st) => {
                  const isEditing = editingShiftId === st.id;

                  if (isEditing) {
                    return (
                      <div
                        key={st.id}
                        className="bg-white p-3 rounded-xl border-2 border-[#5A5A40] space-y-2 shadow-sm text-sm"
                      >
                        <div className="font-bold text-[#5A5A40] flex items-center justify-between border-b pb-1 text-sm">
                          <span>編輯班別：{st.name}</span>
                          <span className="text-xs text-[#8A8A70]">代碼: {st.code}</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="block text-xs text-[#8A8A70] mb-0.5">簡碼</label>
                            <input
                              type="text"
                              maxLength={3}
                              value={editShiftForm.code || ''}
                              onChange={(e) => setEditShiftForm((prev) => ({ ...prev, code: e.target.value }))}
                              className="w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded px-2 py-1 text-sm font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-[#8A8A70] mb-0.5">名稱</label>
                            <input
                              type="text"
                              value={editShiftForm.name || ''}
                              onChange={(e) => setEditShiftForm((prev) => ({ ...prev, name: e.target.value }))}
                              className="w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded px-2 py-1 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-[#8A8A70] mb-0.5">色彩</label>
                            <input
                              type="color"
                              value={editShiftForm.color || '#5A5A40'}
                              onChange={(e) => setEditShiftForm((prev) => ({ ...prev, color: e.target.value }))}
                              className="w-full h-7 bg-white border rounded cursor-pointer p-0.5"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-[#8A8A70] mb-0.5">工時 (H)</label>
                            <input
                              type="number"
                              step="0.5"
                              value={editShiftForm.workHours ?? 8}
                              onChange={(e) => setEditShiftForm((prev) => ({ ...prev, workHours: Number(e.target.value) }))}
                              className="w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded px-2 py-1 text-sm font-mono font-bold"
                            />
                          </div>
                        </div>

                        {editShiftForm.category === 'work' && (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <label className="block text-xs text-[#8A8A70] mb-0.5">上班時間</label>
                              <input
                                type="time"
                                value={editShiftForm.startTime || '09:00'}
                                onChange={(e) => {
                                  const s = e.target.value;
                                  const eTime = editShiftForm.endTime || '18:00';
                                  const b = editShiftForm.breakHours ?? 1;
                                  const w = calculateHours(s, eTime, b);
                                  setEditShiftForm((prev) => ({ ...prev, startTime: s, workHours: w }));
                                }}
                                className="w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded px-2 py-1 text-sm font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-[#8A8A70] mb-0.5">下班時間</label>
                              <input
                                type="time"
                                value={editShiftForm.endTime || '18:00'}
                                onChange={(e) => {
                                  const eTime = e.target.value;
                                  const s = editShiftForm.startTime || '09:00';
                                  const b = editShiftForm.breakHours ?? 1;
                                  const w = calculateHours(s, eTime, b);
                                  setEditShiftForm((prev) => ({ ...prev, endTime: eTime, workHours: w }));
                                }}
                                className="w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded px-2 py-1 text-sm font-mono"
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end space-x-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingShiftId(null)}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded transition-colors"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEditShift}
                            className="px-2.5 py-1 bg-[#5A5A40] hover:bg-[#484833] text-white text-sm font-bold rounded transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>儲存</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={st.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-[#E9E7D4] text-sm bg-white"
                    >
                      <div className="flex items-center space-x-2">
                        <span
                          className="px-2 py-0.5 rounded font-bold font-mono text-sm"
                          style={{
                            backgroundColor: st.color,
                            color: getContrastingTextColor(st.color),
                          }}
                        >
                          {st.code}
                        </span>
                        <span className="font-bold text-[#2D2D2D]">{st.name}</span>
                        <span className="text-[#8A8A70] text-sm font-mono flex items-center gap-1">
                          {st.category === 'work' ? (
                            <>
                              <Clock className="w-3 h-3 text-[#5A5A40]" />
                              <span>{st.startTime}~{st.endTime} ({st.workHours}H)</span>
                            </>
                          ) : st.category === 'national_holiday_makeup' ? (
                            '國定假日補假（調）'
                          ) : (
                            '非工作日/休假'
                          )}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleStartEditShift(st)}
                          className="p-1 text-[#5A5A40] hover:bg-[#5A5A40]/10 rounded transition-colors cursor-pointer"
                          title="編輯班別時間與簡碼"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {!(SYSTEM_PROTECTED_SHIFT_IDS as readonly string[]).includes(st.id) && (
                          <button
                            type="button"
                            onClick={() => onDeleteShiftType(st.id)}
                            className="p-1 text-[#8A8A70] hover:text-[#D17A60] transition-colors cursor-pointer"
                            title="刪除班別"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Employees */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="bg-[#F8F7EB] p-4 rounded-xl border border-[#E9E7D4] space-y-3">
              <div className="text-sm font-bold text-[#5A5A40]">步驟 3：新增您的事業單位排班同仁名單</div>

              <form onSubmit={handleAddEmployeeSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-[#8A8A70] mb-1">同仁姓名</label>
                    <input
                      type="text"
                      placeholder="例如：陳大明"
                      value={empName}
                      onChange={(e) => setEmpName(e.target.value)}
                      className="w-full bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#5A5A40]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#8A8A70] mb-1">職稱 / 角色</label>
                    <input
                      type="text"
                      placeholder="例如：門市專任人員"
                      value={empRole}
                      onChange={(e) => setEmpRole(e.target.value)}
                      className="w-full bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#5A5A40]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-[#8A8A70] mb-1">適用勞基法變形工時制度</label>
                    <select
                      value={empSystem}
                      onChange={(e) => setEmpSystem(e.target.value as ScheduleSystemType)}
                      className="w-full bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#5A5A40]"
                    >
                      {Object.entries(SYSTEM_CONFIGS).map(([key, cfg]) => (
                        <option key={key} value={key}>
                          {cfg.name} ({cfg.cycleDays}天)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-[#8A8A70] mb-1">第一週週期起始日</label>
                    <input
                      type="date"
                      value={empCycleStart}
                      onChange={(e) => setEmpCycleStart(e.target.value)}
                      className="w-full bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#5A5A40]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-sm py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>新增至名單</span>
                </button>
              </form>
            </div>

            {/* Added Employees List */}
            <div className="space-y-2">
              <div className="text-sm font-bold text-[#8A8A70]">已建立同仁 ({employees.length})</div>
              {employees.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-[#D9D7C2] rounded-xl text-sm text-[#8A8A70]">
                  尚未建立同仁名單，請在上方輸入同仁姓名並點擊「新增至名單」
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                  {employees.map((emp) => (
                    <div
                      key={emp.id}
                      className="flex items-center justify-between bg-white p-3 rounded-xl border border-[#E9E7D4] text-sm shadow-sm"
                    >
                      <div>
                        <span className="font-bold text-[#2D2D2D] mr-2">{emp.name}</span>
                        <span className="text-[#8A8A70] mr-3">({emp.role})</span>
                        <span className="bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded text-sm font-medium border border-[#5A5A40]/20">
                          {SYSTEM_CONFIGS[emp.scheduleSystem]?.name}
                        </span>
                      </div>
                      <button
                        onClick={() => onDeleteEmployee(emp.id)}
                        className="text-[#8A8A70] hover:text-[#D17A60] p-1 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        </div>

        {/* Modal Wizard Actions Footer — 固定底部，避免小螢幕被裁切 */}
        <div className="shrink-0 px-4 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[#E9E7D4] flex items-center justify-between gap-2 bg-white">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3)}
                className="px-3 sm:px-4 py-2 border border-[#E9E7D4] bg-white hover:bg-[#F8F7EB] text-[#5A5A40] font-bold text-sm rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>上一步</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3)}
                className="px-4 sm:px-5 py-2 bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-sm rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <span>下一步</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCompleteSetup}
                disabled={employees.length === 0}
                className={`px-4 sm:px-6 py-2.5 font-bold text-sm rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                  employees.length > 0
                    ? 'bg-[#4A7C59] hover:bg-[#3B6547] text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span className="sm:hidden">完成設定</span>
                <span className="hidden sm:inline">完成設定，開啟排班 🚀</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
