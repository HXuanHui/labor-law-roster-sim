import React, { useState, useEffect } from 'react';
import { LaborRuleViolation, ScheduleSystemType } from '../types';
import { SYSTEM_CONFIGS } from '../constants/systems';
import { MAX_MONTHLY_OVERTIME_HOURS } from '../constants/overtime';
import { ShieldCheck, AlertTriangle, AlertCircle, Info, Calendar, Clock, Scale, X, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * 班表檢核面板屬性。
 */
interface LaborAuditPanelProps {
  /** 目前工時制度。 */
  systemType: ScheduleSystemType;
  /** 違規清單。 */
  violations: LaborRuleViolation[];
  /** 本週期正常工時合計（不含延長）。 */
  totalWorkHours: number;
  /** 本月延長工時合計。 */
  totalOvertimeHours: number;
  /** 最長連續工作天數。 */
  maxConsecutiveDays: number;
  /** 例假日天數。 */
  mandatoryOffCount: number;
  /** 休息日天數。 */
  restDayCount: number;
  /** 國定假日出勤天數。 */
  nationalHolidayWorkCount: number;
  /** 點擊違規項高亮日期。 */
  onHighlightDates?: (dates: string[]) => void;
}

export const LaborAuditPanel: React.FC<LaborAuditPanelProps> = ({
  systemType,
  violations,
  totalWorkHours,
  totalOvertimeHours,
  maxConsecutiveDays,
  mandatoryOffCount,
  restDayCount,
  nationalHolidayWorkCount,
  onHighlightDates,
}) => {
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const config = SYSTEM_CONFIGS[systemType];
  const hasErrors = violations.some((v) => v.severity === 'error');
  const hasWarnings = violations.some((v) => v.severity === 'warning');

  // Auto-expand whenever there are violation items (>0)
  useEffect(() => {
    if (violations.length > 0) {
      setIsCollapsed(false);
    }
  }, [violations.length]);

  return (
    <div id="labor-audit-panel" className="bg-white border border-[#E9E7D4] rounded-2xl p-4 sm:p-5 shadow-sm text-[#2D2D2D] space-y-4">
      {/* Top Banner Status Header (Clickable to Toggle Collapse/Expand) */}
      <div
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E9E7D4] pb-3.5 mb-2 cursor-pointer select-none hover:bg-[#F8F7EB]/80 transition-colors rounded-xl px-2.5 py-2 -mx-2.5 -mt-2"
        title={isCollapsed ? "點擊展開班表檢核表" : "點擊縮小班表檢核表"}
      >
        <div className="flex items-center space-x-3">
          <div>
            <h2 className="text-base font-bold text-[#2D2D2D] flex items-center gap-2">
              <span>班表檢核表</span>
              <span className="text-sm text-[#8A8A70] font-normal">
                ({isCollapsed ? '點擊展開' : '點擊縮小'})
              </span>
            </h2>
            {(hasErrors || hasWarnings) && (
              <p className="text-sm text-[#8A8A70]">
                {hasErrors
                  ? `模擬檢核發現 ${violations.filter((v) => v.severity === 'error').length} 項需優先留意（將啟用平移卡位保護）`
                  : `模擬檢核發現 ${violations.filter((v) => v.severity === 'warning').length} 項規則提醒`}
              </p>
            )}
          </div>
        </div>

        {/* Quick Summary Pill & Legal Rules Trigger */}
        <div className="flex items-center space-x-2">
          {violations.length > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsLegalModalOpen(true);
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                hasErrors
                  ? 'bg-[#D17A60]/15 text-[#D17A60] border border-[#D17A60]/30 hover:bg-[#D17A60]/25'
                  : 'bg-[#D9A05B]/15 text-[#D9A05B] border border-[#D9A05B]/30 hover:bg-[#D9A05B]/25'
              }`}
              title="點擊查看此工時制度之規則說明（模擬提示，非正式結論）"
            >
              {hasErrors ? (
                <AlertCircle className="w-3.5 h-3.5 text-[#D17A60]" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-[#D9A05B]" />
              )}
              <span>模擬檢核：發現 {violations.length} 項需留意（點擊查看法規說明）</span>
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsLegalModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-full text-sm font-semibold bg-[#4A7C59]/15 text-[#4A7C59] border border-[#4A7C59]/30 flex items-center gap-1.5 hover:bg-[#4A7C59]/25 transition-colors cursor-pointer shadow-sm"
              title="點擊查看此工時制度之規則說明（模擬提示，非正式結論）"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#4A7C59]" />
              <span>模擬檢核：無觸發項目（點擊查看法規說明）</span>
            </button>
          )}

          <div className="p-1 rounded-lg text-[#5A5A40] hover:bg-[#E9E7D4] transition-colors">
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* 關鍵指標：正常工時（隨制度）＋延長工時（月上限 46H） */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            {/* Metric 1: 週期正常工時 */}
            <div
              className={`p-3 rounded-xl border ${
                totalWorkHours > config.maxNormalHoursPerCycle
                  ? 'bg-[#D17A60]/10 border-[#D17A60]/30 text-[#2D2D2D]'
                  : 'bg-[#F8F7EB] border-[#E9E7D4] text-[#2D2D2D]'
              }`}
            >
              <div className="flex items-center justify-between text-sm text-[#8A8A70] mb-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#5A5A40]" /> 正常工時
                </span>
                <span className="text-xs font-mono">最多 {config.maxNormalHoursPerCycle}H</span>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-black font-mono text-[#5A5A40]">{totalWorkHours}</span>
                <span className="text-sm text-[#8A8A70]">小時</span>
              </div>
              <div className="text-xs text-[#8A8A70] mt-1">
                {config.name}／{config.cycleDays} 天週期
              </div>
              <div className="w-full bg-[#E9E7D4] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    totalWorkHours > config.maxNormalHoursPerCycle ? 'bg-[#D17A60]' : 'bg-[#5A5A40]'
                  }`}
                  style={{
                    width: `${Math.min(100, (totalWorkHours / config.maxNormalHoursPerCycle) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Metric 2: 當月延長工時 */}
            <div
              className={`p-3 rounded-xl border ${
                totalOvertimeHours > MAX_MONTHLY_OVERTIME_HOURS
                  ? 'bg-[#D17A60]/10 border-[#D17A60]/30 text-[#2D2D2D]'
                  : 'bg-[#F8F7EB] border-[#E9E7D4] text-[#2D2D2D]'
              }`}
            >
              <div className="flex items-center justify-between text-sm text-[#8A8A70] mb-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#D9A05B]" /> 延長工時
                </span>
                <span className="text-xs font-mono">最多 {MAX_MONTHLY_OVERTIME_HOURS}H</span>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-black font-mono text-[#D9A05B]">{totalOvertimeHours}</span>
                <span className="text-sm text-[#8A8A70]">小時</span>
              </div>
              <div className="text-xs text-[#8A8A70] mt-1">本月累計（勞基法第32條）</div>
              <div className="w-full bg-[#E9E7D4] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    totalOvertimeHours > MAX_MONTHLY_OVERTIME_HOURS ? 'bg-[#D17A60]' : 'bg-[#D9A05B]'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      (totalOvertimeHours / MAX_MONTHLY_OVERTIME_HOURS) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Metric 3: Max Consecutive Work Days */}
            <div
              className={`p-3 rounded-xl border ${
                maxConsecutiveDays > config.maxConsecutiveWorkDays
                  ? 'bg-[#D17A60]/10 border-[#D17A60]/30 text-[#2D2D2D]'
                  : 'bg-[#F8F7EB] border-[#E9E7D4] text-[#2D2D2D]'
              }`}
            >
              <div className="flex items-center justify-between text-sm text-[#8A8A70] mb-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#D17A60]" /> 最長連續工作天數
                </span>
                <span className="text-xs font-mono">上限 {config.maxConsecutiveWorkDays}天</span>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-black font-mono text-[#5A5A40]">{maxConsecutiveDays}</span>
                <span className="text-sm text-[#8A8A70]">連班</span>
              </div>
              <div className="w-full bg-[#E9E7D4] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    maxConsecutiveDays > config.maxConsecutiveWorkDays ? 'bg-[#D17A60]' : 'bg-[#5A5A40]'
                  }`}
                  style={{
                    width: `${Math.min(100, (maxConsecutiveDays / config.maxConsecutiveWorkDays) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Metric 4: Mandatory Off Days (例假日) */}
            <div
              className={`p-3 rounded-xl border ${
                mandatoryOffCount < config.minMandatoryOffPerCycle
                  ? 'bg-[#D17A60]/10 border-[#D17A60]/30 text-[#2D2D2D]'
                  : 'bg-[#F8F7EB] border-[#E9E7D4] text-[#2D2D2D]'
              }`}
            >
              <div className="flex items-center justify-between text-sm text-[#8A8A70] mb-1">
                <span className="flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-[#D17A60]" /> 例假日數 (例)
                </span>
                <span className="text-xs font-mono">最少 {config.minMandatoryOffPerCycle}天</span>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-black font-mono text-[#D17A60]">{mandatoryOffCount}</span>
                <span className="text-sm text-[#8A8A70]">天</span>
              </div>
              <div className="text-xs text-[#8A8A70] mt-1">
                {mandatoryOffCount >= config.minMandatoryOffPerCycle ? '✅ 達最小例假天數' : '❌ 例假天數不足'}
                {restDayCount < config.minRestDaysPerCycle
                  ? `／休息日 ${restDayCount}/${config.minRestDaysPerCycle}`
                  : ''}
              </div>
            </div>
          </div>

          {/* Itemized Violation List */}
          {violations.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#E9E7D4]">
              <div className="text-sm font-bold text-[#2D2D2D] flex items-center justify-between">
                <span>規則檢核明細／風險提示 ({violations.length})</span>
                <span className="text-sm text-[#8A8A70]">點擊項目可於日曆中標示日期</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {violations.map((v, idx) => (
                  <div
                    key={idx}
                    onClick={() => v.dates && onHighlightDates && onHighlightDates(v.dates)}
                    className={`p-3 rounded-xl border text-sm cursor-pointer transition-all hover:scale-[1.01] ${
                      v.severity === 'error'
                        ? 'bg-[#D17A60]/10 border-[#D17A60]/30 hover:bg-[#D17A60]/15 text-[#2D2D2D]'
                        : 'bg-[#D9A05B]/10 border-[#D9A05B]/30 hover:bg-[#D9A05B]/15 text-[#2D2D2D]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                            v.severity === 'error' ? 'bg-[#D17A60] text-white' : 'bg-[#D9A05B] text-white'
                          }`}
                        >
                          {v.article}
                        </span>
                        <span>{v.title}</span>
                      </div>
                      {v.dates && v.dates.length > 0 && (
                        <span className="text-xs text-[#5A5A40] underline">
                          對應日期 ({v.dates.length}天)
                        </span>
                      )}
                    </div>
                    <p className="text-[#2D2D2D] leading-relaxed text-sm">{v.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* National Holiday Work Notification */}
          {nationalHolidayWorkCount > 0 && (
            <div className="bg-[#5A5A40]/10 border border-[#5A5A40]/20 p-2.5 rounded-xl text-sm text-[#2D2D2D] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Info className="w-4 h-4 text-[#5A5A40] flex-shrink-0" />
                <span>
                  目前班表有 <strong>{nationalHolidayWorkCount}</strong> 天於國定假日出勤，依勞基法第39條規定，工資應加倍發給或給予補休。
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Legal Rules Explanation Modal */}
      {isLegalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#E9E7D4] rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 text-[#2D2D2D] relative animate-in fade-in zoom-in-95 duration-200 text-base">
            <button
              onClick={() => setIsLegalModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-[#8A8A70] hover:text-[#2D2D2D] rounded-lg hover:bg-[#F8F7EB] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 pr-8">
              <div className="p-2.5 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl border border-[#5A5A40]/20">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#2D2D2D]">{config.name}</h3>
                <span className="text-base text-[#8A8A70] font-mono">{config.legalBasis}</span>
              </div>
            </div>

            <div className="bg-[#F8F7EB] p-3 rounded-xl border border-[#E9E7D4] text-base text-[#2D2D2D] space-y-1">
              <span className="font-bold text-[#5A5A40]">適用產業 / 行業類型：</span>
              <p className="text-[#8A8A70] leading-relaxed">{config.applicableIndustries}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-base">
              <div className="bg-[#F8F7EB] p-2.5 rounded-xl border border-[#E9E7D4]">
                <div className="text-sm text-[#8A8A70] mb-0.5">每週期正常總工時</div>
                <div className="font-bold text-[#5A5A40] font-mono">
                  {config.maxNormalHoursPerCycle} 小時 / {config.cycleDays} 日
                </div>
              </div>
              <div className="bg-[#F8F7EB] p-2.5 rounded-xl border border-[#E9E7D4]">
                <div className="text-sm text-[#8A8A70] mb-0.5">單日正常工時上限</div>
                <div className="font-bold text-[#5A5A40] font-mono">
                  至多 {config.maxDailyNormalHours} 小時
                </div>
              </div>
              <div className="bg-[#F8F7EB] p-2.5 rounded-xl border border-[#E9E7D4]">
                <div className="text-sm text-[#8A8A70] mb-0.5">連續工作天數限制</div>
                <div className="font-bold text-[#D17A60] font-mono">
                  不得連續工作超過 {config.maxConsecutiveWorkDays} 天
                </div>
              </div>
              <div className="bg-[#F8F7EB] p-2.5 rounded-xl border border-[#E9E7D4]">
                <div className="text-sm text-[#8A8A70] mb-0.5">每週期至少休息日與例假</div>
                <div className="font-bold text-[#4A7C59] font-mono">
                  {config.minMandatoryOffPerCycle} 例假 + {config.minRestDaysPerCycle} 休息日
                </div>
              </div>
            </div>

            {/* 放假日出勤：與頂部「法規說明」一致之精簡摘要 */}
            <div className="bg-[#D9A05B]/10 border border-[#D9A05B]/30 p-3 rounded-xl text-sm text-[#2D2D2D] space-y-1.5">
              <div className="font-bold text-[#5A5A40]">放假日加班（勞基法第36、39、40條）</div>
              <p>
                休息日／休假（含國定假日）經同意可出勤加班；
                <strong className="font-bold">例假原則禁止</strong>
                ，僅天災、事變或突發事件例外，並應加給工資、事後給假且報備。本模擬不計算加班費。
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsLegalModalOpen(false)}
                className="px-4 py-2 bg-[#5A5A40] hover:bg-[#484833] text-white text-base font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                關閉法規說明
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
