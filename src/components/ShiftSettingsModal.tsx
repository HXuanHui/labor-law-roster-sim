import React, { useState } from 'react';
import { ShiftType } from '../types';
import { Layers, Plus, Trash2, X, Edit2, Check, Clock } from 'lucide-react';
import { getContrastingTextColor } from '../utils/colorContrast';
import { SYSTEM_PROTECTED_SHIFT_IDS } from '../constants/shifts';

interface ShiftSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftTypes: ShiftType[];
  onAddShiftType: (st: ShiftType) => void;
  onUpdateShiftType: (st: ShiftType) => void;
  onDeleteShiftType: (id: string) => void;
}

export const ShiftSettingsModal: React.FC<ShiftSettingsModalProps> = ({
  isOpen,
  onClose,
  shiftTypes,
  onAddShiftType,
  onUpdateShiftType,
  onDeleteShiftType,
}) => {
  // New shift form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [workHours, setWorkHours] = useState(8);
  const [breakHours, setBreakHours] = useState(1);
  const [color, setColor] = useState('#5A5A40');
  const [category, setCategory] = useState<'work' | 'rest' | 'mandatory' | 'national_holiday'>('work');

  // Editing shift state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ShiftType>>({});

  if (!isOpen) return null;

  // Auto calculate work hours when start/end time changes
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

  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    if (category === 'work') {
      setWorkHours(calculateHours(val, endTime, breakHours));
    }
  };

  const handleEndTimeChange = (val: string) => {
    setEndTime(val);
    if (category === 'work') {
      setWorkHours(calculateHours(startTime, val, breakHours));
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;

    onAddShiftType({
      id: `shift_custom_${Date.now()}`,
      code: code.trim(),
      name: name.trim(),
      startTime,
      endTime,
      workHours: category === 'work' ? Number(workHours) : 0,
      breakHours: Number(breakHours),
      color,
      // 依背景亮度寫入深／淺字色，供匯出等仍讀 textColor 的場景使用
      textColor: getContrastingTextColor(color),
      category,
    });

    setCode('');
    setName('');
  };

  const handleStartEdit = (st: ShiftType) => {
    setEditingId(st.id);
    setEditForm({ ...st });
  };

  /**
   * 儲存編輯中的班別；同步依背景色重算對比文字色。
   */
  const handleSaveEdit = () => {
    if (!editingId || !editForm.code || !editForm.name) return;
    const nextColor = editForm.color || '#5A5A40';
    onUpdateShiftType({
      ...(editForm as ShiftType),
      color: nextColor,
      textColor: getContrastingTextColor(nextColor),
    });
    setEditingId(null);
    setEditForm({});
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#E9E7D4] rounded-2xl max-w-2xl w-full p-6 shadow-xl text-[#2D2D2D] space-y-5 my-8">
        <div className="flex items-center justify-between border-b border-[#E9E7D4] pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl border border-[#5A5A40]/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#2D2D2D] font-serif">班別時間與類別設定</h2>
              <p className="text-sm text-[#8A8A70]">可自訂或編輯早/中/夜班、長班與休息日之上下班時間、工時與代表色彩</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8A8A70] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form to add custom shift */}
        <form onSubmit={handleAdd} className="bg-[#F8F7EB] p-4 rounded-xl border border-[#E9E7D4] space-y-3">
          <div className="text-sm font-bold text-[#5A5A40] uppercase tracking-wider flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" />
            <span>新增班別代碼與時間</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm text-[#8A8A70] mb-1">班別簡碼 (例：早)</label>
              <input
                type="text"
                maxLength={3}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="代碼"
                className="w-full bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-sm text-[#2D2D2D] outline-none focus:ring-2 focus:ring-[#5A5A40] font-mono"
              />
            </div>

            <div>
              <label className="block text-sm text-[#8A8A70] mb-1">班別名稱</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：門市早班"
                className="w-full bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-sm text-[#2D2D2D] outline-none focus:ring-2 focus:ring-[#5A5A40]"
              />
            </div>

            <div>
              <label className="block text-sm text-[#8A8A70] mb-1">屬性類別</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2 py-2 text-sm text-[#2D2D2D] outline-none focus:ring-2 focus:ring-[#5A5A40]"
              >
                <option value="work">工作日 (一般班別)</option>
                <option value="rest">休息日 (休)</option>
                <option value="mandatory">例假日 (例)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-[#8A8A70] mb-1">代表色彩</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-9 bg-white border border-[#D9D7C2] rounded-xl cursor-pointer p-1"
              />
            </div>
          </div>

          {category === 'work' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-[#E9E7D4]/60">
              <div>
                <label className="block text-sm text-[#8A8A70] mb-1">上班時間</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2 py-1.5 text-sm text-[#2D2D2D] outline-none focus:ring-2 focus:ring-[#5A5A40] font-mono"
                />
              </div>

              <div>
                <label className="block text-sm text-[#8A8A70] mb-1">下班時間</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                  className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2 py-1.5 text-sm text-[#2D2D2D] outline-none focus:ring-2 focus:ring-[#5A5A40] font-mono"
                />
              </div>

              <div>
                <label className="block text-sm text-[#8A8A70] mb-1">休息時間 (小時)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="4"
                  value={breakHours}
                  onChange={(e) => {
                    const b = Number(e.target.value);
                    setBreakHours(b);
                    setWorkHours(calculateHours(startTime, endTime, b));
                  }}
                  className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2 py-1.5 text-sm text-[#2D2D2D] outline-none focus:ring-2 focus:ring-[#5A5A40] font-mono"
                />
              </div>

              <div>
                <label className="block text-sm text-[#8A8A70] mb-1">每日工時 (小時)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="12"
                  value={workHours}
                  onChange={(e) => setWorkHours(Number(e.target.value))}
                  className="w-full bg-white border border-[#D9D7C2] rounded-xl px-2 py-1.5 text-sm text-[#2D2D2D] outline-none focus:ring-2 focus:ring-[#5A5A40] font-mono font-bold text-[#5A5A40]"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-sm py-2 px-4 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>新增此班別</span>
            </button>
          </div>
        </form>

        {/* Existing Shifts List with Edit Capability */}
        <div className="space-y-2">
          <div className="text-sm font-bold text-[#8A8A70]">班別與時間清單（點擊編輯圖示可調整時間）</div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {shiftTypes.map((st) => {
              const isEditing = editingId === st.id;

              if (isEditing) {
                return (
                  <div
                    key={st.id}
                    className="bg-white p-3.5 rounded-xl border-2 border-[#5A5A40] space-y-3 shadow-md"
                  >
                    <div className="text-sm font-bold text-[#5A5A40] flex items-center justify-between border-b pb-1.5">
                      <span>編輯班別：{st.name}</span>
                      <span className="text-xs text-[#8A8A70] font-mono">ID: {st.id}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-xs text-[#8A8A70] mb-0.5">簡碼</label>
                        <input
                          type="text"
                          maxLength={3}
                          value={editForm.code || ''}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, code: e.target.value }))}
                          className="w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded-lg px-2 py-1 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#8A8A70] mb-0.5">班別全名</label>
                        <input
                          type="text"
                          value={editForm.name || ''}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                          className="w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded-lg px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#8A8A70] mb-0.5">色彩</label>
                        <input
                          type="color"
                          value={editForm.color || '#5A5A40'}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, color: e.target.value }))}
                          className="w-full h-7 bg-white border rounded cursor-pointer p-0.5"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#8A8A70] mb-0.5">每日工時 (H)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={editForm.workHours ?? 8}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, workHours: Number(e.target.value) }))}
                          className="w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded-lg px-2 py-1 text-sm font-mono font-bold"
                        />
                      </div>
                    </div>

                    {editForm.category === 'work' && (
                      <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="block text-xs text-[#8A8A70] mb-0.5">上班時間</label>
                          <input
                            type="time"
                            value={editForm.startTime || '09:00'}
                            onChange={(e) => {
                              const s = e.target.value;
                              const eTime = editForm.endTime || '18:00';
                              const b = editForm.breakHours ?? 1;
                              const w = calculateHours(s, eTime, b);
                              setEditForm((prev) => ({ ...prev, startTime: s, workHours: w }));
                            }}
                            className="w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded-lg px-2 py-1 text-sm font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-[#8A8A70] mb-0.5">下班時間</label>
                          <input
                            type="time"
                            value={editForm.endTime || '18:00'}
                            onChange={(e) => {
                              const eTime = e.target.value;
                              const s = editForm.startTime || '09:00';
                              const b = editForm.breakHours ?? 1;
                              const w = calculateHours(s, eTime, b);
                              setEditForm((prev) => ({ ...prev, endTime: eTime, workHours: w }));
                            }}
                            className="w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded-lg px-2 py-1 text-sm font-mono"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end space-x-2 pt-1">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-3 py-1 bg-[#5A5A40] hover:bg-[#484833] text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>儲存修改</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={st.id}
                  className="bg-[#F8F7EB] p-3 rounded-xl border border-[#E9E7D4] flex items-center justify-between text-sm"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-8 h-8 rounded-lg font-bold flex items-center justify-center font-mono text-sm shadow-sm"
                      style={{
                        backgroundColor: st.color,
                        color: getContrastingTextColor(st.color),
                      }}
                    >
                      {st.code}
                    </div>
                    <div>
                      <div className="font-semibold text-[#2D2D2D] flex items-center gap-2">
                        <span>{st.name}</span>
                        {st.category === 'work' && (
                          <span className="text-xs text-[#5A5A40] font-mono bg-[#5A5A40]/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {st.startTime}~{st.endTime} ({st.workHours}H)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#8A8A70] font-mono mt-0.5">
                        {st.category === 'work'
                          ? `扣除休息時間 ${st.breakHours || 1} 小時`
                          : st.category === 'rest'
                          ? '休息日（不支薪或計算休息日加班費）'
                          : st.category === 'mandatory'
                          ? '例假日（不得隨意加班，除天災事變外）'
                          : st.category === 'national_holiday_makeup'
                          ? '國定假日補假「調」（審查可替休／例；計薪視同國假）'
                          : '國定假日'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleStartEdit(st)}
                      className="p-1.5 text-[#5A5A40] hover:bg-[#5A5A40]/10 rounded-lg transition-colors"
                      title="編輯時間與名稱"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {!(SYSTEM_PROTECTED_SHIFT_IDS as readonly string[]).includes(st.id) && (
                      <button
                        onClick={() => onDeleteShiftType(st.id)}
                        className="p-1.5 text-[#8A8A70] hover:text-[#D17A60] hover:bg-[#D17A60]/10 rounded-lg transition-colors"
                        title="刪除班別"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#E9E7D4] pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#5A5A40] hover:bg-[#484833] text-white font-semibold text-sm rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
