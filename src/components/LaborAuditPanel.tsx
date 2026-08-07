import React, { useState, useEffect } from 'react';
import { LaborRuleViolation, ScheduleSystemType } from '../types';
import { SYSTEM_CONFIGS } from '../constants/systems';
import { ShieldCheck, AlertTriangle, AlertCircle, Info, Calendar, Clock, Scale, X, ChevronDown, ChevronUp } from 'lucide-react';

interface LaborAuditPanelProps {
  systemType: ScheduleSystemType;
  violations: LaborRuleViolation[];
  totalWorkHours: number;
  maxConsecutiveDays: number;
  mandatoryOffCount: number;
  restDayCount: number;
  nationalHolidayWorkCount: number;
  onHighlightDates?: (dates: string[]) => void;
}

export const LaborAuditPanel: React.FC<LaborAuditPanelProps> = ({
  systemType,
  violations,
  totalWorkHours,
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
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E9E7D4] pb-3 cursor-pointer select-none hover:bg-[#F8F7EB]/80 transition-colors rounded-xl p-2 -m-2"
        title={isCollapsed ? "點擊展開班表檢核表" : "點擊縮小班表檢核表"}
      >
        <div className="flex items-center space-x-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              hasErrors
                ? 'bg-[#D17A60]/15 text-[#D17A60] border border-[#D17A60]/30'
                : hasWarnings
                ? 'bg-[#D9A05B]/15 text-[#D9A05B] border border-[#D9A05B]/30'
                : 'bg-[#4A7C59]/15 text-[#4A7C59] border border-[#4A7C59]/30'
            }`}
          >
            {hasErrors ? (
              <AlertCircle className="w-5 h-5 animate-pulse" />
            ) : hasWarnings ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#2D2D2D] flex items-center gap-2">
              <span>班表檢核表</span>
              <span className="text-[11px] text-[#8A8A70] font-normal">
                ({isCollapsed ? '點擊展開' : '點擊縮小'})
              </span>
            </h2>
            {(hasErrors || hasWarnings) && (
              <p className="text-xs text-[#8A8A70]">
                {hasErrors
                  ? `存在 ${violations.filter((v) => v.severity === 'error').length} 項嚴重勞檢違規（將導致平移卡位保護）`
                  : `存在 ${violations.filter((v) => v.severity === 'warning').length} 項勞基法提醒提示`}
              </p>
            )}
          </div>
        </div>

        {/* Quick Summary Pill & Legal Rules Trigger */}
        <div className="flex items-center space-x-2">
          {hasErrors ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsLegalModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#D17A60]/15 text-[#D17A60] border border-[#D17A60]/30 flex items-center gap-1.5 hover:bg-[#D17A60]/25 transition-colors cursor-pointer"
              title="點擊查看此工時制度之勞基法說明"
            >
              <AlertCircle className="w-3.5 h-3.5 text-[#D17A60]" />
              <span>勞檢未通過 (點擊查看法規說明)</span>
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsLegalModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#4A7C59]/15 text-[#4A7C59] border border-[#4A7C59]/30 flex items-center gap-1.5 hover:bg-[#4A7C59]/25 transition-colors cursor-pointer shadow-sm"
              title="點擊查看此工時制度之勞基法說明"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#4A7C59]" />
              <span>完全合規 (點擊查看法規說明)</span>
            </button>
          )}

          <div className="p-1 rounded-lg text-[#5A5A40] hover:bg-[#E9E7D4] transition-colors">
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* 4 Key Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Metric 1: Cycle Normal Hours */}
            <div
              className={`p-3 rounded-xl border ${
                totalWorkHours > config.maxNormalHoursPerCycle
                  ? 'bg-[#D17A60]/10 border-[#D17A60]/30 text-[#2D2D2D]'
                  : 'bg-[#F8F7EB] border-[#E9E7D4] text-[#2D2D2D]'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-[#8A8A70] mb-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#5A5A40]" /> 週期總正常工時
                </span>
                <span className="text-[10px] font-mono">上限 {config.maxNormalHoursPerCycle}H</span>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-black font-mono text-[#5A5A40]">{totalWorkHours}</span>
                <span className="text-xs text-[#8A8A70]">小時</span>
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

            {/* Metric 2: Max Consecutive Work Days */}
            <div
              className={`p-3 rounded-xl border ${
                maxConsecutiveDays > config.maxConsecutiveWorkDays
                  ? 'bg-[#D17A60]/10 border-[#D17A60]/30 text-[#2D2D2D]'
                  : 'bg-[#F8F7EB] border-[#E9E7D4] text-[#2D2D2D]'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-[#8A8A70] mb-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#D17A60]" /> 最長連續工作天數
                </span>
                <span className="text-[10px] font-mono">上限 {config.maxConsecutiveWorkDays}天</span>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-black font-mono text-[#5A5A40]">{maxConsecutiveDays}</span>
                <span className="text-xs text-[#8A8A70]">連班</span>
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

            {/* Metric 3: Mandatory Off Days (例假日) */}
            <div
              className={`p-3 rounded-xl border ${
                mandatoryOffCount < config.minMandatoryOffPerCycle
                  ? 'bg-[#D17A60]/10 border-[#D17A60]/30 text-[#2D2D2D]'
                  : 'bg-[#F8F7EB] border-[#E9E7D4] text-[#2D2D2D]'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-[#8A8A70] mb-1">
                <span className="flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-[#D17A60]" /> 例假日數 (例)
                </span>
                <span className="text-[10px] font-mono">最少 {config.minMandatoryOffPerCycle}天</span>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-black font-mono text-[#D17A60]">{mandatoryOffCount}</span>
                <span className="text-xs text-[#8A8A70]">天</span>
              </div>
              <div className="text-[10px] text-[#8A8A70] mt-1">
                {mandatoryOffCount >= config.minMandatoryOffPerCycle ? '✅ 符合法定例假' : '❌ 天數不足'}
              </div>
            </div>

            {/* Metric 4: Rest Days (休息日) */}
            <div
              className={`p-3 rounded-xl border ${
                restDayCount < config.minRestDaysPerCycle
                  ? 'bg-[#D9A05B]/10 border-[#D9A05B]/30 text-[#2D2D2D]'
                  : 'bg-[#F8F7EB] border-[#E9E7D4] text-[#2D2D2D]'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-[#8A8A70] mb-1">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#4A7C59]" /> 休息日數 (休)
                </span>
                <span className="text-[10px] font-mono">應有 {config.minRestDaysPerCycle}天</span>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-black font-mono text-[#4A7C59]">{restDayCount}</span>
                <span className="text-xs text-[#8A8A70]">天</span>
              </div>
              <div className="text-[10px] text-[#8A8A70] mt-1">
                {restDayCount >= config.minRestDaysPerCycle ? '✅ 休息日足額' : '⚠️ 需核算出勤加班費'}
              </div>
            </div>
          </div>

          {/* Itemized Violation List */}
          {violations.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#E9E7D4]">
              <div className="text-xs font-bold text-[#2D2D2D] flex items-center justify-between">
                <span>勞動檢查診斷明細項目 ({violations.length})</span>
                <span className="text-[11px] text-[#8A8A70]">點擊項目可於日曆中標示日期</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {violations.map((v, idx) => (
                  <div
                    key={idx}
                    onClick={() => v.dates && onHighlightDates && onHighlightDates(v.dates)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all hover:scale-[1.01] ${
                      v.severity === 'error'
                        ? 'bg-[#D17A60]/10 border-[#D17A60]/30 hover:bg-[#D17A60]/15 text-[#2D2D2D]'
                        : 'bg-[#D9A05B]/10 border-[#D9A05B]/30 hover:bg-[#D9A05B]/15 text-[#2D2D2D]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                            v.severity === 'error' ? 'bg-[#D17A60] text-white' : 'bg-[#D9A05B] text-white'
                          }`}
                        >
                          {v.article}
                        </span>
                        <span>{v.title}</span>
                      </div>
                      {v.dates && v.dates.length > 0 && (
                        <span className="text-[10px] text-[#5A5A40] underline">
                          對應日期 ({v.dates.length}天)
                        </span>
                      )}
                    </div>
                    <p className="text-[#2D2D2D] leading-relaxed text-[11px]">{v.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* National Holiday Work Notification */}
          {nationalHolidayWorkCount > 0 && (
            <div className="bg-[#5A5A40]/10 border border-[#5A5A40]/20 p-2.5 rounded-xl text-xs text-[#2D2D2D] flex items-center justify-between">
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
          <div className="bg-white border border-[#E9E7D4] rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 text-[#2D2D2D] relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsLegalModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-[#8A8A70] hover:text-[#2D2D2D] rounded-lg hover:bg-[#F8F7EB] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl border border-[#5A5A40]/20">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#2D2D2D]">
                  {config.name} — 勞動基準法規範細則
                </h3>
                <span className="text-xs text-[#8A8A70] font-mono">{config.legalBasis}</span>
              </div>
            </div>

            <div className="bg-[#F8F7EB] p-3 rounded-xl border border-[#E9E7D4] text-xs text-[#2D2D2D] space-y-1">
              <span className="font-bold text-[#5A5A40]">適用產業 / 行業類型：</span>
              <p className="text-[#8A8A70]">{config.applicableIndustries}</p>
            </div>

            <p className="text-xs text-[#2D2D2D] leading-relaxed">
              {config.description}
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#F8F7EB] p-2.5 rounded-xl border border-[#E9E7D4]">
                <div className="text-[10px] text-[#8A8A70] mb-0.5">每週期正常總工時</div>
                <div className="text-sm font-bold text-[#5A5A40] font-mono">
                  {config.maxNormalHoursPerCycle} 小時 / {config.cycleDays} 日
                </div>
              </div>
              <div className="bg-[#F8F7EB] p-2.5 rounded-xl border border-[#E9E7D4]">
                <div className="text-[10px] text-[#8A8A70] mb-0.5">單日正常工時上限</div>
                <div className="text-sm font-bold text-[#5A5A40] font-mono">
                  至多 {config.maxDailyNormalHours} 小時
                </div>
              </div>
              <div className="bg-[#F8F7EB] p-2.5 rounded-xl border border-[#E9E7D4]">
                <div className="text-[10px] text-[#8A8A70] mb-0.5">連續工作天數限制</div>
                <div className="text-sm font-bold text-[#D17A60] font-mono">
                  不得連續工作超過 {config.maxConsecutiveWorkDays} 天
                </div>
              </div>
              <div className="bg-[#F8F7EB] p-2.5 rounded-xl border border-[#E9E7D4]">
                <div className="text-[10px] text-[#8A8A70] mb-0.5">每週期至少休息日與例假</div>
                <div className="text-sm font-bold text-[#4A7C59] font-mono">
                  {config.minMandatoryOffPerCycle} 例假 + {config.minRestDaysPerCycle} 休息日
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsLegalModalOpen(false)}
                className="px-4 py-2 bg-[#5A5A40] hover:bg-[#484833] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
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
