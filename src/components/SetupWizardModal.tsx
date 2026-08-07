import React, { useState } from 'react';
import { NationalHoliday, ShiftType, Employee, ScheduleSystemType } from '../types';
import { Sun, Layers, Users, CheckCircle, ArrowRight, ArrowLeft, Plus, Trash2, X, Sparkles, RotateCcw, Edit2, Check, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { SYSTEM_CONFIGS } from '../constants/systems';

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

  const handleAddHolidaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hDate) return;
    onAddHoliday({ date: hDate, name: hName.trim() || '自訂假日' });
    setHDate('');
    setHName('');
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
      textColor: '#FFFFFF',
      category: sCategory,
      isWorkShift: sCategory === 'work',
    } as ShiftType);
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
      onUpdateShiftType(editShiftForm as ShiftType);
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#E9E7D4] rounded-2xl max-w-3xl w-full p-6 shadow-2xl text-[#2D2D2D] space-y-6 my-8 animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E9E7D4] pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#5A5A40] text-white rounded-xl shadow-sm">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2D2D2D] font-serif">事業單位排班初始導引 Panel</h2>
              <p className="text-xs text-[#8A8A70]">請透過 3 個簡單步驟完成基本設定（假日、班別代碼與同仁名單）</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8A8A70] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="grid grid-cols-3 gap-2 bg-[#F8F7EB] p-2 rounded-xl border border-[#E9E7D4] text-xs font-bold">
          <button
            onClick={() => setCurrentStep(1)}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all cursor-pointer ${
              currentStep === 1
                ? 'bg-[#5A5A40] text-white shadow-sm'
                : 'text-[#8A8A70] hover:bg-white hover:text-[#2D2D2D]'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span>1. 國定與自訂假日</span>
          </button>
          <button
            onClick={() => setCurrentStep(2)}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all cursor-pointer ${
              currentStep === 2
                ? 'bg-[#5A5A40] text-white shadow-sm'
                : 'text-[#8A8A70] hover:bg-white hover:text-[#2D2D2D]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>2. 班別代碼與工時</span>
          </button>
          <button
            onClick={() => setCurrentStep(3)}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all cursor-pointer ${
              currentStep === 3
                ? 'bg-[#5A5A40] text-white shadow-sm'
                : 'text-[#8A8A70] hover:bg-white hover:text-[#2D2D2D]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>3. 新增同仁名單</span>
          </button>
        </div>

        {/* STEP 1: Holidays */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="bg-[#F8F7EB] p-4 rounded-xl border border-[#E9E7D4] space-y-3">
              <div className="text-xs font-bold text-[#5A5A40] flex items-center justify-between">
                <span>步驟 1：檢視或自訂國定與特休假日</span>
                <span className="text-[11px] text-[#8A8A70] font-normal">現有假日：{nationalHolidays.length} 天</span>
              </div>

              <form onSubmit={handleAddHolidaySubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="date"
                  value={hDate}
                  onChange={(e) => setHDate(e.target.value)}
                  className="bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]"
                />
                <input
                  type="text"
                  list="setup-holiday-suggestions"
                  placeholder="選擇或輸入假日名稱"
                  value={hName}
                  onChange={(e) => setHName(e.target.value)}
                  className="bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]"
                />
                <datalist id="setup-holiday-suggestions">
                  {STANDARD_HOLIDAY_SUGGESTIONS.map((name, idx) => (
                    <option key={idx} value={name} />
                  ))}
                </datalist>
                <button
                  type="submit"
                  className="bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-xs rounded-xl py-2 px-3 flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>新增假日</span>
                </button>
              </form>
            </div>

            {/* Holiday List & Quick Actions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#8A8A70]">
                <span>已建置假日 ({nationalHolidays.length})</span>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={onClearAllHolidays}
                    className="text-[#D17A60] hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>全部清空</span>
                  </button>
                  <button
                    type="button"
                    onClick={onResetHolidays}
                    className="text-[#8A8A70] hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
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
                    className="flex items-center justify-between bg-white p-2 rounded-xl border border-[#E9E7D4] text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-[#5A5A40] mr-2">{h.date}</span>
                      <span className="text-[#2D2D2D]">{h.name}</span>
                    </div>
                    <button
                      onClick={() => onDeleteHoliday(h.id)}
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
              <div className="text-xs font-bold text-[#5A5A40] flex items-center justify-between">
                <span>步驟 2：詳細設定事業單位班別名稱、簡碼與上下班工時</span>
                <button
                  type="button"
                  onClick={onResetShiftTypes}
                  className="text-[11px] text-[#8A8A70] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>重置為預設班別</span>
                </button>
              </div>

              <form onSubmit={handleAddShiftSubmit} className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] text-[#8A8A70] mb-0.5">班別簡碼 (例: 早)</label>
                    <input
                      type="text"
                      maxLength={3}
                      placeholder="簡碼"
                      value={sCode}
                      onChange={(e) => setSCode(e.target.value)}
                      className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2.5 py-1.5 text-xs font-mono outline-none focus:ring-2 focus:ring-[#5A5A40]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8A8A70] mb-0.5">班別全名 (例: 門市早班)</label>
                    <input
                      type="text"
                      placeholder="班別名稱"
                      value={sName}
                      onChange={(e) => setSName(e.target.value)}
                      className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8A8A70] mb-0.5">班別屬性</label>
                    <select
                      value={sCategory}
                      onChange={(e) => setSCategory(e.target.value as any)}
                      className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]"
                    >
                      <option value="work">工作日 (一般排班)</option>
                      <option value="rest">休息日 (休)</option>
                      <option value="mandatory">例假日 (例)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8A8A70] mb-0.5">代表色彩</label>
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
                      <label className="block text-[10px] text-[#8A8A70] mb-0.5">上班時間</label>
                      <input
                        type="time"
                        value={sStart}
                        onChange={(e) => handleStartChange(e.target.value)}
                        className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2 py-1 text-xs font-mono outline-none focus:ring-2 focus:ring-[#5A5A40]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#8A8A70] mb-0.5">下班時間</label>
                      <input
                        type="time"
                        value={sEnd}
                        onChange={(e) => handleEndChange(e.target.value)}
                        className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2 py-1 text-xs font-mono outline-none focus:ring-2 focus:ring-[#5A5A40]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#8A8A70] mb-0.5">休息時間 (H)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={sBreak}
                        onChange={(e) => {
                          const b = e.target.value;
                          setSBreak(b);
                          setSHours(String(calculateHours(sStart, sEnd, Number(b))));
                        }}
                        className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2 py-1 text-xs font-mono outline-none focus:ring-2 focus:ring-[#5A5A40]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#8A8A70] mb-0.5">每日工時 (H)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={sHours}
                        onChange={(e) => setSHours(e.target.value)}
                        className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2 py-1 text-xs font-mono font-bold text-[#5A5A40] outline-none focus:ring-2 focus:ring-[#5A5A40]"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-xs rounded-xl py-1.5 px-4 flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>新增此班別</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Current Shift List with Edit Option */}
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-[#8A8A70]">現有班別清單 (點擊編輯可詳細修正時間與工時)</div>
              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                {shiftTypes.map((st) => {
                  const isEditing = editingShiftId === st.id;

                  if (isEditing) {
                    return (
                      <div
                        key={st.id}
                        className="bg-white p-3 rounded-xl border-2 border-[#5A5A40] space-y-2 shadow-sm text-xs"
                      >
                        <div className="font-bold text-[#5A5A40] flex items-center justify-between border-b pb-1 text-[11px]">
                          <span>編輯班別：{st.name}</span>
                          <span className="text-[10px] text-[#8A8A70]">代碼: {st.code}</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="block text-[10px] text-[#8A8A70] mb-0.5">簡碼</label>
                            <input
                              type="text"
                              maxLength={3}
                              value={editShiftForm.code || ''}
                              onChange={(e) => setEditShiftForm((prev) => ({ ...prev, code: e.target.value }))}
                              className="w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded px-2 py-1 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#8A8A70] mb-0.5">名稱</label>
                            <input
                              type="text"
                              value={editShiftForm.name || ''}
                              onChange={(e) => setEditShiftForm((prev) => ({ ...prev, name: e.target.value }))}
                              className="w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#8A8A70] mb-0.5">色彩</label>
                            <input
                              type="color"
                              value={editShiftForm.color || '#5A5A40'}
                              onChange={(e) => setEditShiftForm((prev) => ({ ...prev, color: e.target.value }))}
                              className="w-full h-7 bg-white border rounded cursor-pointer p-0.5"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#8A8A70] mb-0.5">工時 (H)</label>
                            <input
                              type="number"
                              step="0.5"
                              value={editShiftForm.workHours ?? 8}
                              onChange={(e) => setEditShiftForm((prev) => ({ ...prev, workHours: Number(e.target.value) }))}
                              className="w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded px-2 py-1 text-xs font-mono font-bold"
                            />
                          </div>
                        </div>

                        {(editShiftForm.category === 'work' || editShiftForm.isWorkShift) && (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <label className="block text-[10px] text-[#8A8A70] mb-0.5">上班時間</label>
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
                                className="w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded px-2 py-1 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-[#8A8A70] mb-0.5">下班時間</label>
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
                                className="w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded px-2 py-1 text-xs font-mono"
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end space-x-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingShiftId(null)}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded transition-colors"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEditShift}
                            className="px-2.5 py-1 bg-[#5A5A40] hover:bg-[#484833] text-white text-xs font-bold rounded transition-colors flex items-center gap-1 cursor-pointer"
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
                      className="flex items-center justify-between p-2.5 rounded-xl border border-[#E9E7D4] text-xs bg-white"
                    >
                      <div className="flex items-center space-x-2">
                        <span
                          className="px-2 py-0.5 rounded font-bold font-mono text-[11px]"
                          style={{ backgroundColor: st.color, color: st.textColor || '#ffffff' }}
                        >
                          {st.code}
                        </span>
                        <span className="font-bold text-[#2D2D2D]">{st.name}</span>
                        <span className="text-[#8A8A70] text-[11px] font-mono flex items-center gap-1">
                          {st.category === 'work' || st.isWorkShift ? (
                            <>
                              <Clock className="w-3 h-3 text-[#5A5A40]" />
                              <span>{st.startTime}~{st.endTime} ({st.workHours}H)</span>
                            </>
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

                        {!['shift_rest', 'shift_mandatory', 'shift_national_holiday'].includes(st.id) && (
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
              <div className="text-xs font-bold text-[#5A5A40]">步驟 3：新增您的事業單位排班同仁名單</div>

              <form onSubmit={handleAddEmployeeSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#8A8A70] mb-1">同仁姓名</label>
                    <input
                      type="text"
                      placeholder="例如：陳大明"
                      value={empName}
                      onChange={(e) => setEmpName(e.target.value)}
                      className="w-full bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8A8A70] mb-1">職稱 / 角色</label>
                    <input
                      type="text"
                      placeholder="例如：門市專任人員"
                      value={empRole}
                      onChange={(e) => setEmpRole(e.target.value)}
                      className="w-full bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#8A8A70] mb-1">適用勞基法變形工時制度</label>
                    <select
                      value={empSystem}
                      onChange={(e) => setEmpSystem(e.target.value as ScheduleSystemType)}
                      className="w-full bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]"
                    >
                      {Object.entries(SYSTEM_CONFIGS).map(([key, cfg]) => (
                        <option key={key} value={key}>
                          {cfg.name} ({cfg.cycleDays}天)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#8A8A70] mb-1">第一週週期起始日</label>
                    <input
                      type="date"
                      value={empCycleStart}
                      onChange={(e) => setEmpCycleStart(e.target.value)}
                      className="w-full bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>新增至名單</span>
                </button>
              </form>
            </div>

            {/* Added Employees List */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#8A8A70]">已建立同仁 ({employees.length})</div>
              {employees.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-[#D9D7C2] rounded-xl text-xs text-[#8A8A70]">
                  尚未建立同仁名單，請在上方輸入同仁姓名並點擊「新增至名單」
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                  {employees.map((emp) => (
                    <div
                      key={emp.id}
                      className="flex items-center justify-between bg-white p-3 rounded-xl border border-[#E9E7D4] text-xs shadow-sm"
                    >
                      <div>
                        <span className="font-bold text-[#2D2D2D] mr-2">{emp.name}</span>
                        <span className="text-[#8A8A70] mr-3">({emp.role})</span>
                        <span className="bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded text-[11px] font-medium border border-[#5A5A40]/20">
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

        {/* Modal Wizard Actions Footer */}
        <div className="pt-4 border-t border-[#E9E7D4] flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3)}
                className="px-4 py-2 border border-[#E9E7D4] bg-white hover:bg-[#F8F7EB] text-[#5A5A40] font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
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
                className="px-5 py-2 bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <span>下一步</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onCompleteSetup}
                disabled={employees.length === 0}
                className={`px-6 py-2.5 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                  employees.length > 0
                    ? 'bg-[#4A7C59] hover:bg-[#3B6547] text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>完成設定，開啟排班 🚀</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
