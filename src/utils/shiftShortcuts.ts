import { ShiftType } from '../types';
import { EMPTY_SHIFT_TYPE_ID } from '../constants/shifts';

/**
 * 允許作為班別快捷鍵的字元集合。
 * 含數字 0–9、英文字母 A–Z，以及 ,./;'[]\=- 等符號；不含控制鍵。
 */
const ALLOWED_SHORTCUT_CHARS = new Set<string>([
  ...'0123456789',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ',',
  '.',
  '/',
  ';',
  "'",
  '[',
  ']',
  '\\',
  '=',
  '-',
]);

/**
 * 將按鍵正規化為儲存用快捷鍵字元（字母轉大寫）。
 * @param key KeyboardEvent.key 或輸入字串
 * @returns 合法單字元；不合法則回傳 null
 */
export function normalizeShortcutKey(key: string): string | null {
  if (!key || key.length !== 1) return null;
  const normalized = /[a-z]/.test(key) ? key.toUpperCase() : key;
  return ALLOWED_SHORTCUT_CHARS.has(normalized) ? normalized : null;
}

/**
 * 檢查字串是否為允許的快捷鍵（或空字串表示未設定）。
 * @param key 候選快捷鍵
 * @returns 是否合法
 */
export function isAllowedShortcutKey(key: string): boolean {
  if (key === '') return true;
  return normalizeShortcutKey(key) !== null;
}

/**
 * 自鍵盤事件取出可用快捷鍵字元。
 * 有 Ctrl／Meta／Alt／Shift 修飾鍵時一律拒絕（不適用控制鍵）。
 * @param e 鍵盤事件
 * @returns 正規化後字元；無法使用則 null
 */
export function getShortcutKeyFromEvent(e: KeyboardEvent): string | null {
  // 拒絕修飾鍵組合與純控制鍵（Tab、CapsLock、Escape 等）
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return null;
  return normalizeShortcutKey(e.key);
}

/**
 * 判斷焦點是否在可輸入元件內（此時不攔截班別快捷鍵）。
 * @param target 事件目標
 * @returns 是否應略過快捷鍵
 */
export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

/**
 * 依按下的快捷鍵解析應對應的班別 ID（含「空」清除）。
 * @param pressedKey 已正規化的快捷鍵
 * @param shiftTypes 班別清單
 * @param emptyShortcutKey 「空」清除鈕快捷鍵；空字串表示未設定
 * @returns 班別 ID；無對應時 null
 */
export function resolveShiftIdByShortcut(
  pressedKey: string,
  shiftTypes: ShiftType[],
  emptyShortcutKey: string
): string | null {
  if (!pressedKey) return null;
  if (emptyShortcutKey && emptyShortcutKey === pressedKey) {
    return EMPTY_SHIFT_TYPE_ID;
  }
  const matched = shiftTypes.find((st) => st.shortcutKey && st.shortcutKey === pressedKey);
  return matched?.id ?? null;
}

/**
 * 檢查快捷鍵是否已被其他班別或「空」佔用。
 * @param key 欲設定的快捷鍵（空字串略過）
 * @param shiftTypes 班別清單
 * @param emptyShortcutKey 「空」清除快捷鍵
 * @param excludeShiftId 編輯中班別 ID（可排除自身）；檢查「空」時傳 null
 * @param checkingEmpty 是否正在檢查「空」的捷徑本身
 * @returns 衝突說明；無衝突回傳 null
 */
export function findShortcutConflict(
  key: string,
  shiftTypes: ShiftType[],
  emptyShortcutKey: string,
  excludeShiftId: string | null,
  checkingEmpty = false
): string | null {
  if (!key) return null;
  if (!checkingEmpty && emptyShortcutKey === key) {
    return '已由「空」（清除排班）使用';
  }
  const conflict = shiftTypes.find(
    (st) => st.shortcutKey === key && st.id !== excludeShiftId
  );
  if (conflict) {
    return `已由「${conflict.code}」${conflict.name}使用`;
  }
  return null;
}
