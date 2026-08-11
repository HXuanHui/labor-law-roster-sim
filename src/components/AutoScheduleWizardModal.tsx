import React, { useEffect, useMemo, useState } from 'react';
import {
  Employee,
  NationalHoliday,
  ScheduleSystemType,
  ShiftType,
} from '../types';
import {
  AutoScheduleBondPair,
  AutoScheduleEmpConfig,
  AutoScheduleResult,
  AutoScheduleSavedParams,
  AutoScheduleShortagePolicy,
  AutoScheduleStaffingNeed,
  AutoScheduleSurplusPolicy,
  AUTO_SCHEDULE_TIP_DISMISS_KEY,
} from '../types/autoSchedule';
import {
  employeeHasPreScheduledShifts,
  runAutoSchedule,
} from '../utils/autoSchedule';
import {
  Wand2,
  X,
  ChevronRight,
  Users,
  Link2,
  Info,
  AlertTriangle,
  CheckCircle2,
  GripVertical,
} from 'lucide-react';

/** 精靈步驟：僅提示或參數（虛擬空白／預覽在矩陣上進行）。 */
type WizardStep = 'tip' | 'config' | 'result';

const WEEKDAYS = [
  { value: 0, label: '日' },
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
];

/**
 * 一鍵排班精靈屬性。
 */
interface AutoScheduleWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 開啟時的起始步驟。 */
  initialStep?: WizardStep;
  startDate: string;
  endDate: string;
  currentSystem: ScheduleSystemType;
  companyCycleStartDate: string;
  shiftTypes: ShiftType[];
  nationalHolidays: NationalHoliday[];
  /** 建立草稿時用的原始同仁（非草稿）。 */
  baselineEmployees: Employee[];
  /** 當下矩陣草稿（參數確認時由此執行演算法）。 */
  draftEmployees: Employee[] | null;
  /**
   * 流程說明結束：父層應關閉 Modal、建立虛擬空白草稿覆蓋矩陣。
   * @param dontShowAgain 是否記住不再顯示提示
   */
  onTipFinished: (dontShowAgain: boolean) => void;
  /**
   * 演算完成：將結果交給父層作矩陣預覽。
   * @param result 演算結果
   */
  onPreviewResult: (result: AutoScheduleResult) => void;
  /**
   * 上次確認演算的參數（「調整參數」時還原；首次開啟則為 null）。
   */
  savedParams?: AutoScheduleSavedParams | null;
  /**
   * 確認演算後回寫參數快照，供之後「調整參數」還原。
   * @param params 本次送算參數
   */
  onParamsCommitted?: (params: AutoScheduleSavedParams) => void;
}

/**
 * 一鍵排班精靈（提示／參數／結果摘要）。
 * 虛擬空白與預覽覆蓋在全人員矩陣上，不在此 Modal 內完成。
 */
export const AutoScheduleWizardModal: React.FC<AutoScheduleWizardModalProps> = ({
  isOpen,
  onClose,
  initialStep = 'tip',
  startDate,
  endDate,
  currentSystem,
  companyCycleStartDate,
  shiftTypes,
  nationalHolidays,
  baselineEmployees,
  draftEmployees,
  onTipFinished,
  onPreviewResult,
  savedParams = null,
  onParamsCommitted,
}) => {
  const [step, setStep] = useState<WizardStep>(initialStep);
  const [dontShowTipAgain, setDontShowTipAgain] = useState(false);
  const [empConfigs, setEmpConfigs] = useState<AutoScheduleEmpConfig[]>([]);
  const [staffing, setStaffing] = useState<AutoScheduleStaffingNeed[]>([]);
  const [bonds, setBonds] = useState<AutoScheduleBondPair[]>([]);
  const [bondA, setBondA] = useState('');
  const [bondB, setBondB] = useState('');
  /** A：班多人少處理方式。 */
  const [shortagePolicy, setShortagePolicy] =
    useState<AutoScheduleShortagePolicy>('keep_empty');
  /** B：班少人多處理方式。 */
  const [surplusPolicy, setSurplusPolicy] =
    useState<AutoScheduleSurplusPolicy>('pack_work');
  const [result, setResult] = useState<AutoScheduleResult | null>(null);
  const [running, setRunning] = useState(false);
  /** 班別優先度拖拉來源：同仁 ID ＋ 在排序清單中的索引。 */
  const [dragPriority, setDragPriority] = useState<{
    empId: string;
    fromIndex: number;
  } | null>(null);

  const workShifts = useMemo(
    () => shiftTypes.filter((s) => s.category === 'work'),
    [shiftTypes]
  );

  /**
   * 僅在「開啟精靈」時初始化表單。
   * 不可依賴 savedParams：確認演算會立刻寫回快照，若重跑此 effect 會把步驟打回 config，看起來像沒跑。
   */
  useEffect(() => {
    if (!isOpen) return;
    setStep(initialStep);
    setResult(null);
    setRunning(false);
    setDontShowTipAgain(false);

    // 「調整參數」應還原上次確認演算時的設定；無快照才用預設
    const savedById = new Map(
      (savedParams?.empConfigs ?? []).map((c) => [c.employeeId, c])
    );
    setEmpConfigs(
      baselineEmployees.map((emp) => {
        const prev = savedById.get(emp.id);
        if (prev) {
          // 同步工作班清單：保留已存優先序，新班別附加於末
          const known = new Set(prev.shiftPriorities.map((p) => p.shiftTypeId));
          const kept = prev.shiftPriorities.filter((p) =>
            workShifts.some((s) => s.id === p.shiftTypeId)
          );
          const appended = workShifts
            .filter((s) => !known.has(s.id))
            .map((s) => ({ shiftTypeId: s.id, priority: 0 }));
          const merged = [...kept, ...appended].map((p, i) => ({
            shiftTypeId: p.shiftTypeId,
            priority: i + 1,
          }));
          return { ...prev, shiftPriorities: merged };
        }
        return {
          employeeId: emp.id,
          included: employeeHasPreScheduledShifts(
            emp,
            startDate,
            endDate,
            nationalHolidays
          ),
          shiftPriorities: workShifts.map((s, idx) => ({
            shiftTypeId: s.id,
            priority: idx + 1,
          })),
        };
      })
    );

    if (savedParams?.staffing?.length) {
      setStaffing(savedParams.staffing.map((s) => ({ ...s })));
    } else {
      const defaults: AutoScheduleStaffingNeed[] = [];
      WEEKDAYS.forEach((wd) => {
        workShifts.forEach((s) => {
          defaults.push({
            weekday: wd.value,
            shiftTypeId: s.id,
            headcount:
              wd.value === 0 || wd.value === 6 ? 0 : s.id === 'shift_morning' ? 1 : 0,
          });
        });
      });
      setStaffing(defaults);
    }

    setBonds(savedParams?.bonds?.map((b) => ({ ...b })) ?? []);
    setBondA(baselineEmployees[0]?.id || '');
    setBondB(baselineEmployees[1]?.id || '');
    setShortagePolicy(savedParams?.shortagePolicy ?? 'keep_empty');
    setSurplusPolicy(savedParams?.surplusPolicy ?? 'pack_work');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 刻意只在 isOpen／initialStep 變化時初始化
  }, [isOpen, initialStep]);

  if (!isOpen) return null;

  /**
   * 更新同仁是否納入。
   * @param empId 同仁
   * @param included 是否納入
   */
  const toggleIncluded = (empId: string, included: boolean) => {
    setEmpConfigs((prev) =>
      prev.map((c) => (c.employeeId === empId ? { ...c, included } : c))
    );
  };

  /**
   * 拖拉重排同仁班別優先度（越前者優先度越高＝數字越小）。
   * @param empId 同仁
   * @param fromIndex 拖曳起點索引
   * @param toIndex 放下位置索引
   */
  const reorderShiftPriorities = (
    empId: string,
    fromIndex: number,
    toIndex: number
  ) => {
    if (fromIndex === toIndex) return;
    setEmpConfigs((prev) =>
      prev.map((c) => {
        if (c.employeeId !== empId) return c;
        const ordered = [...c.shiftPriorities].sort(
          (a, b) => a.priority - b.priority
        );
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= ordered.length ||
          toIndex >= ordered.length
        ) {
          return c;
        }
        const next = [...ordered];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return {
          ...c,
          shiftPriorities: next.map((p, i) => ({
            shiftTypeId: p.shiftTypeId,
            priority: i + 1,
          })),
        };
      })
    );
  };

  /**
   * 將班別自參與清單移出（不再被指派該班）。
   * @param empId 同仁
   * @param shiftTypeId 班別
   */
  const removeShiftPriority = (empId: string, shiftTypeId: string) => {
    setEmpConfigs((prev) =>
      prev.map((c) => {
        if (c.employeeId !== empId) return c;
        const next = c.shiftPriorities
          .filter((p) => p.shiftTypeId !== shiftTypeId)
          .sort((a, b) => a.priority - b.priority)
          .map((p, i) => ({ shiftTypeId: p.shiftTypeId, priority: i + 1 }));
        return { ...c, shiftPriorities: next };
      })
    );
  };

  /**
   * 將班別加入參與清單（置於優先度最末）。
   * @param empId 同仁
   * @param shiftTypeId 班別
   */
  const addShiftPriority = (empId: string, shiftTypeId: string) => {
    setEmpConfigs((prev) =>
      prev.map((c) => {
        if (c.employeeId !== empId) return c;
        if (c.shiftPriorities.some((p) => p.shiftTypeId === shiftTypeId)) return c;
        const next = [
          ...c.shiftPriorities,
          { shiftTypeId, priority: c.shiftPriorities.length + 1 },
        ].map((p, i) => ({ shiftTypeId: p.shiftTypeId, priority: i + 1 }));
        return { ...c, shiftPriorities: next };
      })
    );
  };

  /**
   * 設定某星期×班別之人頭。
   * @param weekday 星期
   * @param shiftTypeId 班別
   * @param headcount 人數
   */
  const setHeadcount = (weekday: number, shiftTypeId: string, headcount: number) => {
    setStaffing((prev) => {
      const next = prev.filter(
        (s) => !(s.weekday === weekday && s.shiftTypeId === shiftTypeId)
      );
      next.push({ weekday, shiftTypeId, headcount: Math.max(0, headcount) });
      return next;
    });
  };

  /** 新增綁定配對。 */
  const addBond = () => {
    if (!bondA || !bondB || bondA === bondB) return;
    const exists = bonds.some(
      (b) =>
        (b.employeeIdA === bondA && b.employeeIdB === bondB) ||
        (b.employeeIdA === bondB && b.employeeIdB === bondA)
    );
    if (exists) return;
    setBonds((prev) => [...prev, { employeeIdA: bondA, employeeIdB: bondB }]);
  };

  /** 執行演算法並進入結果摘要（沿用矩陣草稿，不再整表清空）。 */
  const handleRun = () => {
    if (running) return;
    setRunning(true);
    window.setTimeout(() => {
      try {
        const working = draftEmployees ?? baselineEmployees;
        const snapshot: AutoScheduleSavedParams = {
          empConfigs: empConfigs.map((c) => ({
            ...c,
            shiftPriorities: c.shiftPriorities.map((p) => ({ ...p })),
          })),
          staffing: staffing.map((s) => ({ ...s })),
          bonds: bonds.map((b) => ({ ...b })),
          shortagePolicy,
          surplusPolicy,
        };
        const out = runAutoSchedule({
          startDate,
          endDate,
          systemType: currentSystem,
          companyCycleStartDate,
          shiftTypes,
          nationalHolidays,
          employees: working,
          baselineEmployees,
          empConfigs,
          staffing,
          bonds,
          skipInitialBlank: true,
          shortagePolicy,
          surplusPolicy,
        });
        // 演算成功後再寫快照（父層 state 變更不得重置本 Modal 步驟）
        onParamsCommitted?.(snapshot);
        setResult(out);
        setStep('result');
      } catch (err) {
        console.error('[AutoScheduleWizard] 演算失敗', err);
      } finally {
        setRunning(false);
      }
    }, 50);
  };

  const includedCount = empConfigs.filter((c) => c.included).length;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#E9E7D4] rounded-2xl max-w-3xl w-full p-6 shadow-xl text-[#2D2D2D] space-y-4 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 border-b border-[#E9E7D4] pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl border border-[#5A5A40]/20">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-serif">一鍵排班</h2>
              <p className="text-sm text-[#8A8A70]">
                區間 {startDate} ~ {endDate} · 公司週期起日 {companyCycleStartDate}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8A8A70] hover:bg-[#E9E7D4]"
            aria-label="關閉"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'tip' && (
          <div className="space-y-4">
            <div className="bg-[#F8F7EB] border border-[#E9E7D4] rounded-xl p-4 space-y-2 text-sm leading-relaxed">
              <p className="font-bold text-[#5A5A40] flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                流程簡要
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-[#2D2D2D]">
                <li>關閉後矩陣會覆蓋虛擬空白班表（保留國定假／補班），可用黑列與工具先確認預排。</li>
                <li>按「下一步」設定參加同仁、班別優先度、每日人力與綁定；可隨時關閉或取消整個預排。</li>
                <li>按「確認」由演算法排班，再到矩陣預覽；滿意後按「儲存」。未儲存就切換月曆等會遺失。</li>
              </ol>
              <p className="text-sm text-[#8A8A70] pt-1">
                演算法：先依法預留必休／例與連班斷點 → 填每日人力（偏好＋綁定）→ 合規不過則空班 → 再依
                A/B 處理缺口或過剩人力 → 最後優化連休。
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowTipAgain}
                onChange={(e) => setDontShowTipAgain(e.target.checked)}
              />
              下次不再顯示此提示
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-semibold px-4 py-2 rounded-xl bg-[#E9E7D4] text-[#5A5A40]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => onTipFinished(dontShowTipAgain)}
                className="bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-sm px-4 py-2 rounded-xl flex items-center gap-1"
              >
                開始預排
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'config' && (
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="text-sm font-bold text-[#5A5A40] flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                參加同仁（{includedCount}/{baselineEmployees.length}）
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {baselineEmployees.map((emp) => {
                  const cfg = empConfigs.find((c) => c.employeeId === emp.id);
                  if (!cfg) return null;
                  const orderedPriorities = [...cfg.shiftPriorities].sort(
                    (a, b) => a.priority - b.priority
                  );
                  const activeIds = new Set(orderedPriorities.map((p) => p.shiftTypeId));
                  const inactiveShifts = workShifts.filter((s) => !activeIds.has(s.id));
                  return (
                    <div
                      key={emp.id}
                      className="border border-[#E9E7D4] rounded-xl p-3 bg-[#F8F7EB] space-y-2"
                    >
                      <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cfg.included}
                          onChange={(e) => toggleIncluded(emp.id, e.target.checked)}
                        />
                        {emp.name}
                        <span className="font-normal text-[#8A8A70]">· {emp.role}</span>
                      </label>
                      {cfg.included && (
                        <div className="pl-6 space-y-2">
                          <p className="text-sm text-[#8A8A70] flex items-center gap-1">
                            <GripVertical className="w-3.5 h-3.5 shrink-0" />
                            參與班別（拖拉＝優先度；×＝移出）
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {orderedPriorities.map((p, index) => {
                              const s = workShifts.find((w) => w.id === p.shiftTypeId);
                              if (!s) return null;
                              return (
                                <div
                                  key={s.id}
                                  draggable
                                  onDragStart={() =>
                                    setDragPriority({ empId: emp.id, fromIndex: index })
                                  }
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={() => {
                                    if (
                                      dragPriority &&
                                      dragPriority.empId === emp.id
                                    ) {
                                      reorderShiftPriorities(
                                        emp.id,
                                        dragPriority.fromIndex,
                                        index
                                      );
                                    }
                                    setDragPriority(null);
                                  }}
                                  onDragEnd={() => setDragPriority(null)}
                                  className={`inline-flex items-center gap-1 text-sm bg-white border border-[#D9D7C2] rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing select-none shadow-sm ${
                                    dragPriority?.empId === emp.id &&
                                    dragPriority.fromIndex === index
                                      ? 'opacity-50 ring-2 ring-[#5A5A40]'
                                      : ''
                                  }`}
                                  title={`優先度 ${p.priority}：拖拉調整；按 × 移出`}
                                >
                                  <GripVertical className="w-3.5 h-3.5 text-[#8A8A70]" />
                                  <span className="font-mono text-[#8A8A70] text-xs w-3">
                                    {p.priority}
                                  </span>
                                  <span
                                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                                    style={{ backgroundColor: s.color }}
                                  />
                                  {s.code}
                                  <button
                                    type="button"
                                    className="ml-0.5 text-[#8A8A70] hover:text-red-600 font-bold leading-none"
                                    title="移出此班別"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeShiftPriority(emp.id, s.id);
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              );
                            })}
                            {orderedPriorities.length === 0 && (
                              <span className="text-sm text-amber-800">尚未選擇可排班別</span>
                            )}
                          </div>
                          {inactiveShifts.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-sm text-[#8A8A70]">未參與（點擊移入）</p>
                              <div className="flex flex-wrap gap-2">
                                {inactiveShifts.map((s) => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => addShiftPriority(emp.id, s.id)}
                                    className="inline-flex items-center gap-1.5 text-sm bg-white/60 border border-dashed border-[#D9D7C2] rounded-lg px-2 py-1.5 text-[#8A8A70] hover:border-[#5A5A40] hover:text-[#2D2D2D]"
                                    title="移入參與排班"
                                  >
                                    <span
                                      className="w-2.5 h-2.5 rounded-sm shrink-0 opacity-70"
                                      style={{ backgroundColor: s.color }}
                                    />
                                    {s.code}
                                    <span className="font-bold">＋</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-bold text-[#5A5A40]">每日人力（星期 × 班別人數）</h3>
              <p className="text-sm text-[#8A8A70]">
                以「每個星期幾、各班別需要幾人」設定（非週期總工時）。法規工時／例休則由合規規則檢查。
              </p>
              <div className="overflow-x-auto border border-[#E9E7D4] rounded-xl">
                <table className="w-full text-sm text-center">
                  <thead className="bg-[#F8F7EB]">
                    <tr>
                      <th className="p-2 border-b border-[#E9E7D4]">班別＼週</th>
                      {WEEKDAYS.map((wd) => (
                        <th key={wd.value} className="p-2 border-b border-[#E9E7D4]">
                          {wd.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {workShifts.map((s) => (
                      <tr key={s.id}>
                        <td className="p-1.5 border-t border-[#E9E7D4] font-bold">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-white"
                            style={{ backgroundColor: s.color }}
                          >
                            {s.code}
                          </span>
                        </td>
                        {WEEKDAYS.map((wd) => {
                          const cell = staffing.find(
                            (x) =>
                              x.weekday === wd.value && x.shiftTypeId === s.id
                          );
                          return (
                            <td key={wd.value} className="p-1 border-t border-[#E9E7D4]">
                              <input
                                type="number"
                                min={0}
                                max={99}
                                value={cell?.headcount ?? 0}
                                onChange={(e) =>
                                  setHeadcount(
                                    wd.value,
                                    s.id,
                                    Number(e.target.value) || 0
                                  )
                                }
                                className="w-12 mx-auto block bg-[#F8F7EB] border border-[#D9D7C2] rounded px-1 py-0.5 font-mono"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-bold text-[#5A5A40]">人力過／不足處理</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <fieldset className="border border-[#E9E7D4] rounded-xl p-3 space-y-2 bg-[#F8F7EB]">
                  <legend className="text-sm font-bold text-[#5A5A40] px-1">
                    A．班多／人少
                  </legend>
                  <p className="text-sm text-[#8A8A70]">需求人數大於可排人力時。</p>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="shortagePolicy"
                      className="mt-0.5"
                      checked={shortagePolicy === 'keep_empty'}
                      onChange={() => setShortagePolicy('keep_empty')}
                    />
                    <span>
                      <span className="font-semibold">遵循規則，排不了就空班</span>
                      <span className="block text-[#8A8A70]">（預設）不合規或無人可派則留下缺口</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="shortagePolicy"
                      className="mt-0.5"
                      checked={shortagePolicy === 'relax_pref'}
                      onChange={() => setShortagePolicy('relax_pref')}
                    />
                    <span>
                      <span className="font-semibold">合規下忽略班別偏好補人</span>
                      <span className="block text-[#8A8A70]">
                        偏好內找不到人時，改派其他納入同仁（仍不合規則空班）
                      </span>
                    </span>
                  </label>
                </fieldset>

                <fieldset className="border border-[#E9E7D4] rounded-xl p-3 space-y-2 bg-[#F8F7EB]">
                  <legend className="text-sm font-bold text-[#5A5A40] px-1">
                    B．班少／人多
                  </legend>
                  <p className="text-sm text-[#8A8A70]">可排人力大於需求人數時。</p>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="surplusPolicy"
                      className="mt-0.5"
                      checked={surplusPolicy === 'pack_work'}
                      onChange={() => setSurplusPolicy('pack_work')}
                    />
                    <span>
                      <span className="font-semibold">合規下塞入偏好工作班</span>
                      <span className="block text-[#8A8A70]">
                        （預設）即使該日該班已達標，仍可依偏好加塞（合規不過則不塞）
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="surplusPolicy"
                      className="mt-0.5"
                      checked={surplusPolicy === 'prefer_off'}
                      onChange={() => setSurplusPolicy('prefer_off')}
                    />
                    <span>
                      <span className="font-semibold">多餘改排空／休／例</span>
                      <span className="block text-[#8A8A70]">
                        不超過人力需求，剩餘格子優化連休（不行則空班）
                      </span>
                    </span>
                  </label>
                </fieldset>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-bold text-[#5A5A40] flex items-center gap-1.5">
                <Link2 className="w-4 h-4" />
                優先綁定同仁
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={bondA}
                  onChange={(e) => setBondA(e.target.value)}
                  className="bg-white border border-[#D9D7C2] rounded-lg px-2 py-1 text-sm"
                >
                  {baselineEmployees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <span className="text-sm">＋</span>
                <select
                  value={bondB}
                  onChange={(e) => setBondB(e.target.value)}
                  className="bg-white border border-[#D9D7C2] rounded-lg px-2 py-1 text-sm"
                >
                  {baselineEmployees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addBond}
                  className="text-sm font-bold bg-[#E9E7D4] hover:bg-[#D9D7C2] px-3 py-1 rounded-lg"
                >
                  加入
                </button>
              </div>
              <ul className="text-sm space-y-1">
                {bonds.map((b, idx) => {
                  const a = baselineEmployees.find((e) => e.id === b.employeeIdA)?.name;
                  const bb = baselineEmployees.find((e) => e.id === b.employeeIdB)?.name;
                  return (
                    <li
                      key={`${b.employeeIdA}-${b.employeeIdB}`}
                      className="flex items-center justify-between bg-[#F8F7EB] rounded-lg px-2 py-1"
                    >
                      <span>
                        {a} ↔ {bb}
                      </span>
                      <button
                        type="button"
                        className="text-sm text-red-600"
                        onClick={() =>
                          setBonds((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        移除
                      </button>
                    </li>
                  );
                })}
                {bonds.length === 0 && (
                  <li className="text-sm text-[#8A8A70]">尚未設定綁定</li>
                )}
              </ul>
            </section>

            <div className="flex justify-between pt-1">
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-semibold text-[#5A5A40] px-3 py-2"
              >
                關閉（可稍後再下一步，或取消預排）
              </button>
              <button
                type="button"
                disabled={includedCount === 0 || running}
                onClick={handleRun}
                className="bg-[#5A5A40] hover:bg-[#484833] disabled:opacity-40 text-white font-bold text-sm px-4 py-2 rounded-xl flex items-center gap-1"
              >
                {running ? '計算中…' : '確認'}
                <Wand2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="bg-[#F8F7EB] border border-[#E9E7D4] rounded-xl p-3">
                <div className="text-sm text-[#8A8A70]">連休評分</div>
                <div className="text-lg font-bold font-mono">{result.consecutiveOffScore}</div>
              </div>
              <div className="bg-[#F8F7EB] border border-[#E9E7D4] rounded-xl p-3">
                <div className="text-sm text-[#8A8A70]">休假天數合計</div>
                <div className="text-lg font-bold font-mono">{result.totalOffDays}</div>
              </div>
              <div className="bg-[#F8F7EB] border border-[#E9E7D4] rounded-xl p-3">
                <div className="text-sm text-[#8A8A70]">合規警示同仁</div>
                <div className="text-lg font-bold font-mono">
                  {result.employeesWithViolations}
                </div>
              </div>
            </div>

            {result.uncovered.length > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm space-y-1">
                <p className="font-bold text-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  人力缺口（{result.uncovered.length} 筆）
                </p>
                <ul className="max-h-28 overflow-y-auto text-sm text-amber-900 space-y-0.5">
                  {result.uncovered.slice(0, 20).map((u, i) => {
                    const code =
                      shiftTypes.find((s) => s.id === u.shiftTypeId)?.code ||
                      u.shiftTypeId;
                    return (
                      <li key={`${u.date}-${u.shiftTypeId}-${i}`}>
                        {u.date} · {code} 缺 {u.missing} 人
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                已滿足所設定之每日班別人數需求
              </div>
            )}

            <p className="text-sm text-[#8A8A70]">
              按「到矩陣預覽」後可檢視結果；滿意再按矩陣下方的「儲存」。未儲存就離開會遺失預排。
            </p>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep('config')}
                className="text-sm font-semibold text-[#5A5A40]"
              >
                回參數
              </button>
              <button
                type="button"
                onClick={() => onPreviewResult(result)}
                className="bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-sm px-4 py-2 rounded-xl"
              >
                到矩陣預覽
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
