import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  X,
  ShieldCheck,
  Pin,
  ArrowRightLeft,
  CheckSquare,
  ZoomIn,
  AlertTriangle,
  Clock3,
  Gauge,
} from 'lucide-react';

/**
 * 使用說明指南章節定義。
 */
interface GuideSection {
  /** 章節識別碼。 */
  id: string;
  /** 側欄標題。 */
  title: string;
  /** 圖示元件。 */
  icon: React.ReactNode;
  /** 章節說明段落。 */
  paragraphs: string[];
  /** 操作步驟清單。 */
  steps: string[];
  /** 對應截圖路徑（public/guide）。 */
  imageSrc: string;
  /** 截圖替代文字。 */
  imageAlt: string;
  /** 截圖下方簡短說明。 */
  imageCaption: string;
}

/**
 * 使用說明 Modal 屬性。
 */
interface UserGuideModalProps {
  /** 是否顯示。 */
  isOpen: boolean;
  /** 關閉回呼。 */
  onClose: () => void;
}

/** 使用說明主軸章節（點選、拖曳、釘選、診斷、加班／換休）。 */
const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'select',
    title: '點選與批次換班',
    icon: <CheckSquare className="w-4 h-4" />,
    paragraphs: [
      '在班表格子上點擊即可選取日期；可單選一日，也可連續點選多日進行多選。',
      '選取後畫面下方會出現深色操作列，顯示已選天數與可用班別按鈕；點擊班別即可一次套用至所有選取日期。',
    ],
    steps: [
      '點擊日期格子進行單選；再點其他格子可累加為多選（選取中會顯示勾選與外框）。',
      '於下方操作列點選目標班別（早／中／夜／全／休／例／國／調／空等）。',
      '需要新班別時可按操作列右側「＋」新增；按「取消」可清除選取。',
    ],
    imageSrc: '/guide/01-select-shifts.png',
    imageAlt: '多選日期後以下方操作列批次更換班別',
    imageCaption: '範例：已選 3 日，藉由底部操作列一次套用班別',
  },
  {
    id: 'drag',
    title: '拖曳交換班別',
    icon: <ArrowRightLeft className="w-4 h-4" />,
    paragraphs: [
      '除了點選套用，也可直接拖曳班別卡片與其他日期交換位置，適合微調既有排班順序。',
      '請抓住班別卡片上方的六點拖曳把手（⋮⋮）再拖到目標日期放開。',
    ],
    steps: [
      '將游標移到班別卡片頂部中央的六點把手。',
      '按住拖曳至目標日期格子上方，放開即可交換（或覆寫至該日）。',
      '拖曳過程中會出現半透明預覽，方便確認放置位置。',
    ],
    imageSrc: '/guide/02-drag-swap.png',
    imageAlt: '以拖曳把手交換兩個日期的班別',
    imageCaption: '範例：抓住六點把手拖動班別進行交換',
  },
  {
    id: 'pin',
    title: '大頭針釘選班別',
    icon: <Pin className="w-4 h-4" />,
    paragraphs: [
      '點擊班別卡片上方工具列的大頭針圖示，可將該日班別釘選鎖定。',
      '已釘選的日期會以橘色大頭針／邊框標示，可避免後續批次套用或輔助調整時被意外覆蓋。',
    ],
    steps: [
      '在班別卡片頂部點擊大頭針圖示開啟釘選。',
      '再次點擊同一圖示可取消釘選。',
      '需要保留固定假日、特定班次時，建議先釘選再進行批次調整。',
    ],
    imageSrc: '/guide/03-pin-shifts.png',
    imageAlt: '以大頭針釘選鎖定特定日期的班別',
    imageCaption: '範例：橘色大頭針表示該日班別已鎖定',
  },
  {
    id: 'audit',
    title: '診斷非法排班',
    icon: <ShieldCheck className="w-4 h-4" />,
    paragraphs: [
      '排班過程中，系統會即時依所選工時制度（一般／2 週／4 週／8 週變形工時）檢核勞基法規範。',
      '「班表檢核表」會彙總正常工時、延長工時、最大連班天數與例休天數；若有違規，頂部會顯示嚴重違規提示。',
      '下方「勞動檢查診斷明細」會列出法條與對應日期，可點選對應日期連結，快速定位問題日子。',
    ],
    steps: [
      '先確認上方已選對正確的工時制度與同仁。',
      '檢視班表檢核表：紅色指標代表超出法定上限（例如週期正常工時超標）。',
      '展開診斷明細閱讀違規說明，並點「對應日期」在班表上定位。',
      '可點「勞檢失敗（點此查看法規說明）」進一步了解相關法規依據。',
    ],
    imageSrc: '/guide/04-labor-audit.png',
    imageAlt: '班表檢核表與勞動檢查診斷明細畫面',
    imageCaption: '範例：週期正常工時超標時的違規診斷畫面',
  },
  {
    id: 'overtime',
    title: '紀錄加班與換休',
    icon: <Clock3 className="w-4 h-4" />,
    paragraphs: [
      '在已排工作班的日期卡片底部，可看到顯示工時（如 8H）與「＋／−」按鈕，用來登錄延長工時或支用換休。',
      '按「＋」會以 0.5 小時為單位增加延長工時（卡片顯示總工時會上升，例如 8H → 8.5H → …）；若當日已有換休，則「＋」會先還原換休。',
      '按「−」時：若當日已有加班，會先取消加班（延長工時同步減少）；當日已無加班時，才會從本月加班庫存支用換休，縮短當日顯示工時。',
      '也可直接點擊時數數字手動輸入當日總工時；已釘選的日期不可調整加班／換休。',
    ],
    steps: [
      '先為該日排好工作班別（休／例／空等非出勤日通常不可登錄加班）。',
      '點擊卡片底部「＋」逐次登錄加班；再點「−」可取消加班或改為支用換休。',
      '或直接點擊「8H」等時數文字，輸入目標總工時後確認。',
      '注意單日加班有上限，且換休不可超過本月累積的加班庫存。',
      '調整後請再到班表檢核表確認「延長工時」與相關診斷是否仍合規。',
    ],
    imageSrc: '/guide/05-overtime-comp.png',
    imageAlt: '班別卡片底部加減鈕用於登錄加班或換休',
    imageCaption: '範例：卡片底部的「＋」可用於紀錄加班（顯示如 8H ＋）',
  },
  {
    id: 'ot-warning',
    title: '警告加班時數',
    icon: <Gauge className="w-4 h-4" />,
    paragraphs: [
      '當累積延長工時接近或超過法定／參考上限時，班表檢核表會以紅色進度條與警示文字提醒。',
      '常見警示包含「每月延長工時超限」（例如累積超過 46H）以及「週期延長工時偏高」；診斷明細會標示法條（如勞基法第 32 條）與對應日期區間。',
      '可點診斷項目的「對應日期」連結，快速回到班表定位需要調整加班或改安排換休的日子。',
    ],
    steps: [
      '開啟班表檢核表，查看「延長工時」卡片是否變紅或超出上限。',
      '閱讀下方診斷明細中的超限說明與對應日期。',
      '回到班表以「−」取消過量加班，或在其他日支用換休降低壓力，再確認警示是否解除。',
    ],
    imageSrc: '/guide/06-overtime-warning.png',
    imageAlt: '延長工時超限時的班表檢核與診斷警示',
    imageCaption: '範例：延長工時 64H 超過 46H 上限時的紅色警告',
  },
];

/**
 * 指南截圖預覽：完整顯示整張圖；點擊後放大以便看清楚細節。
 *
 * @param props.src 圖片路徑
 * @param props.alt 替代文字
 * @param props.caption 圖片說明
 * @param props.onExpand 點擊放大回呼
 */
const GuideImageThumb: React.FC<{
  src: string;
  alt: string;
  caption: string;
  onExpand: () => void;
}> = ({ src, alt, caption, onExpand }) => (
  <figure className="space-y-1.5">
    <button
      type="button"
      onClick={onExpand}
      className="group relative w-full rounded-xl border border-[#E9E7D4] bg-[#F8F7EB] cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5A5A40]"
      aria-label={`點擊放大看清楚：${alt}`}
    >
      {/* 預覽必須看完整張圖，不可裁切；放大用途是細節，不是補看缺角 */}
      <img
        src={src}
        alt={alt}
        className="w-full h-auto object-contain transition-opacity duration-200 group-hover:opacity-95"
        loading="lazy"
      />
      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-black/65 px-2 py-1 text-[10px] font-bold text-white">
        <ZoomIn className="w-3 h-3" />
        點擊看清楚
      </span>
    </button>
    <figcaption className="text-[11px] text-[#8A8A70]">{caption}</figcaption>
  </figure>
);

/**
 * 全螢幕圖片預覽層：點擊背景或關閉鈕可關閉。
 *
 * @param props.src 圖片路徑
 * @param props.alt 替代文字
 * @param props.onClose 關閉回呼
 */
const ImageLightbox: React.FC<{
  src: string;
  alt: string;
  onClose: () => void;
}> = ({ src, alt, onClose }) => {
  // Escape 鍵關閉預覽，與關閉鈕／背景點擊行為一致
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-70 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="圖片放大預覽"
      onClick={onClose}
    >
      <div
        className="relative max-w-6xl w-full max-h-[92vh] flex flex-col items-center"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-2 -right-2 sm:top-0 sm:right-0 z-10 p-2 rounded-full bg-white text-[#2D2D2D] shadow-lg hover:bg-[#F8F7EB] cursor-pointer"
          aria-label="關閉放大圖片"
        >
          <X className="w-5 h-5" />
        </button>
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[88vh] object-contain rounded-lg shadow-2xl"
        />
        <p className="mt-3 text-xs text-white/80 text-center">{alt} · 放大以便看清楚細節 · 點擊背景或按 Esc 關閉</p>
      </div>
    </div>
  );
};

/**
 * 排班模擬系統使用說明指南：以操作主軸重寫，並嵌入可點開放大的截圖。
 *
 * @param props.isOpen 是否顯示
 * @param props.onClose 關閉回呼
 */
export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeSectionId, setActiveSectionId] = useState(GUIDE_SECTIONS[0].id);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  // 關閉說明 Modal 時一併關掉圖片預覽，避免殘留遮罩
  useEffect(() => {
    if (!isOpen) setLightbox(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const activeSection =
    GUIDE_SECTIONS.find((section) => section.id === activeSectionId) ?? GUIDE_SECTIONS[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#E9E7D4] rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-xl text-[#2D2D2D] space-y-4 my-6 animate-in zoom-in-95 duration-200">
        {/* 標題列 */}
        <div className="flex items-center justify-between border-b border-[#E9E7D4] pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl border border-[#5A5A40]/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2D2D2D] font-serif">排班模擬系統 — 使用說明指南</h2>
              <p className="text-xs text-[#8A8A70]">點選換班、拖曳交換、釘選鎖定、非法排班與加班換休</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8A8A70] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] transition-colors cursor-pointer"
            aria-label="關閉使用說明"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 min-h-112">
          {/* 章節導覽 */}
          <nav className="sm:w-48 shrink-0 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0">
            {GUIDE_SECTIONS.map((section, index) => {
              const isActive = section.id === activeSection.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSectionId(section.id)}
                  className={`shrink-0 px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                    isActive
                      ? 'bg-[#5A5A40] text-white'
                      : 'bg-[#F8F7EB] text-[#5A5A40] hover:bg-[#E9E7D4]'
                  }`}
                >
                  <span className={`inline-flex ${isActive ? 'text-white' : 'text-[#5A5A40]'}`}>
                    {section.icon}
                  </span>
                  <span>
                    {index + 1}. {section.title}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* 章節內容 */}
          <div className="flex-1 max-h-128 overflow-y-auto pr-1 space-y-4 text-xs leading-relaxed">
            <div className="rounded-xl border border-[#E9E7D4] bg-[#F8F7EB] px-3 py-2 flex items-start gap-2 text-[#5A5A40]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                預覽圖會顯示完整畫面；若要看清細節，可
                <strong className="font-bold">點擊放大</strong>
                。放大後可按右上角關閉、點擊背景或按 Esc 關閉。
              </p>
            </div>

            <section className="space-y-3">
              <h3 className="text-sm font-bold text-[#5A5A40] flex items-center gap-2">
                <span className="inline-flex text-[#5A5A40]">{activeSection.icon}</span>
                {activeSection.title}
              </h3>

              {activeSection.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-[#2D2D2D]">
                  {paragraph}
                </p>
              ))}

              <ol className="list-decimal list-inside space-y-1.5 text-[#5A5A40] bg-white border border-[#E9E7D4] rounded-xl p-3">
                {activeSection.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              <GuideImageThumb
                src={activeSection.imageSrc}
                alt={activeSection.imageAlt}
                caption={activeSection.imageCaption}
                onExpand={() =>
                  setLightbox({ src: activeSection.imageSrc, alt: activeSection.imageAlt })
                }
              />
            </section>
          </div>
        </div>

        <div className="pt-3 border-t border-[#E9E7D4] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            瞭解並關閉
          </button>
        </div>
      </div>

      {lightbox && (
        <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
};
