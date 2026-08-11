import React, { useEffect, useRef, useState } from 'react';
import { ShiftType } from '../types';
import {
  ChevronLeft,
  ChevronRight,
  GripHorizontal,
  AlertTriangle,
  Pin,
  Plus,
  Minus,
} from 'lucide-react';
import { OVERTIME_STEP_HOURS, getMaxDailyOvertimeHours, canLogOvertimeOnCategory } from '../constants/overtime';
import { getContrastingTextColor } from '../utils/colorContrast';

/**
 * 班別色塊方塊屬性。
 */
interface ShiftBlockTileProps {
  /** 對應日期字串 (YYYY-MM-DD)。 */
  dateStr: string;
  /** 目前套用的班別；未排班時為 undefined。 */
  shiftType: ShiftType | undefined;
  /** 班別左右平移回呼。 */
  onSlideShift: (dateStr: string, direction: 'left' | 'right') => void;
  /** 是否釘選鎖定。 */
  isPinned?: boolean;
  /** 切換釘選回呼。 */
  onTogglePin?: (dateStr: string) => void;
  /** 是否正處於拖放目標高亮。 */
  isDragOver?: boolean;
  /** 拖曳開始回呼。 */
  onDragStart?: (e: React.DragEvent, dateStr: string) => void;
  /** 拖曳經過回呼。 */
  onDragOver?: (e: React.DragEvent) => void;
  /** 拖曳結束回呼（清除高亮）。 */
  onDragEnd?: () => void;
  /** 放下回呼。 */
  onDrop?: (e: React.DragEvent, targetDateStr: string) => void;
  /** 是否為勞基法卡位目標。 */
  isSnappedTarget?: boolean;
  /** 緊湊模式（矩陣檢視等）。 */
  isCompact?: boolean;
  /** 是否為不合法拖放目標。 */
  isIllegalTarget?: boolean;
  /** 窄螢幕僅顯示顏色。 */
  colorOnlyOnNarrow?: boolean;
  /** 當日延長工時。 */
  overtimeHours?: number;
  /** 當日已用補休時數。 */
  compLeaveHours?: number;
  /** 本月尚可支用補休庫存（小時）。 */
  compLeaveBankHours?: number;
  /** 加減延長工時。 */
  onAdjustOvertime?: (dateStr: string, deltaHours: number) => void;
  /** 支用或還原補休（正＝支用、負＝還原）。 */
  onTakeCompLeave?: (dateStr: string, deltaHours?: number) => void;
  /**
   * 直接設定當日顯示總工時（正常＋延長−補休）。
   * @param dateStr 日期
   * @param displayHours 目標顯示時數
   */
  onSetDayHours?: (dateStr: string, displayHours: number) => void;
  /**
   * 是否為例假（或調→例）——可登錄加班但須顯示原則禁止提醒。
   */
  mandatoryOvertimeCaution?: boolean;
}

/** 工時標籤／按鈕共用半透明樣式。 */
const hourChipClass =
  'text-xs text-center font-mono opacity-80 font-semibold bg-black/20 rounded py-0.5 px-1';
const hourBtnClass =
  'w-5 h-5 rounded bg-black/20 hover:bg-black/35 flex items-center justify-center cursor-pointer text-current';

/**
 * 單日班別色塊。
 * 顯示工時＝正常＋延長−補休（例：8+0.5→8.5H）。
 * 點擊時數可直接輸入；左側 −／右側 ＋ 仍可逐步調整。
 */
export const ShiftBlockTile: React.FC<ShiftBlockTileProps> = ({
  dateStr,
  shiftType,
  onSlideShift,
  isPinned = false,
  onTogglePin,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isSnappedTarget = false,
  isCompact = false,
  isIllegalTarget = false,
  colorOnlyOnNarrow = true,
  overtimeHours = 0,
  compLeaveHours = 0,
  compLeaveBankHours = 0,
  onAdjustOvertime,
  onTakeCompLeave,
  onSetDayHours,
  mandatoryOvertimeCaution = false,
}) => {
  /** 是否正在編輯時數。 */
  const [isEditingHours, setIsEditingHours] = useState(false);
  /** 編輯中草稿字串。 */
  const [hoursDraft, setHoursDraft] = useState('');
  const hoursInputRef = useRef<HTMLInputElement>(null);

  const bgStyle = shiftType ? { backgroundColor: shiftType.color } : { backgroundColor: '#E9E7D4' };
  // 依背景亮度自動選深／淺字，不依賴可能過期的 textColor
  const textStyle = shiftType
    ? { color: getContrastingTextColor(shiftType.color) }
    : { color: '#5A5A40' };

  const baseHours = shiftType?.workHours || 0;
  const displayHours = Math.round((baseHours + overtimeHours - compLeaveHours) * 10) / 10;

  const canOvertime =
    !!shiftType &&
    canLogOvertimeOnCategory(shiftType.category) &&
    !isPinned &&
    !!onAdjustOvertime;
  const maxOt = shiftType ? getMaxDailyOvertimeHours(shiftType.workHours) : 0;
  // 當日已有補休時，＋先還原補休；否則在上限內加延長工時
  const canUndoCompLeave =
    !!shiftType &&
    shiftType.category === 'work' &&
    !isPinned &&
    !!onTakeCompLeave &&
    compLeaveHours >= OVERTIME_STEP_HOURS;
  const canAddOt = canOvertime && overtimeHours < maxOt;
  const canPlus = canUndoCompLeave || canAddOt;

  // 左側 −：優先取消當日延長工時；僅工作班且當日無加班時才支用補休
  const canReduceOt = canOvertime && overtimeHours >= OVERTIME_STEP_HOURS;
  const canTakeCompLeave =
    !!shiftType &&
    shiftType.category === 'work' &&
    !isPinned &&
    !!onTakeCompLeave &&
    overtimeHours < OVERTIME_STEP_HOURS &&
    compLeaveBankHours >= OVERTIME_STEP_HOURS &&
    baseHours - compLeaveHours >= OVERTIME_STEP_HOURS;
  const canMinus = canReduceOt || canTakeCompLeave;

  /** 可否點擊時數直接輸入（可登錄加班之班別且未釘選）。 */
  const canEditHours =
    canOvertime && !!onSetDayHours;

  /** 是否顯示時數列（可加班班別，含放假日 0H＋加號）。 */
  const showHoursRow = canOvertime || overtimeHours > 0 || compLeaveHours > 0;

  const detailVisibleClass = colorOnlyOnNarrow ? 'hidden md:flex' : 'flex';
  const colorOnlyVisibleClass = colorOnlyOnNarrow ? 'flex md:hidden' : 'hidden';

  const accessibleLabel = shiftType
    ? `${shiftType.code} ${shiftType.name}，${displayHours}H` +
      (overtimeHours > 0 ? `（含延長 ${overtimeHours}H）` : '') +
      (compLeaveHours > 0 ? `（已補休 ${compLeaveHours}H）` : '') +
      (mandatoryOvertimeCaution ? '（例假：原則禁止加班）' : '')
    : '尚未排班';

  // 進入編輯時聚焦並全選
  useEffect(() => {
    if (!isEditingHours) return;
    const el = hoursInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [isEditingHours]);

  /**
   * 右側 ＋：先還原當日補休，否則增加延長工時。
   * @param e 滑鼠事件
   */
  const handlePlus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canUndoCompLeave) {
      // 負向補休＝還原；與支用補休共用回呼，由 App 依 delta 處理
      onTakeCompLeave?.(dateStr, -OVERTIME_STEP_HOURS);
      return;
    }
    if (!canAddOt) return;
    onAdjustOvertime?.(dateStr, OVERTIME_STEP_HOURS);
  };

  /**
   * 左側 −：當日有延長工時則取消加班（面板延長工時同步減少）；否則支用補休。
   * @param e 滑鼠事件
   */
  const handleMinus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canReduceOt) {
      onAdjustOvertime?.(dateStr, -OVERTIME_STEP_HOURS);
      return;
    }
    if (!canTakeCompLeave) return;
    onTakeCompLeave?.(dateStr, OVERTIME_STEP_HOURS);
  };

  /**
   * 開始編輯時數。
   * @param e 滑鼠事件
   */
  const beginEditHours = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!canEditHours) return;
    setHoursDraft(String(displayHours));
    setIsEditingHours(true);
  };

  /** 取消編輯、還原顯示。 */
  const cancelEditHours = () => {
    setIsEditingHours(false);
    setHoursDraft('');
  };

  /**
   * 確認輸入並寫入當日顯示工時。
   */
  const commitEditHours = () => {
    if (!onSetDayHours) {
      cancelEditHours();
      return;
    }
    const normalized = hoursDraft.trim().replace(/,/g, '');
    if (normalized === '') {
      cancelEditHours();
      return;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      cancelEditHours();
      return;
    }
    onSetDayHours(dateStr, parsed);
    setIsEditingHours(false);
    setHoursDraft('');
  };

  const minusTitle = canReduceOt
    ? `取消延長工時 −${OVERTIME_STEP_HOURS}H`
    : `支用補休 ${OVERTIME_STEP_HOURS}H（庫存 ${compLeaveBankHours}H）`;
  const plusTitle = canUndoCompLeave
    ? `還原補休 +${OVERTIME_STEP_HOURS}H`
    : mandatoryOvertimeCaution
      ? `例假原則禁止加班（僅天災事變等例外可出勤）＋${OVERTIME_STEP_HOURS}H`
      : `延長工時 +${OVERTIME_STEP_HOURS}H`;

  /** 工時列：[−] 可點擊／輸入時數 [＋]；例假另標提醒 */
  const hoursRow = showHoursRow ? (
    <div className="flex items-center justify-center gap-0.5 flex-wrap pointer-events-auto">
      {canMinus && !isEditingHours && (
        <button
          type="button"
          onClick={handleMinus}
          className={hourBtnClass}
          title={minusTitle}
        >
          <Minus className="w-3 h-3" />
        </button>
      )}
      {isEditingHours ? (
          <input
            ref={hoursInputRef}
            type="number"
            inputMode="decimal"
            step={OVERTIME_STEP_HOURS}
            min={0}
            max={12}
            value={hoursDraft}
            onChange={(e) => setHoursDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                commitEditHours();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEditHours();
              }
            }}
            onBlur={commitEditHours}
            className={`${hourChipClass} w-12 appearance-none outline-none ring-1 ring-white/60 bg-black/30 cursor-text`}
            aria-label="輸入當日顯示工時"
            title="輸入當日顯示工時後按 Enter；Esc 取消"
          />
        ) : (
          <button
            type="button"
            onClick={beginEditHours}
            onMouseDown={(e) => {
              // 避免誤觸發色塊拖曳
              if (canEditHours) e.stopPropagation();
            }}
            disabled={!canEditHours}
            className={`${hourChipClass} ${
              canEditHours
                ? 'cursor-text hover:bg-black/35 hover:ring-1 hover:ring-white/40'
                : 'cursor-default'
            } ${mandatoryOvertimeCaution && overtimeHours > 0 ? 'ring-1 ring-amber-300/80' : ''}`}
            title={
              canEditHours
                ? mandatoryOvertimeCaution
                  ? `例假原則禁止加班；點擊輸入出勤時數（目前 ${displayHours}H）`
                  : `點擊直接輸入工時（目前 ${displayHours}H）`
                : accessibleLabel
            }
          >
            {displayHours}H
          </button>
        )}
      {canPlus && !isEditingHours && (
        <button
          type="button"
          onClick={handlePlus}
          className={`${hourBtnClass} ${
            mandatoryOvertimeCaution ? 'ring-1 ring-amber-300/70' : ''
          }`}
          title={plusTitle}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
      {mandatoryOvertimeCaution && (
        <span
          className="inline-flex items-center text-[9px] font-bold opacity-90 bg-amber-500/25 rounded px-1 py-0.5"
          title="例假日原則禁止加班，僅天災、事變或突發事件例外"
        >
          <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
          例
        </span>
      )}
    </div>
  ) : null;

  return (
    <div
      draggable={!isPinned && !isEditingHours}
      onDragStart={(e) => {
        if (isPinned || isEditingHours) {
          e.preventDefault();
          return;
        }
        // 部分瀏覽器需寫入 dataTransfer 才會正式啟用拖放
        e.dataTransfer.setData('text/plain', dateStr);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart && onDragStart(e, dateStr);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver && onDragOver(e);
      }}
      onDragEnd={() => {
        onDragEnd && onDragEnd();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isPinned) return;
        onDrop && onDrop(e, dateStr);
      }}
      className={`relative group rounded-lg md:rounded-xl transition-all duration-200 select-none shadow-sm ${
        isPinned
          ? 'ring-2 ring-amber-400/80 shadow-md cursor-default'
          : isDragOver
          ? 'ring-2 ring-[#5A5A40] scale-105 z-20 shadow-md cursor-grabbing'
          : isSnappedTarget
          ? 'ring-2 ring-[#D17A60] animate-bounce z-20 cursor-pointer'
          : isIllegalTarget
          ? 'opacity-40 blur-[0.5px] grayscale cursor-not-allowed'
          : isEditingHours
          ? 'hover:shadow-md cursor-default'
          : 'hover:shadow-md hover:scale-[1.02] cursor-grab active:cursor-grabbing'
      }`}
      style={{ ...bgStyle, ...textStyle }}
      title={accessibleLabel}
      aria-label={accessibleLabel}
    >
      {isPinned && (
        <div
          className="absolute -top-1.5 -right-1 md:-top-2.5 md:-right-1 bg-amber-500 text-white p-0.5 md:p-1 rounded-full shadow-md z-30 flex items-center justify-center border border-amber-300 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin && onTogglePin(dateStr);
          }}
          title="班別已釘選鎖定（點擊可解鎖）"
        >
          <Pin className="w-2.5 h-2.5 md:w-3 md:h-3 fill-white" />
        </div>
      )}

      {isSnappedTarget && (
        <>
          <div className="hidden md:flex absolute -top-3 left-1/2 -translate-x-1/2 bg-[#D17A60] text-white font-bold text-xs px-2 py-0.5 rounded-full shadow-md items-center gap-1 z-30 whitespace-nowrap animate-pulse border border-[#D17A60]">
            <AlertTriangle className="w-3 h-3" />
            <span>卡位合法位置</span>
          </div>
          <div className="md:hidden absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-[#D17A60] animate-pulse z-30" />
        </>
      )}

      <div
        className={`${colorOnlyVisibleClass} flex-col items-center justify-center min-h-[28px] p-0.5 gap-0.5`}
      >
        {!shiftType && <Plus className="w-3.5 h-3.5 text-[#8A8A70] opacity-70" aria-hidden />}
        {shiftType && <span className="sr-only">{shiftType.code}</span>}
      </div>

      <div
        className={`${detailVisibleClass} flex-col justify-between p-2 pb-1 ${
          isCompact ? 'min-h-[52px]' : 'min-h-[72px]'
        }`}
      >
        <div className="flex items-center justify-between opacity-80 group-hover:opacity-100 text-sm">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isPinned) return;
              onSlideShift(dateStr, 'left');
            }}
            disabled={isPinned}
            className={`p-1 rounded transition-colors ${
              isPinned
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-black/20 opacity-90 hover:opacity-100 cursor-pointer'
            }`}
            title={isPinned ? '班別已釘選，無法平移' : '平移此班別至前一日 (左移)'}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin && onTogglePin(dateStr);
              }}
              className="p-0.5 rounded hover:bg-black/20 opacity-80 hover:opacity-100 transition-colors cursor-pointer"
              title={isPinned ? '點擊解除釘選' : '點擊釘選此班別'}
            >
              <Pin
                className={`w-3 h-3 ${
                  isPinned ? 'fill-amber-300 text-amber-300' : 'opacity-60 hover:opacity-100'
                }`}
              />
            </button>
            {!isPinned && (
              <span className="cursor-grab active:cursor-grabbing opacity-70 hover:opacity-100">
                <GripHorizontal className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isPinned) return;
              onSlideShift(dateStr, 'right');
            }}
            disabled={isPinned}
            className={`p-1 rounded transition-colors ${
              isPinned
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-black/20 opacity-90 hover:opacity-100 cursor-pointer'
            }`}
            title={isPinned ? '班別已釘選，無法平移' : '平移此班別至後一日 (右移)'}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-center py-0.5 pointer-events-none">
          {shiftType ? (
            <div>
              <div className="text-base font-black tracking-wider drop-shadow-sm font-mono">
                {shiftType.code}
              </div>
              {!isCompact && (
                <div className="text-sm font-medium opacity-90 truncate max-w-[90px] mx-auto">
                  {shiftType.name.split(' ')[0]}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm font-medium text-[#5A5A40] py-1">點擊選取</div>
          )}
        </div>
      </div>

      {/* 時數列只渲染一次，避免窄／寬雙份 input 搶 focus */}
      <div className="px-1 pb-1.5 pt-0.5">{hoursRow}</div>
    </div>
  );
};
