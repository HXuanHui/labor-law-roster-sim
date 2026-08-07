import React, { useState, useEffect, useRef } from 'react';
import { ShiftType } from '../types';
import { ChevronLeft, ChevronRight, GripHorizontal, AlertTriangle, Pin } from 'lucide-react';

interface ShiftBlockTileProps {
  dateStr: string;
  shiftType: ShiftType | undefined;
  allShiftTypes: ShiftType[];
  onSelectShift: (dateStr: string, shiftTypeId: string) => void;
  onSlideShift: (dateStr: string, direction: 'left' | 'right') => void;
  isPinned?: boolean;
  onTogglePin?: (dateStr: string) => void;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent, dateStr: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, targetDateStr: string) => void;
  isSnappedTarget?: boolean;
  snappedMessage?: string;
  isCompact?: boolean;
  isIllegalTarget?: boolean;
}

export const ShiftBlockTile: React.FC<ShiftBlockTileProps> = ({
  dateStr,
  shiftType,
  allShiftTypes,
  onSelectShift,
  onSlideShift,
  isPinned = false,
  onTogglePin,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDrop,
  isSnappedTarget = false,
  snappedMessage,
  isCompact = false,
  isIllegalTarget = false,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    if (!showPicker) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showPicker]);

  const bgStyle = shiftType ? { backgroundColor: shiftType.color } : { backgroundColor: '#E9E7D4' };
  const textStyle = shiftType ? { color: shiftType.textColor } : { color: '#5A5A40' };

  return (
    <div
      ref={containerRef}
      draggable={!isPinned}
      onDragStart={(e) => {
        if (isPinned) {
          e.preventDefault();
          return;
        }
        onDragStart && onDragStart(e, dateStr);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver && onDragOver(e);
      }}
      onDrop={(e) => {
        if (isPinned) {
          e.preventDefault();
          return;
        }
        onDrop && onDrop(e, dateStr);
      }}
      className={`relative group rounded-xl transition-all duration-200 select-none shadow-sm ${
        isPinned
          ? 'ring-2 ring-amber-400/80 shadow-md'
          : showPicker
          ? 'z-[100] relative ring-2 ring-[#5A5A40] shadow-xl'
          : isDragOver
          ? 'ring-2 ring-[#5A5A40] scale-105 z-20 shadow-md'
          : isSnappedTarget
          ? 'ring-2 ring-[#D17A60] animate-bounce z-20'
          : isIllegalTarget
          ? 'opacity-40 blur-[0.5px] grayscale cursor-not-allowed'
          : 'hover:shadow-md hover:scale-[1.02]'
      }`}
      style={{
        ...bgStyle,
        ...textStyle,
      }}
    >
      {/* Pinned lock badge indicator */}
      {isPinned && (
        <div
          className="absolute -top-2.5 -right-1 bg-amber-500 text-white p-1 rounded-full shadow-md z-30 flex items-center justify-center border border-amber-300 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin && onTogglePin(dateStr);
          }}
          title="班別已釘選鎖定（點擊可解鎖）"
        >
          <Pin className="w-3 h-3 fill-white" />
        </div>
      )}

      {/* Snapped Legal Lock Indicator Banner */}
      {isSnappedTarget && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#D17A60] text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 z-30 whitespace-nowrap animate-pulse border border-[#D17A60]">
          <AlertTriangle className="w-3 h-3" />
          <span>卡位合法位置</span>
        </div>
      )}

      <div className={`p-2 flex flex-col justify-between ${isCompact ? 'min-h-[52px]' : 'min-h-[72px]'}`}>
        {/* Top bar: Drag Handle, Pin Button & Sliding Arrows */}
        <div className="flex items-center justify-between opacity-80 group-hover:opacity-100 text-xs">
          {/* Slide Left Button */}
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
                : 'hover:bg-black/20 text-white/90 hover:text-white cursor-pointer'
            }`}
            title={isPinned ? '班別已釘選，無法平移' : '平移此班別至前一日 (左移)'}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Drag Handle or Pin Button */}
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin && onTogglePin(dateStr);
              }}
              className="p-0.5 rounded hover:bg-black/20 text-white/80 hover:text-white transition-colors cursor-pointer"
              title={isPinned ? '點擊解除釘選' : '點擊釘選此班別不被變更或移動'}
            >
              <Pin className={`w-3 h-3 ${isPinned ? 'fill-amber-300 text-amber-300' : 'opacity-60 hover:opacity-100'}`} />
            </button>
            {!isPinned && (
              <span className="cursor-grab active:cursor-grabbing text-white/70 hover:text-white" title="拖曳方塊平移">
                <GripHorizontal className="w-3.5 h-3.5" />
              </span>
            )}
          </div>

          {/* Slide Right Button */}
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
                : 'hover:bg-black/20 text-white/90 hover:text-white cursor-pointer'
            }`}
            title={isPinned ? '班別已釘選，無法平移' : '平移此班別至後一日 (右移)'}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Shift Code & Name */}
        <div
          onClick={() => setShowPicker(!showPicker)}
          className="cursor-pointer text-center py-0.5"
        >
          {shiftType ? (
            <div>
              <div className="text-base font-black tracking-wider drop-shadow-sm font-mono flex items-center justify-center gap-1">
                <span>{shiftType.code}</span>
              </div>
              {!isCompact && (
                <div className="text-[11px] font-medium opacity-90 truncate max-w-[90px] mx-auto">
                  {shiftType.name.split(' ')[0]}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs font-medium text-[#5A5A40] py-1">點擊點班</div>
          )}
        </div>

        {/* Work hours tag */}
        {shiftType && shiftType.workHours > 0 && !isCompact && (
          <div className="text-[10px] text-center font-mono opacity-80 font-semibold bg-black/20 rounded py-0.5 px-1 mt-0.5">
            {shiftType.workHours}H
          </div>
        )}
      </div>

      {/* Quick Shift Type Selector Dropdown */}
      {showPicker && (
        <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-1 min-w-[190px] w-52 bg-white border border-[#D9D7C2] rounded-xl shadow-2xl p-2 z-[100] text-[#2D2D2D] text-xs animate-in fade-in zoom-in-95 duration-150">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A70] px-2 py-1 border-b border-[#E9E7D4] mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span>選擇班別</span>
              {isPinned && <span className="text-amber-600 font-bold">(已釘選)</span>}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPicker(false);
              }}
              className="text-[#8A8A70] hover:text-[#2D2D2D] text-[10px] font-normal"
            >
              ✕
            </button>
          </div>

          {isPinned && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-1.5 rounded-lg text-[10px] mb-1 flex items-center justify-between">
              <span>📌 目前已釘選保護</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin && onTogglePin(dateStr);
                }}
                className="text-[#5A5A40] font-bold underline hover:text-black"
              >
                解鎖釘選
              </button>
            </div>
          )}

          <div className="space-y-1 max-h-52 overflow-y-auto">
            {allShiftTypes.map((st) => (
              <button
                key={st.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectShift(dateStr, st.id);
                  setShowPicker(false);
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[#F8F7EB] text-left transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: st.color }}
                  />
                  <span className="font-semibold text-[#2D2D2D]">{st.code}</span>
                  <span className="text-[#5A5A40] text-[11px] truncate">{st.name}</span>
                </div>
                {st.workHours > 0 && (
                  <span className="text-[10px] font-mono text-[#8A8A70]">{st.workHours}h</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
