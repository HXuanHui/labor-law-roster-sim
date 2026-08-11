import React, { useState } from 'react';
import { Employee, ScheduleSystemType } from '../types';
import { Users, Plus, Trash2, X, UserPlus, Check, Edit2 } from 'lucide-react';
import { SYSTEM_CONFIGS } from '../constants/systems';

/**
 * 同仁設定 Modal 屬性。
 * 第一週／週期起始日改由公司級設定，不在個別同仁表單調整。
 */
interface EmployeeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  /** 公司級第一週起始日（僅供顯示說明）。 */
  companyCycleStartDate: string;
  /**
   * 新增同仁。
   * @param name 姓名
   * @param role 職稱
   * @param system 適用制度
   */
  onAddEmployee: (name: string, role: string, system: ScheduleSystemType) => void;
  onUpdateEmployee?: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onSelectEmployee: (id: string) => void;
  selectedEmployeeId: string;
}

/**
 * 同仁名單與個人制度設定（不含公司級第一週起始日）。
 */
export const EmployeeSettingsModal: React.FC<EmployeeSettingsModalProps> = ({
  isOpen,
  onClose,
  employees,
  companyCycleStartDate,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onSelectEmployee,
  selectedEmployeeId,
}) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('專任人員');
  const [scheduleSystem, setScheduleSystem] = useState<ScheduleSystemType>('2-week');

  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Employee>>({});

  if (!isOpen) return null;

  /**
   * 送出新增同仁表單。
   * @param e 表單事件
   */
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddEmployee(name.trim(), role, scheduleSystem);
    setName('');
  };

  /**
   * 進入編輯模式。
   * @param emp 同仁
   */
  const handleStartEdit = (emp: Employee) => {
    setEditingEmpId(emp.id);
    setEditForm({ ...emp });
  };

  /** 儲存編輯中的同仁。 */
  const handleSaveEdit = () => {
    if (!editingEmpId || !editForm.name || !onUpdateEmployee) return;
    // 強制沿用公司級週期起日，避免舊欄位殘留造成分歧
    onUpdateEmployee({
      ...(editForm as Employee),
      cycleStartDate: companyCycleStartDate,
    });
    setEditingEmpId(null);
    setEditForm({});
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#E9E7D4] rounded-2xl max-w-2xl w-full p-6 shadow-xl text-[#2D2D2D] space-y-5 my-8">
        <div className="flex items-center justify-between border-b border-[#E9E7D4] pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl border border-[#5A5A40]/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#2D2D2D] font-serif">同仁個人排班設定</h2>
              <p className="text-sm text-[#8A8A70]">
                新增或調整排班同仁與適用制度；公司第一週起始日為{' '}
                <span className="font-mono font-semibold text-[#5A5A40]">
                  {companyCycleStartDate}
                </span>
                （於「班表設定」統一設定）
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

        <form onSubmit={handleAdd} className="bg-[#F8F7EB] p-4 rounded-xl border border-[#E9E7D4] space-y-3">
          <div className="text-sm font-bold text-[#5A5A40] uppercase tracking-wider flex items-center gap-1">
            <UserPlus className="w-3.5 h-3.5" />
            <span>新增同仁及基礎排班設定</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-[#8A8A70] mb-1">同仁姓名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：王小明"
                className="w-full bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-sm text-[#2D2D2D] outline-none focus:ring-2 focus:ring-[#5A5A40]"
              />
            </div>

            <div>
              <label className="block text-sm text-[#8A8A70] mb-1">職稱/部門</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="例如：門市副理"
                className="w-full bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-sm text-[#2D2D2D] outline-none focus:ring-2 focus:ring-[#5A5A40]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm text-[#8A8A70] mb-1">適用排班制度</label>
              <select
                value={scheduleSystem}
                onChange={(e) => setScheduleSystem(e.target.value as ScheduleSystemType)}
                className="w-full bg-white border border-[#D9D7C2] rounded-xl px-3 py-2 text-sm text-[#2D2D2D] outline-none focus:ring-2 focus:ring-[#5A5A40]"
              >
                <option value="standard">一般制 (週休二日)</option>
                <option value="2-week">2週變形工時</option>
                <option value="4-week">4週變形工時</option>
                <option value="8-week">8週變形工時</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-sm py-2 px-4 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>新增此同仁</span>
            </button>
          </div>
        </form>

        <div className="space-y-2">
          <div className="text-sm font-bold text-[#8A8A70]">現有成員清單 ({employees.length})</div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {employees.map((emp) => {
              const sysConfig = SYSTEM_CONFIGS[emp.scheduleSystem];
              const isSelected = emp.id === selectedEmployeeId;
              const isEditing = editingEmpId === emp.id;

              if (isEditing) {
                return (
                  <div
                    key={emp.id}
                    className="bg-white p-3.5 rounded-xl border-2 border-[#5A5A40] space-y-3 shadow-md"
                  >
                    <div className="text-sm font-bold text-[#5A5A40] border-b pb-1">
                      編輯成員設定：{emp.name}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-[#8A8A70] mb-0.5">姓名</label>
                        <input
                          type="text"
                          value={editForm.name || ''}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, name: e.target.value }))
                          }
                          className="w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded-lg px-2 py-1 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-[#8A8A70] mb-0.5">職稱/部門</label>
                        <input
                          type="text"
                          value={editForm.role || ''}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, role: e.target.value }))
                          }
                          className="w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded-lg px-2 py-1 text-sm"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs text-[#8A8A70] mb-0.5">適用排班制度</label>
                        <select
                          value={editForm.scheduleSystem || '2-week'}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              scheduleSystem: e.target.value as ScheduleSystemType,
                            }))
                          }
                          className="w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded-lg px-2 py-1 text-sm"
                        >
                          <option value="standard">一般制 (週休二日)</option>
                          <option value="2-week">2週變形工時</option>
                          <option value="4-week">4週變形工時</option>
                          <option value="8-week">8週變形工時</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-1">
                      <button
                        onClick={() => setEditingEmpId(null)}
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
                  key={emp.id}
                  onClick={() => onSelectEmployee(emp.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between text-sm cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#5A5A40]/10 border-[#5A5A40] text-[#2D2D2D] ring-1 ring-[#5A5A40]/50'
                      : 'bg-[#F8F7EB] border-[#E9E7D4] hover:border-[#D9D7C2] text-[#2D2D2D]'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-[#5A5A40]/20 text-[#5A5A40] font-bold flex items-center justify-center text-sm border border-[#5A5A40]/30">
                      {emp.name[0]}
                    </div>
                    <div>
                      <div className="font-bold flex items-center gap-2">
                        <span>{emp.name}</span>
                        {isSelected && (
                          <span className="px-2 py-0.5 rounded text-xs bg-[#5A5A40] text-white font-semibold">
                            當前選取
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[#8A8A70] mt-0.5">
                        {emp.role} · 制度：{sysConfig.name}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    {onUpdateEmployee && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(emp);
                        }}
                        className="p-1.5 text-[#5A5A40] hover:bg-[#5A5A40]/10 rounded-lg transition-colors"
                        title="編輯設定"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEmployee(emp.id);
                      }}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="刪除同仁"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-[#E9E7D4]">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#E9E7D4] hover:bg-[#D9D7C2] text-[#5A5A40] font-bold text-sm rounded-xl transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
