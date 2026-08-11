import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Employee, NationalHoliday, ScheduleSystemType, ShiftType } from '../types';
import { ShiftBlockTile } from './ShiftBlockTile';
import {
  findNearestLegalDate,
  getCycleInfoForDate,
  getEffectiveShift,
  isEmptyShiftTypeId,
} from '../utils/laborLaws';
import { EMPTY_SHIFT_TYPE_ID, canInitiateShiftChange, isNationalLockedShiftTypeId } from '../constants/shifts';
import { SYSTEM_CONFIGS } from '../constants/systems';
import { getContrastingTextColor } from '../utils/colorContrast';
import {
  getShortcutKeyFromEvent,
  isEditableKeyboardTarget,
  resolveShiftIdByShortcut,
} from '../utils/shiftShortcuts';
import {
  Users,
  ChevronLeft,
  ChevronRight,
  Layers,
  XCircle,
  Plus,
  Minus,
  Pin,
  UserPlus,
  Wand2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
} from 'date-fns';
import { getTaiwanWeekdayName } from '../utils/perpetualCalendar';

/** 方格縮放階數（0＝整段塞滿；最大＝約一週寬；階數越細越好調）。 */
const ZOOM_LEVEL_MAX = 8;

/**
 * 全人員時間軸矩陣檢視屬性。
 */
interface RosterTimelineViewProps {
  /** 檢視月份起始日 YYYY-MM-DD（應為該月 1 日；欄位前後各多一週）。 */
  startDateStr: string;
  /** 目前選用之變形工時制度（無同仁時的週期長度）。 */
  currentSystem: ScheduleSystemType;
  /** 公司級第一週／週期起始日（全員共用）。 */
  companyCycleStartDate: string;
  /** 同仁清單。 */
  employees: Employee[];
  /** 全部班別定義。 */
  allShiftTypes: ShiftType[];
  /** 「空」清除排班快捷鍵。 */
  emptyShiftShortcutKey?: string;
  /** 國定／自訂假日。 */
  nationalHolidays: NationalHoliday[];
  /** 指定同仁單日選班回呼。 */
  onSelectShift: (employeeId: string, dateStr: string, shiftTypeId: string) => void;
  /**
   * 批次套用班別（同仁＋多日）；含國／調時會先開刪假確認 Modal。
   * @param employeeId 同仁 ID
   * @param dateStrs 日期清單
   * @param shiftTypeId 目標班別
   */
  onBatchSelectShifts?: (
    employeeId: string,
    dateStrs: string[],
    shiftTypeId: string
  ) => void;
  /**
   * 套用「調」班前請求指定畫面上的「國」班來源。
   * @param cells 目標格（同仁＋日期）
   */
  onRequestMakeupShift?: (cells: { empId: string; dateStr: string }[]) => void;
  /** 班別左右平移回呼。 */
  onSlideShift: (employeeId: string, dateStr: string, direction: 'left' | 'right') => void;
  /** 拖放換日回呼。 */
  onDragDropShift?: (employeeId: string, fromDateStr: string, targetDateStr: string) => void;
  /** 釘選切換回呼。 */
  onTogglePin?: (employeeId: string, dateStr: string) => void;
  /**
   * 變更月份起始日回呼（傳入目標月 1 日）。
   * @param newStartDateStr 新起始日 YYYY-MM-DD
   */
  onChangeStartDate: (newStartDateStr: string) => void;
  /** 目前聚焦同仁 ID。 */
  selectedEmployeeId: string;
  /** 切換聚焦同仁回呼。 */
  onSelectEmployee: (id: string) => void;
  /** 開啟班別設定（黑列常駐 +）。 */
  onOpenShiftModal?: () => void;
  /** 開啟同仁設定 Modal（底部空白列新增同仁）。 */
  onOpenEmployeeModal?: () => void;
  /** 開啟一鍵排班（僅正式班表、非預排草稿時顯示）。 */
  onOpenAutoSchedule?: () => void;
  /**
   * 一鍵排班草稿列（覆蓋矩陣抬頭提示）。
   * blank＝可繼續用黑列／工具預排；preview＝演算結果唯讀預覽。
   */
  autoScheduleChrome?: {
    /** blank＝虛擬空白；preview＝演算預覽 */
    phase: 'blank' | 'preview';
    onCancel: () => void;
    onNext: () => void;
    onSave?: () => void;
    /** 預覽回空白預排（可重新手動排再下一步）。 */
    onBackToBlank?: () => void;
  };
  /**
   * 方格縮放階（由父層持有，切換月曆／矩陣後可記憶）。
   * @default 0
   */
  zoomLevel?: number;
  /**
   * 變更縮放階回呼。
   * @param level 新縮放階 0～ZOOM_LEVEL_MAX
   */
  onChangeZoomLevel?: (level: number) => void;
}

/**
 * 將當月擴展為「前後各最多一週」的日期清單（不再拉滿完整制度週期）。
 * @param monthStart 當月 1 日
 * @param monthEnd 當月最後一日
 * @returns 由早到晚的日期字串陣列
 */
function buildMonthWithWeekPad(monthStart: Date, monthEnd: Date): string[] {
  const rangeStart = addDays(monthStart, -7);
  const rangeEnd = addDays(monthEnd, 7);
  const total = differenceInCalendarDays(rangeEnd, rangeStart) + 1;
  const list: string[] = [];
  for (let i = 0; i < total; i++) {
    list.push(format(addDays(rangeStart, i), 'yyyy-MM-dd'));
  }
  return list;
}

/**
 * 判斷該日是否為此同仁「新週期起始日」（僅畫在該列上，不上貫整表）。
 * 天數依同仁自身制度；起點一律用公司級第一週（同月曆週期方格）。
 * @param dateStr 日期
 * @param emp 同仁
 * @param fallbackSystem 後備制度
 * @param companyCycleStartDate 公司級週期起日
 * @returns 是否為週期首日
 */
function isEmployeeCycleBoundary(
  dateStr: string,
  emp: Employee,
  fallbackSystem: ScheduleSystemType,
  companyCycleStartDate: string
): boolean {
  const system = emp.scheduleSystem || fallbackSystem;
  const cycleDays = SYSTEM_CONFIGS[system]?.cycleDays ?? 7;
  const info = getCycleInfoForDate(dateStr, cycleDays, companyCycleStartDate);
  return info.cStartStr === dateStr;
}

/**
 * 全人員排班時間軸矩陣（當月＋前後各一週）。
 * 格內僅以色塊標示；週期交界畫粗黑線；黑列以 portal 固定於視窗底部。
 */
export const RosterTimelineView: React.FC<RosterTimelineViewProps> = ({
  startDateStr,
  currentSystem,
  companyCycleStartDate,
  employees,
  allShiftTypes,
  emptyShiftShortcutKey = '',
  nationalHolidays,
  onSelectShift,
  onBatchSelectShifts,
  onRequestMakeupShift,
  onSlideShift,
  onDragDropShift,
  onTogglePin,
  onChangeStartDate,
  selectedEmployeeId,
  onSelectEmployee,
  onOpenShiftModal,
  onOpenEmployeeModal,
  onOpenAutoSchedule,
  autoScheduleChrome,
  zoomLevel: zoomLevelProp,
  onChangeZoomLevel,
}) => {
  /** 演算預覽唯讀；空白預排仍可用黑列／工具改班。 */
  const isPreviewLocked = autoScheduleChrome?.phase === 'preview';
  /** 矩陣全螢幕（脫離主欄寬限制）。 */
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [draggedCell, setDraggedCell] = useState<{ empId: string; dateStr: string } | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ empId: string; dateStr: string } | null>(null);
  /** 已選取的儲存格（同仁 + 日期），供黑列批次套用 */
  const [selectedCells, setSelectedCells] = useState<
    { empId: string; dateStr: string }[]
  >([]);
  /** Shift 範圍選取的錨點格 */
  const [lastClickedCell, setLastClickedCell] = useState<{
    empId: string;
    dateStr: string;
  } | null>(null);
  /** 表頭日期錨點（Shift 選多欄時用） */
  const [lastClickedHeaderDate, setLastClickedHeaderDate] = useState<string | null>(null);
  /** 內部縮放（父層未控管時使用）；有 onChangeZoomLevel 時以 prop 為準 */
  const [innerZoomLevel, setInnerZoomLevel] = useState(0);
  const zoomLevel =
    typeof zoomLevelProp === 'number' ? zoomLevelProp : innerZoomLevel;
  /**
   * 寫入縮放階（優先通知父層以跨檢視記憶）。
   * @param next 新階或 updater
   */
  const setZoomLevel = (next: number | ((prev: number) => number)) => {
    const resolved = typeof next === 'function' ? next(zoomLevel) : next;
    const clamped = Math.max(0, Math.min(ZOOM_LEVEL_MAX, resolved));
    if (onChangeZoomLevel) onChangeZoomLevel(clamped);
    else setInnerZoomLevel(clamped);
  };
  /** 橫向捲動區寬度，供計算欄寬 */
  const [viewportWidth, setViewportWidth] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Esc 清空選取；有選取時按快捷鍵套用對應班別
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (isFullscreen) {
          setIsFullscreen(false);
          return;
        }
        setSelectedCells([]);
        setLastClickedCell(null);
        setLastClickedHeaderDate(null);
        return;
      }

      if (selectedCells.length === 0) return;
      if (isPreviewLocked) return;
      if (isEditableKeyboardTarget(e.target)) return;

      const pressed = getShortcutKeyFromEvent(e);
      if (!pressed) return;

      const shiftTypeId = resolveShiftIdByShortcut(
        pressed,
        allShiftTypes,
        emptyShiftShortcutKey
      );
      if (!shiftTypeId) return;

      e.preventDefault();
      // 一般釘選略過；國／調可發起改班（App 會先確認刪假）
      const applicable = selectedCells.filter(({ empId, dateStr }) => {
        const emp = employees.find((x) => x.id === empId);
        if (!emp) return false;
        const effId = getEffectiveShift(emp.schedules, dateStr, nationalHolidays)
          .shiftTypeId;
        return canInitiateShiftChange(emp.schedules[dateStr]?.isPinned, effId);
      });
      if (applicable.length === 0) return;

      if (shiftTypeId === 'shift_national_holiday_makeup' && onRequestMakeupShift) {
        onRequestMakeupShift(applicable);
        setSelectedCells([]);
        return;
      }

      // 依同仁分組批次套用，國／調才能共用一個刪假確認 Modal
      const byEmp = new Map<string, string[]>();
      applicable.forEach(({ empId, dateStr }) => {
        const list = byEmp.get(empId) ?? [];
        list.push(dateStr);
        byEmp.set(empId, list);
      });
      byEmp.forEach((dates, empId) => {
        if (onBatchSelectShifts && dates.length > 0) {
          onBatchSelectShifts(empId, dates, shiftTypeId);
        } else {
          dates.forEach((d) => onSelectShift(empId, d, shiftTypeId));
        }
      });
      setSelectedCells([]);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedCells,
    isPreviewLocked,
    isFullscreen,
    allShiftTypes,
    emptyShiftShortcutKey,
    employees,
    nationalHolidays,
    onRequestMakeupShift,
    onBatchSelectShifts,
    onSelectShift,
  ]);

  // 量測捲動區寬度；切換全螢幕會 portal 重掛節點，必須重綁 ResizeObserver
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setViewportWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // portal 掛載後再量一次，避免首幀 clientWidth 為 0
    const raf = window.requestAnimationFrame(update);
    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [isFullscreen]);

  const monthStart = startOfMonth(parseISO(startDateStr));
  const monthEnd = endOfMonth(monthStart);
  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd');

  const datesList = useMemo(
    () => buildMonthWithWeekPad(monthStart, monthEnd),
    // monthStart／monthEnd 由 startDateStr 推得
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startDateStr]
  );

  const monthLabel = format(monthStart, 'yyyy年M月');
  const rangeLabel =
    datesList.length > 0
      ? `${datesList[0]} ~ ${datesList[datesList.length - 1]}`
      : `${monthStartStr} ~ ${monthEndStr}`;

  /**
   * 量測到的可用寬；尚未量到時以視窗寬估計，避免欄寬塌成極窄。
   */
  const effectiveViewportWidth = useMemo(() => {
    if (viewportWidth > 0) return viewportWidth;
    if (typeof window === 'undefined') return 960;
    // 全螢幕約扣左右 inset；一般模式略保守
    return Math.max(320, window.innerWidth - (isFullscreen ? 48 : 96));
  }, [viewportWidth, isFullscreen]);

  /**
   * 姓名欄固定寬；其餘寬度依縮放在「整段塞滿」與「一週（7 天）可視寬」之間插值。
   */
  const nameColWidth = effectiveViewportWidth < 640 ? 72 : 104;
  const dayColWidth = useMemo(() => {
    if (datesList.length === 0) return 24;
    const usable = Math.max(120, effectiveViewportWidth - nameColWidth);
    const minW = usable / datesList.length;
    // 最大放大：可視區約僅容納一週
    const maxW = usable / 7;
    const hi = Math.max(minW, maxW);
    const t = zoomLevel / ZOOM_LEVEL_MAX;
    // 最小可讀欄寬約 18px，避免塌成不可辨識細線
    return Math.max(18, minW + (hi - minW) * t);
  }, [datesList.length, effectiveViewportWidth, nameColWidth, zoomLevel]);

  const tablePixelWidth = nameColWidth + dayColWidth * datesList.length;
  const needsHScroll = tablePixelWidth > effectiveViewportWidth + 1;

  /** 切換至前一個月（該月 1 日）。 */
  const handlePrevMonth = () => {
    onChangeStartDate(format(startOfMonth(addMonths(monthStart, -1)), 'yyyy-MM-dd'));
  };

  /** 切換至下一個月（該月 1 日）。 */
  const handleNextMonth = () => {
    onChangeStartDate(format(startOfMonth(addMonths(monthStart, 1)), 'yyyy-MM-dd'));
  };

  /**
   * 點擊儲存格：支援 Shift 矩形範圍、Ctrl/Cmd 切換，並聚焦該同仁。
   * @param empId 同仁 ID
   * @param dateStr 日期
   * @param e 滑鼠事件
   */
  const handleCellClick = (empId: string, dateStr: string, e: React.MouseEvent) => {
    // 演算預覽不可選格改班；空白預排階段仍可操作
    if (isPreviewLocked) return;
    e.stopPropagation();
    onSelectEmployee(empId);

    const keyMatch = (c: { empId: string; dateStr: string }) =>
      c.empId === empId && c.dateStr === dateStr;

    // Shift：以錨點到目前格的矩形範圍選取（同月曆範圍選）
    if (e.shiftKey && lastClickedCell) {
      const empIds = employees.map((emp) => emp.id);
      const r0 = empIds.indexOf(lastClickedCell.empId);
      const r1 = empIds.indexOf(empId);
      const c0 = datesList.indexOf(lastClickedCell.dateStr);
      const c1 = datesList.indexOf(dateStr);
      if (r0 >= 0 && r1 >= 0 && c0 >= 0 && c1 >= 0) {
        const [rMin, rMax] = r0 < r1 ? [r0, r1] : [r1, r0];
        const [cMin, cMax] = c0 < c1 ? [c0, c1] : [c1, c0];
        const next: { empId: string; dateStr: string }[] = [];
        for (let r = rMin; r <= rMax; r++) {
          for (let c = cMin; c <= cMax; c++) {
            next.push({ empId: empIds[r], dateStr: datesList[c] });
          }
        }
        setSelectedCells(next);
        setLastClickedHeaderDate(dateStr);
        return;
      }
    }

    if (e.ctrlKey || e.metaKey || selectedCells.length > 0) {
      if (selectedCells.some(keyMatch)) {
        setSelectedCells((prev) => prev.filter((c) => !keyMatch(c)));
      } else {
        setSelectedCells((prev) => [...prev, { empId, dateStr }]);
      }
    } else {
      if (selectedCells.length === 1 && keyMatch(selectedCells[0])) {
        setSelectedCells([]);
      } else {
        setSelectedCells([{ empId, dateStr }]);
      }
    }
    setLastClickedCell({ empId, dateStr });
    setLastClickedHeaderDate(dateStr);
  };

  /**
   * 點擊表頭日期：選取該日所有同仁整欄；Shift 則選取日期區間的整欄集合。
   * @param dateStr 日期
   * @param e 滑鼠事件
   */
  const handleDateHeaderClick = (dateStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPreviewLocked || employees.length === 0) return;

    const anchorDate = lastClickedHeaderDate || lastClickedCell?.dateStr || null;

    if (e.shiftKey && anchorDate) {
      const i0 = datesList.indexOf(anchorDate);
      const i1 = datesList.indexOf(dateStr);
      if (i0 >= 0 && i1 >= 0) {
        const [lo, hi] = i0 < i1 ? [i0, i1] : [i1, i0];
        const next: { empId: string; dateStr: string }[] = [];
        for (let i = lo; i <= hi; i++) {
          const d = datesList[i];
          employees.forEach((emp) => next.push({ empId: emp.id, dateStr: d }));
        }
        setSelectedCells(next);
        setLastClickedHeaderDate(dateStr);
        setLastClickedCell({ empId: employees[0].id, dateStr });
        return;
      }
    }

    if (e.ctrlKey || e.metaKey) {
      // 切換該欄：若該欄已全選則移除，否則併入
      const columnKeys = new Set(employees.map((emp) => `${emp.id}|${dateStr}`));
      const allSelected = employees.every((emp) =>
        selectedCells.some((c) => c.empId === emp.id && c.dateStr === dateStr)
      );
      if (allSelected) {
        setSelectedCells((prev) =>
          prev.filter((c) => !columnKeys.has(`${c.empId}|${c.dateStr}`))
        );
      } else {
        setSelectedCells((prev) => {
          const map = new Map(prev.map((c) => [`${c.empId}|${c.dateStr}`, c]));
          employees.forEach((emp) => {
            map.set(`${emp.id}|${dateStr}`, { empId: emp.id, dateStr });
          });
          return Array.from(map.values());
        });
      }
    } else {
      // 一般點擊：改選整欄
      setSelectedCells(employees.map((emp) => ({ empId: emp.id, dateStr })));
    }
    setLastClickedHeaderDate(dateStr);
    setLastClickedCell({ empId: employees[0].id, dateStr });
  };

  /**
   * 依黑列按鈕批次套用班別（一般釘選略過；國／調可發起並先確認刪假）。
   * 「調」改走來源「國」班挑選流程。
   * @param shiftTypeId 目標班別 ID
   */
  const handleApplyBatchShift = (shiftTypeId: string) => {
    const applicable = selectedCells.filter(({ empId, dateStr }) => {
      const emp = employees.find((e) => e.id === empId);
      if (!emp) return false;
      const effId = getEffectiveShift(emp.schedules, dateStr, nationalHolidays).shiftTypeId;
      return canInitiateShiftChange(emp.schedules[dateStr]?.isPinned, effId);
    });
    if (applicable.length === 0) return;

    if (shiftTypeId === 'shift_national_holiday_makeup' && onRequestMakeupShift) {
      onRequestMakeupShift(applicable);
      setSelectedCells([]);
      return;
    }

    // 依同仁分組批次套用，避免多日 forEach 互相覆蓋刪假確認狀態
    const byEmp = new Map<string, string[]>();
    applicable.forEach(({ empId, dateStr }) => {
      const list = byEmp.get(empId) ?? [];
      list.push(dateStr);
      byEmp.set(empId, list);
    });
    byEmp.forEach((dates, empId) => {
      if (onBatchSelectShifts && dates.length > 0) {
        onBatchSelectShifts(empId, dates, shiftTypeId);
      } else {
        dates.forEach((d) => onSelectShift(empId, d, shiftTypeId));
      }
    });
    setSelectedCells([]);
  };

  /**
   * 批次釘選／解釘：若選取中尚有可釘之日則一律釘上；若皆已釘則改為解釘。
   * 國／調略過（預設釘選且不可解除）。
   */
  const handleBatchPin = () => {
    if (!onTogglePin || selectedCells.length === 0) return;

    type ActionCell = { empId: string; dateStr: string; isPinned: boolean };
    const actionable: ActionCell[] = [];
    selectedCells.forEach(({ empId, dateStr }) => {
      const emp = employees.find((e) => e.id === empId);
      if (!emp) return;
      const effId = getEffectiveShift(emp.schedules, dateStr, nationalHolidays).shiftTypeId;
      if (isNationalLockedShiftTypeId(effId)) return;
      actionable.push({
        empId,
        dateStr,
        isPinned: !!emp.schedules[dateStr]?.isPinned,
      });
    });
    if (actionable.length === 0) return;

    // 有任一未釘 → 釘上未釘者；否則解釘全部可解者
    const shouldPin = actionable.some((c) => !c.isPinned);
    actionable.forEach(({ empId, dateStr, isPinned }) => {
      if (shouldPin && !isPinned) onTogglePin(empId, dateStr);
      if (!shouldPin && isPinned) onTogglePin(empId, dateStr);
    });
  };

  /**
   * 判斷儲存格是否已選取。
   * @param empId 同仁 ID
   * @param dateStr 日期
   * @returns 是否選取中
   */
  const isCellSelected = (empId: string, dateStr: string) =>
    selectedCells.some((c) => c.empId === empId && c.dateStr === dateStr);

  /** 黑列：portal 到 body；演算預覽唯讀時不顯示（空白預排可顯示） */
  const floatingActionBar =
    !isPreviewLocked &&
    selectedCells.length > 0 &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-3xl w-[94%] sm:w-[min(92%,48rem)] bg-[#2D2D2D] text-white p-3 rounded-2xl shadow-2xl border border-[#5A5A40] flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200"
        role="toolbar"
        aria-label="批次套用班別"
      >
        <div className="flex items-center space-x-2 text-left w-full sm:w-auto">
          <span className="bg-[#5A5A40] text-white p-1.5 rounded-xl font-bold shrink-0">
            <Layers className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold">
              已選取{' '}
              <span className="text-yellow-400 font-mono text-sm">{selectedCells.length}</span> 格
            </div>
            <p className="text-xs text-gray-300">點選班別／釘選或按快捷鍵套用（Esc 取消）</p>
          </div>
          <button
            onClick={() => setSelectedCells([])}
            className="sm:hidden text-sm bg-red-500/20 text-red-300 hover:bg-red-500/40 px-2 py-1 rounded-lg border border-red-500/30 shrink-0 font-bold"
          >
            取消
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
          {allShiftTypes.map((st) => (
            <button
              key={st.id}
              onClick={() => handleApplyBatchShift(st.id)}
              className="min-w-8 h-8 sm:h-auto sm:px-2.5 sm:py-1 px-1.5 rounded-lg text-xs sm:text-sm font-bold transition-transform hover:scale-105 active:scale-95 shadow cursor-pointer border border-white/20 flex items-center justify-center gap-1"
              style={{ backgroundColor: st.color, color: getContrastingTextColor(st.color) }}
              title={
                st.shortcutKey
                  ? `批次設置為：${st.name}（快捷鍵 ${st.shortcutKey}）`
                  : `批次設置為：${st.name}`
              }
            >
              <span>{st.code}</span>
              {st.shortcutKey ? (
                <span className="hidden sm:inline opacity-70 font-mono text-[10px] leading-none">
                  {st.shortcutKey}
                </span>
              ) : null}
            </button>
          ))}
          <button
            onClick={() => handleApplyBatchShift(EMPTY_SHIFT_TYPE_ID)}
            className="min-w-8 h-8 sm:h-auto sm:px-2.5 sm:py-1 px-1.5 rounded-lg text-xs sm:text-sm font-bold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer border border-slate-500 flex items-center gap-1"
            title={
              emptyShiftShortcutKey
                ? `清除當天排班（快捷鍵 ${emptyShiftShortcutKey}）`
                : '清除當天排班（非休息日／例假／國定假日）'
            }
          >
            <span>空</span>
            {emptyShiftShortcutKey ? (
              <span className="hidden sm:inline opacity-70 font-mono text-[10px] leading-none">
                {emptyShiftShortcutKey}
              </span>
            ) : null}
          </button>
          {onTogglePin && (
            <button
              type="button"
              onClick={handleBatchPin}
              className="min-w-8 h-8 sm:h-auto sm:px-2.5 sm:py-1 px-1.5 rounded-lg text-xs sm:text-sm font-bold bg-amber-500/90 hover:bg-amber-500 text-white transition-colors cursor-pointer border border-amber-300/40 flex items-center justify-center gap-1"
              title="批次釘選／解釘選取格（國／調略過）"
              aria-label="批次釘選"
            >
              <Pin className="w-3.5 h-3.5 fill-white" />
              <span className="hidden sm:inline">釘選</span>
            </button>
          )}
          {onOpenShiftModal && (
            <button
              type="button"
              onClick={onOpenShiftModal}
              className="min-w-8 h-8 sm:h-auto sm:px-2.5 sm:py-1 px-1.5 rounded-lg text-xs sm:text-sm font-bold bg-[#5A5A40] hover:bg-[#484833] text-white transition-colors cursor-pointer border border-white/20 flex items-center justify-center"
              title="新增／編輯班別"
              aria-label="新增班別"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setSelectedCells([])}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-red-500/80 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-colors cursor-pointer"
            title="取消框選"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>取消</span>
          </button>
        </div>
      </div>,
      document.body
    );

  const panel = (
    <div
      className={`bg-white border border-[#E9E7D4] shadow-sm overflow-hidden relative flex flex-col min-h-0 w-full ${
        isFullscreen
          ? 'h-full rounded-2xl'
          : 'rounded-2xl'
      }`}
    >
      {/* Timeline Header：全螢幕時內容水平置中 */}
      <div
        className={`bg-[#F8F7EB] p-3 border-b border-[#E9E7D4] flex flex-col gap-3 shrink-0 ${
          isFullscreen ? 'items-center text-center' : ''
        }`}
      >
        <div
          className={`flex flex-col gap-3 w-full ${
            isFullscreen
              ? 'items-center'
              : 'sm:flex-row sm:items-center justify-between'
          }`}
        >
          <div
            className={`flex items-center space-x-3 ${
              isFullscreen ? 'justify-center' : ''
            }`}
          >
            <div className="p-2 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl border border-[#5A5A40]/20">
              <Users className="w-5 h-5" />
            </div>
            <div className={isFullscreen ? 'text-center' : ''}>
              <h2
                className={`text-xl font-bold text-[#2D2D2D] font-serif flex items-center gap-2 flex-wrap ${
                  isFullscreen ? 'justify-center' : ''
                }`}
              >
                <span>全人員排班時間軸矩陣</span>
                <span className="text-sm px-2 py-0.5 rounded bg-[#E9E7D4] text-[#5A5A40] font-mono">
                  {monthLabel} · 前後各一週
                </span>
              </h2>
              <p className="text-xs text-[#8A8A70] mt-0.5">
                顯示當月並前後各多一週；每位同仁列上粗黑線＝其制度週期交界
              </p>
            </div>
          </div>

          <div
            className={`flex items-center space-x-2 flex-wrap ${
              isFullscreen ? 'justify-center' : ''
            }`}
          >
            {onOpenAutoSchedule && !autoScheduleChrome && (
              <button
                type="button"
                onClick={onOpenAutoSchedule}
                className="p-1.5 rounded-lg bg-[#5A5A40] hover:bg-[#484833] text-white text-sm font-semibold flex items-center gap-1 transition-colors shadow-sm"
                title="一鍵自動排班"
              >
                <Wand2 className="w-4 h-4" />
                <span>一鍵排班</span>
              </button>
            )}
            <button
              onClick={handlePrevMonth}
              disabled={!!autoScheduleChrome}
              className="p-1.5 rounded-lg bg-white border border-[#D9D7C2] text-[#5A5A40] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] text-sm font-semibold flex items-center gap-1 transition-colors shadow-sm disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>前一個月</span>
            </button>
            <span className="text-sm font-mono text-[#2D2D2D] px-2 font-bold">{rangeLabel}</span>
            <button
              onClick={handleNextMonth}
              disabled={!!autoScheduleChrome}
              className="p-1.5 rounded-lg bg-white border border-[#D9D7C2] text-[#5A5A40] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] text-sm font-semibold flex items-center gap-1 transition-colors shadow-sm disabled:opacity-40"
            >
              <span>下一個月</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {autoScheduleChrome && (
          <div
            className={`rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 space-y-2 w-full max-w-3xl ${
              isFullscreen ? 'mx-auto' : ''
            }`}
          >
            <p className="text-sm font-bold text-amber-900">
              {autoScheduleChrome.phase === 'blank'
                ? '預排中：已建立虛擬空白班表（保留國定假／補班）。可用黑列與工具先確認預排，再按「下一步」。'
                : '預排預覽：滿意請儲存；未儲存就切換月曆等會遺失'}
            </p>
            <p className="text-sm text-amber-800/90">
              提醒：沒有按「儲存」就離開此預排（例如切到月曆模式）會丟失目前預排結果。
            </p>
            <div
              className={`flex flex-wrap gap-2 ${
                isFullscreen ? 'justify-center' : ''
              }`}
            >
              <button
                type="button"
                onClick={autoScheduleChrome.onCancel}
                className="px-3 py-1.5 rounded-lg text-sm font-bold bg-white border border-amber-300 text-amber-900 hover:bg-amber-100"
              >
                取消
              </button>
              {autoScheduleChrome.phase === 'blank' && (
                <button
                  type="button"
                  onClick={autoScheduleChrome.onNext}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold bg-[#5A5A40] text-white hover:bg-[#484833]"
                >
                  下一步
                </button>
              )}
              {autoScheduleChrome.phase === 'preview' && (
                <>
                  {autoScheduleChrome.onBackToBlank && (
                    <button
                      type="button"
                      onClick={autoScheduleChrome.onBackToBlank}
                      className="px-3 py-1.5 rounded-lg text-sm font-bold bg-white border border-amber-300 text-amber-900 hover:bg-amber-100"
                    >
                      回上一步
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={autoScheduleChrome.onNext}
                    className="px-3 py-1.5 rounded-lg text-sm font-bold bg-white border border-[#D9D7C2] text-[#5A5A40]"
                  >
                    調整參數
                  </button>
                  {autoScheduleChrome.onSave && (
                    <button
                      type="button"
                      onClick={autoScheduleChrome.onSave}
                      className="px-3 py-1.5 rounded-lg text-sm font-bold bg-[#5A5A40] text-white hover:bg-[#484833]"
                    >
                      儲存
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* 班別顏色代號圖例（格內不顯示文字） */}
        <div
          className={`flex flex-wrap items-center gap-1.5 w-full ${
            isFullscreen ? 'justify-center max-w-4xl' : ''
          }`}
        >
          <span className="text-xs font-bold text-[#8A8A70] mr-1">班別圖例</span>
          {allShiftTypes.map((st) => (
            <span
              key={st.id}
              className="inline-flex items-center px-1.5 py-0.5 rounded border border-black/10 text-xs font-bold font-mono shadow-sm"
              style={{
                backgroundColor: st.color,
                color: getContrastingTextColor(st.color),
              }}
              title={st.name}
            >
              {st.code}
            </span>
          ))}
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded border border-[#D9D7C2] bg-[#E9E7D4] text-xs font-bold text-[#5A5A40]"
            title="尚未排班"
          >
            未排
          </span>

          {/* 方格大小 +/- ：最小整段可見，最大約一週；可全螢幕以螢幕全寬計算 */}
          <div
            className={`${
              isFullscreen ? 'ml-2' : 'ml-auto'
            } flex items-center gap-1 rounded-lg border border-[#D9D7C2] bg-white px-1 py-0.5`}
          >
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0, z - 1))}
              disabled={zoomLevel <= 0}
              className="p-1 rounded text-[#5A5A40] hover:bg-[#E9E7D4] disabled:opacity-30 disabled:cursor-not-allowed"
              title="縮小方格（整段塞入畫面）"
              aria-label="縮小方格"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(ZOOM_LEVEL_MAX, z + 1))}
              disabled={zoomLevel >= ZOOM_LEVEL_MAX}
              className="p-1 rounded text-[#5A5A40] hover:bg-[#E9E7D4] disabled:opacity-30 disabled:cursor-not-allowed"
              title="放大方格（最大約顯示一週寬）"
              aria-label="放大方格"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen((v) => !v)}
              className="p-1 rounded text-[#5A5A40] hover:bg-[#E9E7D4]"
              title={isFullscreen ? '結束全螢幕' : '全螢幕（使用整個螢幕寬度）'}
              aria-label={isFullscreen ? '結束全螢幕' : '全螢幕'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={`w-full min-w-0 ${needsHScroll ? 'overflow-x-auto' : 'overflow-x-hidden'} ${
          isFullscreen ? 'flex-1 min-h-0 overflow-y-auto' : ''
        }`}
      >
        <table
          className="text-left border-collapse"
          style={{
            width: needsHScroll ? tablePixelWidth : '100%',
            tableLayout: 'fixed',
            minWidth: needsHScroll ? tablePixelWidth : '100%',
          }}
        >
          <colgroup>
            <col style={{ width: nameColWidth }} />
            {datesList.map((d) => (
              <col key={d} style={{ width: dayColWidth }} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-[#F8F7EB] border-b border-[#E9E7D4] text-xs font-bold text-[#8A8A70]">
              <th className="p-1.5 sticky left-0 bg-[#F8F7EB] z-40 border-r border-[#E9E7D4] shadow-sm">
                同仁
              </th>
              {datesList.map((dStr) => {
                const dayNum = dStr.split('-')[2];
                const weekday = getTaiwanWeekdayName(dStr);
                const isWeekend = weekday === '週六' || weekday === '週日';
                const holiday = nationalHolidays.find((h) => h.date === dStr);
                const weekdayShort = weekday.replace('週', '');
                const inMonth = isWithinInterval(parseISO(dStr), {
                  start: monthStart,
                  end: monthEnd,
                });

                return (
                  <th
                    key={dStr}
                    className={`px-0 py-1 text-center border-r border-[#E9E7D4] cursor-pointer hover:bg-[#E9E7D4]/80 ${
                      isWeekend ? 'bg-[#D17A60]/10 text-[#D17A60]' : 'text-[#5A5A40]'
                    } ${!inMonth ? 'opacity-45' : ''}`}
                    title={
                      holiday
                        ? `${dStr} ${weekday} ${holiday.name}（點擊選取整欄）`
                        : `${dStr} ${weekday}（點擊選取整欄；Shift 選日期區間）`
                    }
                    onClick={(e) => handleDateHeaderClick(dStr, e)}
                  >
                    <div className="font-bold text-[11px] leading-none">{Number(dayNum)}</div>
                    <div className="text-[10px] font-normal leading-tight mt-0.5 opacity-80">
                      {weekdayShort}
                    </div>
                    {holiday && (
                      <div className="mx-auto mt-0.5 w-1 h-1 rounded-full bg-[#D17A60]" aria-hidden />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E9E7D4] text-sm">
            {employees.map((emp) => {
              const isSelected = emp.id === selectedEmployeeId;

              return (
                <tr
                  key={emp.id}
                  onClick={() => onSelectEmployee(emp.id)}
                  className={`transition-colors hover:bg-[#F8F7EB] cursor-pointer ${
                    isSelected ? 'bg-[#5A5A40]/10' : ''
                  }`}
                >
                  <td
                    className={`p-1.5 sticky left-0 z-30 border-r border-[#E9E7D4] font-medium relative ${
                      isSelected ? 'bg-[#F2F1E8]' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <div className="w-6 h-6 shrink-0 rounded-full bg-[#5A5A40]/20 text-[#5A5A40] font-bold flex items-center justify-center text-xs border border-[#5A5A40]/30">
                        {emp.name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[#2D2D2D] text-xs flex items-center gap-1 truncate">
                          <span className="truncate">{emp.name}</span>
                          {isSelected && (
                            <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-[#5A5A40]" />
                          )}
                        </div>
                        <div className="text-[10px] text-[#8A8A70] truncate">{emp.role}</div>
                      </div>
                    </div>
                  </td>

                  {datesList.map((dStr) => {
                    const dayShift = getEffectiveShift(emp.schedules, dStr, nationalHolidays);
                    // 空班哨兵：不顯示班別色塊，亦不當作休／例／國假
                    const shiftType =
                      dayShift && !isEmptyShiftTypeId(dayShift.shiftTypeId)
                        ? allShiftTypes.find((s) => s.id === dayShift.shiftTypeId)
                        : undefined;
                    const cellSelected = isCellSelected(emp.id, dStr);
                    const inMonth = isWithinInterval(parseISO(dStr), {
                      start: monthStart,
                      end: monthEnd,
                    });
                    // 僅畫在該同仁列上（不上貫表頭）：間隔＝其 scheduleSystem 週期天數
                    const cycleEdge = isEmployeeCycleBoundary(
                      dStr,
                      emp,
                      currentSystem,
                      companyCycleStartDate
                    );

                    let isIllegalTarget = false;
                    if (
                      draggedCell &&
                      draggedCell.empId === emp.id &&
                      draggedCell.dateStr !== dStr
                    ) {
                      const sourceShift = getEffectiveShift(
                        emp.schedules,
                        draggedCell.dateStr,
                        nationalHolidays
                      );
                      const movingShiftTypeId = sourceShift
                        ? sourceShift.shiftTypeId
                        : 'shift_morning';
                      const testResult = findNearestLegalDate(
                        emp.schedules,
                        draggedCell.dateStr,
                        dStr,
                        movingShiftTypeId,
                        emp.scheduleSystem || '2-week',
                        allShiftTypes,
                        28,
                        companyCycleStartDate,
                        nationalHolidays
                      );
                      if (!testResult.allowed || testResult.snappedDate !== dStr) {
                        isIllegalTarget = true;
                      }
                    }

                    return (
                      <td
                        key={dStr}
                        className={`p-0.5 text-center border-r border-[#E9E7D4] align-middle overflow-hidden ${
                          cycleEdge ? 'border-l-[3px] border-l-[#1a1a1a]' : ''
                        } ${
                          cellSelected
                            ? 'bg-[#5A5A40]/15 ring-2 ring-inset ring-[#5A5A40]'
                            : !inMonth
                              ? 'bg-[#F3F2EA]/80'
                              : ''
                        }`}
                        onClick={(e) => handleCellClick(emp.id, dStr, e)}
                      >
                        <ShiftBlockTile
                          dateStr={dStr}
                          shiftType={shiftType}
                          onSlideShift={(d, dir) => {
                            if (isPreviewLocked) return;
                            onSlideShift(emp.id, d, dir);
                          }}
                          // 預覽不顯示釘選角標／外框（仍鎖編輯）；其餘顯示真實釘選／國調
                          isPinned={
                            !isPreviewLocked &&
                            (!!dayShift?.isPinned ||
                              dayShift?.shiftTypeId === 'shift_national_holiday' ||
                              dayShift?.shiftTypeId === 'shift_national_holiday_makeup')
                          }
                          onTogglePin={
                            isPreviewLocked
                              ? undefined
                              : (d) => onTogglePin && onTogglePin(emp.id, d)
                          }
                          isDragOver={
                            !isPreviewLocked &&
                            dragOverCell?.empId === emp.id &&
                            dragOverCell?.dateStr === dStr
                          }
                          onDragStart={
                            isPreviewLocked
                              ? undefined
                              : (e, dateStr) => {
                                  e.dataTransfer.setData(
                                    'text/plain',
                                    `${emp.id}|${dateStr}`
                                  );
                                  setDraggedCell({ empId: emp.id, dateStr });
                                }
                          }
                          onDragOver={
                            isPreviewLocked
                              ? undefined
                              : () => {
                                  setDragOverCell({ empId: emp.id, dateStr: dStr });
                                }
                          }
                          onDragEnd={
                            isPreviewLocked
                              ? undefined
                              : () => {
                                  setDragOverCell(null);
                                  setDraggedCell(null);
                                }
                          }
                          onDrop={
                            isPreviewLocked
                              ? undefined
                              : (e, targetDateStr) => {
                                  setDragOverCell(null);
                                  const payload =
                                    e.dataTransfer.getData('text/plain') ||
                                    (draggedCell
                                      ? `${draggedCell.empId}|${draggedCell.dateStr}`
                                      : '');
                                  const [fromEmpId, fromDateStr] = payload.split('|');
                                  if (
                                    fromEmpId === emp.id &&
                                    fromDateStr &&
                                    fromDateStr !== targetDateStr &&
                                    onDragDropShift
                                  ) {
                                    onDragDropShift(emp.id, fromDateStr, targetDateStr);
                                  }
                                  setDraggedCell(null);
                                }
                          }
                          isCompact={true}
                          hideHoursRow={true}
                          swatchOnly={true}
                          isIllegalTarget={isIllegalTarget}
                          colorOnlyOnNarrow={false}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* 底部空白列：點擊開啟同仁設定 Modal 以新增；預排中隱藏 */}
            {onOpenEmployeeModal && !autoScheduleChrome && (
              <tr
                className="cursor-pointer hover:bg-[#F8F7EB] transition-colors border-t border-dashed border-[#D9D7C2]"
                onClick={onOpenEmployeeModal}
              >
                <td
                  colSpan={Math.max(1, datesList.length + 1)}
                  className="p-2.5 text-center"
                >
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5A5A40]">
                    <UserPlus className="w-4 h-4" />
                    點此新增同仁
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {floatingActionBar}
    </div>
  );

  // 全螢幕：portal 到 body；外層 inset 鋪滿，內層略偏上留白並強制撐滿可用高寬
  if (isFullscreen && typeof document !== 'undefined') {
    return (
      <>
        <div className="rounded-2xl border border-dashed border-[#D9D7C2] bg-[#F8F7EB] p-8 text-center text-sm text-[#8A8A70]">
          矩陣全螢幕檢視中（按 Esc 或點背景關閉）
        </div>
        {createPortal(
          <div className="fixed inset-0 z-[80]">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsFullscreen(false)}
              aria-hidden
            />
            {/* 上緣略少、下緣略多 → 視覺略偏上，同時面板撐滿剩餘區域 */}
            <div className="absolute inset-0 z-[81] p-3 pt-2 pb-8 sm:p-4 sm:pt-3 sm:pb-10 pointer-events-none">
              <div className="pointer-events-auto h-full w-full min-h-0 min-w-0">
                {panel}
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  return panel;
};
