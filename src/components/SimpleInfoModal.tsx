import React from 'react';
import { X } from 'lucide-react';

/**
 * 輕量資訊 Modal 屬性（免責／法規／關於等佔位入口共用）。
 */
interface SimpleInfoModalProps {
  /** 是否顯示。 */
  isOpen: boolean;
  /** 關閉回呼。 */
  onClose: () => void;
  /** 標題。 */
  title: string;
  /** 副標說明。 */
  subtitle?: string;
  /** 標題旁圖示。 */
  icon?: React.ReactNode;
  /** 主體內容。 */
  children: React.ReactNode;
}

/**
 * 輕量資訊 Modal：供說明類頁面（免責、法規、關於）使用。
 *
 * @param props.isOpen 是否顯示
 * @param props.onClose 關閉回呼
 * @param props.title 標題
 * @param props.subtitle 副標
 * @param props.icon 標題圖示
 * @param props.children 主體內容
 */
export const SimpleInfoModal: React.FC<SimpleInfoModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="simple-info-modal-title"
        className="bg-white border border-[#E9E7D4] rounded-2xl max-w-lg w-full p-6 shadow-xl text-[#2D2D2D] space-y-4 my-8"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E9E7D4] pb-4">
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <div className="p-2.5 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl border border-[#5A5A40]/20 flex-shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2
                id="simple-info-modal-title"
                className="text-xl font-bold text-[#2D2D2D] font-serif"
              >
                {title}
              </h2>
              {subtitle && <p className="text-sm text-[#8A8A70] mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8A8A70] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] transition-colors cursor-pointer flex-shrink-0"
            aria-label={`關閉${title}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-sm leading-relaxed text-[#2D2D2D]">{children}</div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#5A5A40] hover:bg-[#484833] text-white text-sm font-bold transition-colors cursor-pointer"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
