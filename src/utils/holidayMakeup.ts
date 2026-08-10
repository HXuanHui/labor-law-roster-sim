import { format, parseISO } from 'date-fns';
import { NationalHoliday } from '../types';

/**
 * 國定假日逢週末時系統建議之補假提案。
 */
export interface MakeupProposal {
  /** 原國定假日日期 YYYY-MM-DD。 */
  originalDate: string;
  /** 原日星期：0=日、6=六。 */
  originalWeekday: 0 | 6;
  /** 原日中文星期標籤（例：星期六）。 */
  originalWeekdayLabel: string;
  /** 建議補假日期 YYYY-MM-DD（已避開既有假日）。 */
  makeupDate: string;
  /** 補假日中文星期標籤。 */
  makeupWeekdayLabel: string;
  /**
   * 審查時替補的配額類型。
   * 原日六 → rest；原日日 → mandatory（依被佔用之休／例）。
   */
  substitutesFor: 'rest' | 'mandatory';
  /** substitutesFor 中文標籤。 */
  substitutesForLabel: string;
  /** 首個候選日（六→五、日→一），未遞延前。 */
  preferredMakeupDate: string;
  /** 是否因撞日而往前／後遞延。 */
  wasDeferred: boolean;
}

/**
 * 批次確認用：連同原假日顯示資訊的補假提案。
 */
export interface PendingMakeupItem extends MakeupProposal {
  /** 原假日名稱。 */
  originalName: string;
  /** 是否法定。 */
  isStatutory: boolean;
}

const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'] as const;

/** 遞延搜尋安全上限（天），避免異常資料造成無限迴圈。 */
const MAX_DEFER_DAYS = 366;

/**
 * 將 Date 格式化為 YYYY-MM-DD（本地日曆日）。
 * @param d 日期物件
 * @returns 日期字串
 */
function formatYmd(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/**
 * 解析 YYYY-MM-DD 為本地正午，避免跨時區造成星期計算偏移。
 * @param dateStr 日期字串
 * @returns Date
 */
function parseLocalDate(dateStr: string): Date {
  return parseISO(`${dateStr}T12:00:00`);
}

/**
 * 依原國定假日星期推導補假應替補之休／例配額。
 * @param originalWeekday 0=日、6=六
 * @returns rest 或 mandatory
 */
export function resolveSubstitutesFor(
  originalWeekday: 0 | 6
): 'rest' | 'mandatory' {
  // 六原本應為休息日、日應為例假日；國假覆寫後由補假「調」填回配額
  return originalWeekday === 6 ? 'rest' : 'mandatory';
}

/**
 * 自既有補假紀錄推導 substitutesFor（相容舊資料缺欄位）。
 * @param holiday 補假紀錄
 * @returns rest／mandatory；無法推導時 undefined
 */
export function inferSubstitutesFor(
  holiday: Pick<NationalHoliday, 'substitutesFor' | 'sourceDate' | 'kind'>
): 'rest' | 'mandatory' | undefined {
  if (holiday.substitutesFor) return holiday.substitutesFor;
  if (!holiday.sourceDate) return undefined;
  const day = parseLocalDate(holiday.sourceDate).getDay();
  if (day === 6) return 'rest';
  if (day === 0) return 'mandatory';
  return undefined;
}

/**
 * 國定假日逢星期六、日時，計算建議補假日。
 * 規則：
 * - 六 → 往前找（先五；若已有假則四、三…）
 * - 日 → 往後找（先一；若已有假則二、三…）
 * - 持續跳過「已有假日」與週末，直到找到可放假之工作日
 * @param dateStr 原國定假日 YYYY-MM-DD
 * @param occupiedDates 已佔用日期（既有假日＋本批已排補假）
 * @returns 補假提案；平日回傳 null
 */
export function proposeMakeupDate(
  dateStr: string,
  occupiedDates: Iterable<string> = []
): MakeupProposal | null {
  const d = parseLocalDate(dateStr);
  const day = d.getDay();

  // 僅星期六、日需要挪移補假
  if (day !== 0 && day !== 6) return null;

  const occupied = new Set(occupiedDates);
  // 原日本身不算可落點（理論上方向也不會走到），保險排除
  occupied.add(dateStr);

  // 六往前、日往後
  const step = day === 6 ? -1 : 1;
  const makeup = new Date(d);
  makeup.setDate(makeup.getDate() + step);

  const preferredMakeupDate = formatYmd(makeup);

  // --- 撞日／逢週末則繼續遞延 ---
  let guard = 0;
  while (guard < MAX_DEFER_DAYS) {
    const candidate = formatYmd(makeup);
    const candidateDow = makeup.getDay();
    const isWeekend = candidateDow === 0 || candidateDow === 6;
    if (!occupied.has(candidate) && !isWeekend) {
      break;
    }
    makeup.setDate(makeup.getDate() + step);
    guard++;
  }

  if (guard >= MAX_DEFER_DAYS) {
    // 異常：一年內找不到空檔，放棄提案
    return null;
  }

  const makeupDate = formatYmd(makeup);
  const originalWeekday = day as 0 | 6;
  const substitutesFor = resolveSubstitutesFor(originalWeekday);

  return {
    originalDate: dateStr,
    originalWeekday,
    originalWeekdayLabel: WEEKDAY_LABELS[day],
    makeupDate,
    makeupWeekdayLabel: WEEKDAY_LABELS[makeup.getDay()],
    substitutesFor,
    substitutesForLabel: substitutesFor === 'rest' ? '休息日' : '例假日',
    preferredMakeupDate,
    wasDeferred: makeupDate !== preferredMakeupDate,
  };
}

/**
 * 依原假日名稱組成補假顯示名稱。
 * @param originalName 原國定假日名稱
 * @returns 補假名稱
 */
export function buildMakeupHolidayName(originalName: string): string {
  const base = originalName.trim() || '國定假日';
  // 避免名稱重複堆疊「補假」字樣
  if (base.includes('補假')) return base;
  return `${base} 補假`;
}

/**
 * 組出待寫入之補假 NationalHoliday 欄位（不含 id）。
 * 手動新增與批次掃描皆走此函式，確保 substitutesFor／sourceDate 一定寫入。
 * @param proposal 補假提案
 * @param originalName 原假日名稱
 * @param isStatutory 是否沿用法定標記
 * @returns 補假資料（缺 id）
 */
export function buildMakeupHolidayPayload(
  proposal: MakeupProposal,
  originalName: string,
  isStatutory: boolean
): Omit<NationalHoliday, 'id'> {
  return {
    date: proposal.makeupDate,
    name: buildMakeupHolidayName(originalName),
    isStatutory,
    kind: 'makeup',
    sourceDate: proposal.originalDate,
    // 依原日佔用的是六（休）或日（例）記錄，供審查計入對應配額
    substitutesFor: proposal.substitutesFor,
  };
}

/**
 * 找出與指定原日關聯之補假紀錄。
 * @param holidays 現行假日清單
 * @param sourceDate 原國定假日日期
 * @returns 關聯補假陣列
 */
export function findMakeupHolidaysForSource(
  holidays: NationalHoliday[],
  sourceDate: string
): NationalHoliday[] {
  return holidays.filter(
    (h) => h.kind === 'makeup' && h.sourceDate === sourceDate
  );
}

/**
 * 判斷清單中是否已有同一日期之假日。
 * @param holidays 現行假日清單
 * @param dateStr 欲檢查日期
 * @returns 是否已存在
 */
export function hasHolidayOnDate(
  holidays: NationalHoliday[],
  dateStr: string
): boolean {
  return holidays.some((h) => h.date === dateStr);
}

/**
 * 掃描假日清單，收集「原日逢六／日且尚未建立補假」的待確認提案。
 * 依日期排序後逐筆規劃，後筆會避開前筆已佔用之補假日（自動遞延）。
 * @param holidays 現行國定／自訂假日
 * @returns 待確認補假項目
 */
export function collectPendingMakeupProposals(
  holidays: NationalHoliday[]
): PendingMakeupItem[] {
  // 既有假日皆視為已佔用
  const occupied = new Set(holidays.map((h) => h.date));
  const items: PendingMakeupItem[] = [];

  // 週末原日依日期排序，讓遞延決策穩定可預期
  const weekendOriginals = holidays
    .filter((h) => h.kind !== 'makeup')
    .filter((h) => {
      const dow = parseLocalDate(h.date).getDay();
      return dow === 0 || dow === 6;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const h of weekendOriginals) {
    // 已有 sourceDate 關聯補假 → 略過
    if (findMakeupHolidaysForSource(holidays, h.date).length > 0) continue;

    const proposal = proposeMakeupDate(h.date, occupied);
    if (!proposal) continue;

    // 預佔此補假日，避免同批下一筆撞上
    occupied.add(proposal.makeupDate);

    items.push({
      ...proposal,
      originalName: h.name,
      isStatutory: h.isStatutory,
    });
  }

  return items.sort((a, b) => a.makeupDate.localeCompare(b.makeupDate));
}
