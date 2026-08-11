import React from 'react';
import { getShortcutKeyFromEvent } from '../utils/shiftShortcuts';

interface ShortcutKeyFieldProps {
  /** 目前快捷鍵；空字串表示未設定。 */
  value: string;
  /**
   * 變更回呼。
   * @param next 新快捷鍵（空字串＝清除）
   */
  onChange: (next: string) => void;
  /** 額外 className。 */
  className?: string;
  /** 輸入框 id（方便 label 關聯）。 */
  id?: string;
}

/**
 * 班別快捷鍵擷取欄位：聚焦後按鍵寫入；Backspace／Delete 清除。
 * 僅接受 0–9、A–Z、,./;'[]\=-，並拒絕修飾鍵組合。
 */
export const ShortcutKeyField: React.FC<ShortcutKeyFieldProps> = ({
  value,
  onChange,
  className = '',
  id,
}) => {
  /**
   * 攔截按鍵並寫入合法快捷鍵。
   * @param e 鍵盤事件
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 保留 Tab 讓焦點可正常移動
    if (e.key === 'Tab') return;

    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Backspace' || e.key === 'Delete') {
      onChange('');
      return;
    }

    const next = getShortcutKeyFromEvent(e.nativeEvent);
    if (next) onChange(next);
  };

  return (
    <input
      id={id}
      type="text"
      readOnly
      value={value || ''}
      onKeyDown={handleKeyDown}
      // 點擊時選取顯示內容，方便使用者知道可直接覆寫
      onFocus={(e) => e.currentTarget.select()}
      placeholder="按鍵…"
      title="點選後按鍵設定；Backspace 清除。允許 0–9、A–Z、,./;'[]\\=-"
      className={`w-full bg-[#F8F7EB] border border-[#D9D7C2] rounded-lg px-2 py-1 text-sm font-mono text-center tracking-wider outline-none focus:ring-2 focus:ring-[#5A5A40] cursor-pointer ${className}`}
      aria-label="班別快捷鍵"
    />
  );
};
