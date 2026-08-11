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
  Keyboard,
} from 'lucide-react';

/** 使用說明章節分類。 */
type GuideCategory = 'operate' | 'interpret';

/**
 * 章節內嵌截圖定義。
 */
interface GuideImage {
  /** 截圖路徑（public/guide）。 */
  src: string;
  /** 截圖替代文字。 */
  alt: string;
  /** 截圖下方簡短說明。 */
  caption: string;
}

/**
 * 使用說明章節定義（含截圖）。
 */
interface GuideSection {
  /** 章節識別碼。 */
  id: string;
  /** 所屬分類。 */
  category: GuideCategory;
  /** 側欄標題。 */
  title: string;
  /** 圖示元件。 */
  icon: React.ReactNode;
  /** 章節說明段落。 */
  paragraphs: string[];
  /** 操作步驟清單。 */
  steps: string[];
  /** 對應截圖（可多張）。 */
  images: GuideImage[];
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

/** 分類標題。 */
const CATEGORY_LABELS: Record<GuideCategory, string> = {
  operate: '操作說明',
  interpret: '資訊判讀',
};

/** 使用說明章節：操作說明／資訊判讀兩大類。 */
const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'select',
    category: 'operate',
    title: '點選與批次換班',
    icon: <CheckSquare className="w-5 h-5" />,
    paragraphs: [
      '在班表格子上點擊即可選取日期；可單選一日，也可多選後一次套用班別。',
      '選取後畫面下方會出現深色操作列，顯示已選天數與可用班別按鈕；點擊班別即可一次套用至所有選取日期。',
      '範圍選取：先點一日作為起點，再按住 Shift 點另一日，可一次選取兩日之間的連續日期。也可用 Ctrl／⌘ 逐日加減選取。',
    ],
    steps: [
      '點擊日期格子進行單選；再點其他格子可累加為多選（選取中會顯示勾選與外框）。',
      '按住 Shift 再點另一日期，可範圍選取起迄之間的多日。',
      '於下方操作列點選目標班別（早／中／夜／全／休／例／國／調／空等）。',
      '需要新班別時可按操作列右側「＋」新增；按「取消」可清除選取。',
    ],
    images: [
      {
        src: '/guide/01-select-shifts.png',
        alt: '多選日期後以下方操作列批次更換班別',
        caption: '範例：已選多日，藉由底部操作列一次套用班別',
      },
    ],
  },
  {
    id: 'hotkeys',
    category: 'operate',
    title: '快捷鍵快速套用',
    icon: <Keyboard className="w-5 h-5" />,
    paragraphs: [
      '選取日期後，除了點操作列的班別按鈕，也可直接按下已設定的快捷鍵，立刻套用到所有選取日期。',
      '操作列按鈕右上方若顯示數字或字母（例如 3、6、7、0），即表示該班別已綁定快捷鍵。',
      '快捷鍵可在「設定 → 班別設定」中為各班別指定（支援 0–9、A–Z 與部分符號鍵）；「空」清除亦可設定快捷鍵。',
    ],
    steps: [
      '先以點選或 Shift 範圍選取要換班的日期。',
      '確認操作列上目標班別旁的快捷鍵標示。',
      '按下對應按鍵即可批次套用（與點擊班別按鈕效果相同）。',
      '若要新增或修改快捷鍵：開啟「設定 → 班別設定」，於「⌨️ 快捷鍵」欄位按下欲使用的按鍵後儲存。',
    ],
    images: [
      {
        src: '/guide/07-hotkeys-apply.png',
        alt: '選取多日後以快捷鍵套用班別',
        caption: '範例：操作列顯示快捷鍵標示，可按鍵快速套用',
      },
      {
        src: '/guide/08-hotkeys-settings.png',
        alt: '班別設定中為班別指定快捷鍵',
        caption: '範例：在班別設定為各班別綁定快捷鍵（如夜班＝3）',
      },
    ],
  },
  {
    id: 'drag',
    category: 'operate',
    title: '拖曳交換班別',
    icon: <ArrowRightLeft className="w-5 h-5" />,
    paragraphs: [
      '除了點選套用，也可直接拖曳班別卡片與其他日期交換位置，適合微調既有排班順序。',
      '請抓住班別卡片上方的六點拖曳把手（⋮⋮）再拖到目標日期放開。',
    ],
    steps: [
      '將游標移到班別卡片頂部中央的六點把手。',
      '按住拖曳至目標日期格子上方，放開即可交換（或覆寫至該日）。',
      '拖曳過程中會出現半透明預覽，方便確認放置位置。',
    ],
    images: [
      {
        src: '/guide/02-drag-swap.png',
        alt: '以拖曳把手交換兩個日期的班別',
        caption: '範例：抓住六點把手拖動班別進行交換',
      },
    ],
  },
  {
    id: 'pin',
    category: 'operate',
    title: '大頭針釘選班別',
    icon: <Pin className="w-5 h-5" />,
    paragraphs: [
      '點擊班別卡片上方工具列的大頭針圖示，可將該日班別釘選鎖定（不可改班、平移或拖放覆蓋）。',
      '已釘選的日期會以橘色大頭針／邊框標示；加班與換休仍可於卡片底部調整，僅班別本身不動。',
    ],
    steps: [
      '在班別卡片頂部點擊大頭針圖示開啟釘選。',
      '再次點擊同一圖示可取消釘選。',
      '需要保留固定假日、特定班次時，建議先釘選再進行批次調整。',
    ],
    images: [
      {
        src: '/guide/03-pin-shifts.png',
        alt: '以大頭針釘選鎖定特定日期的班別',
        caption: '範例：橘色大頭針表示該日班別已鎖定（加班仍可登錄）',
      },
    ],
  },
  {
    id: 'overtime',
    category: 'operate',
    title: '紀錄加班與換休',
    icon: <Clock3 className="w-5 h-5" />,
    paragraphs: [
      '工作班、休息日、國定假日／休假以及「調」班，皆可於卡片底部用「＋／−」或直接點擊時數登錄出勤加班；空班不可登錄。',
      '按「＋」以 0.5 小時為單位增加延長工時；若當日已有換休，則「＋」會先還原換休。按「−」時：當日有加班先取消加班；已無加班且為工作班時，才從本月加班庫存支用換休。',
      '也可直接點擊時數數字輸入當日顯示總工時（例：正常 8H 輸入 9 → 延長 1H；放假日輸入 4 → 當日出勤 4H）。已釘選日期仍可調整加班／換休，僅班別不可改。',
      '【法規提醒】休息日／休假經同意可加班；例假日原則禁止加班（僅天災、事變或突發事件例外，勞基法第 36、40 條）。例假色塊會標「例」，首次登錄會跳出確認，詳見「說明 → 法規說明」。本系統不計算加班費。',
    ],
    steps: [
      '選定日期（工作班、休、國、調均可；例假可登錄但會提醒原則禁止）。',
      '點擊卡片底部「＋」逐次登錄加班，或點擊時數數字直接輸入。',
      '若為例假（或調→例），閱讀跳出的法規提醒後再決定是否仍要登錄。',
      '用「−」取消加班；工作班且已無加班時，「−」改為支用換休。',
      '再到班表檢核表確認「延長工時」與「例假日原則禁止加班」等提示。',
    ],
    images: [
      {
        src: '/guide/05-overtime-comp.png',
        alt: '班別卡片底部加減鈕用於登錄加班或換休',
        caption: '範例：卡片底部的「＋」可用於紀錄加班（顯示如 8H ＋）',
      },
    ],
  },
  {
    id: 'audit',
    category: 'interpret',
    title: '檢視可能不合規排班',
    icon: <ShieldCheck className="w-5 h-5" />,
    paragraphs: [
      '排班過程中，系統會即時依所選工時制度（一般／2 週／4 週／8 週變形工時）與內建規則進行模擬檢核。',
      '「班表檢核表」會彙總正常工時、延長工時、最大連班天數與例休天數；若有觸發項目，頂部會顯示需留意提示。',
      '下方「規則檢核明細／風險提示」會列出法條與對應日期，可點選對應日期連結，快速定位問題日子。',
    ],
    steps: [
      '先確認上方已選對正確的工時制度與同仁。',
      '檢視班表檢核表：紅色指標代表超出規則上限（例如週期正常工時超標）。',
      '展開規則檢核明細閱讀說明，並點「對應日期」在班表上定位。',
      '可點「模擬檢核：發現 N 項需留意（點擊查看法規說明）」進一步了解相關規則依據；完整法條摘要亦見頂部「說明 → 法規說明」。',
    ],
    images: [
      {
        src: '/guide/04-labor-audit.png',
        alt: '班表檢核表與規則檢核明細畫面',
        caption: '範例：週期正常工時超標時的模擬檢核畫面',
      },
    ],
  },
  {
    id: 'ot-warning',
    category: 'interpret',
    title: '警告加班時數',
    icon: <Gauge className="w-5 h-5" />,
    paragraphs: [
      '當累積延長工時接近或超過法定／參考上限時，班表檢核表會以紅色進度條與警示文字提醒。',
      '常見警示包含「每月延長工時超限」（例如累積超過 46H）、「週期延長工時偏高」，以及「例假日原則禁止加班」（第 36／40 條）；規則明細會標示法條與對應日期。',
      '可點明細項目的「對應日期」連結，快速回到班表調整；完整條文摘要見頂部「說明 → 法規說明」。',
    ],
    steps: [
      '開啟班表檢核表，查看「延長工時」卡片是否變紅或超出上限。',
      '閱讀下方規則檢核明細（含例假加班警告）與對應日期。',
      '回到班表以「−」取消過量或不宜之加班，或在其他日支用換休，再確認警示是否解除。',
    ],
    images: [
      {
        src: '/guide/06-overtime-warning.png',
        alt: '延長工時超限時的班表檢核與規則提示',
        caption: '範例：延長工時 64H 超過 46H 上限時的紅色警告',
      },
    ],
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
      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-black/65 px-2.5 py-1 text-xs font-bold text-white">
        <ZoomIn className="w-3.5 h-3.5" />
        點擊看清楚
      </span>
    </button>
    <figcaption className="text-sm text-[#8A8A70]">{caption}</figcaption>
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
        <p className="mt-3 text-sm text-white/80 text-center">
          {alt} · 放大以便看清楚細節 · 點擊背景或按 Esc 關閉
        </p>
      </div>
    </div>
  );
};

/**
 * 排班使用說明：側欄分為操作說明與資訊判讀兩類。
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

  const operateSections = GUIDE_SECTIONS.filter((section) => section.category === 'operate');
  const interpretSections = GUIDE_SECTIONS.filter((section) => section.category === 'interpret');

  /**
   * 渲染某一分類下的章節按鈕列。
   *
   * @param category 分類
   * @param sections 該分類章節
   * @param startIndex 側欄顯示編號起點（1-based）
   */
  const renderCategoryNav = (
    category: GuideCategory,
    sections: GuideSection[],
    startIndex: number
  ) => (
    <div className="space-y-1 min-w-max sm:min-w-0">
      <p className="px-1 pt-1 pb-0.5 text-[11px] font-bold tracking-wide text-[#8A8A70] uppercase">
        {CATEGORY_LABELS[category]}
      </p>
      {sections.map((section, index) => {
        const isActive = section.id === activeSection.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveSectionId(section.id)}
            className={`w-full shrink-0 px-3 py-2.5 rounded-xl text-left text-sm font-bold transition-colors cursor-pointer flex items-center gap-2 ${
              isActive
                ? 'bg-[#5A5A40] text-white'
                : 'bg-[#F8F7EB] text-[#5A5A40] hover:bg-[#E9E7D4]'
            }`}
          >
            <span className={`inline-flex ${isActive ? 'text-white' : 'text-[#5A5A40]'}`}>
              {section.icon}
            </span>
            <span>
              {startIndex + index}. {section.title}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#E9E7D4] rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-xl text-[#2D2D2D] space-y-4 my-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-[#E9E7D4] pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl border border-[#5A5A40]/20">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#2D2D2D] font-serif">排班模擬系統 — 使用說明</h2>
              <p className="text-sm text-[#8A8A70]">操作說明與資訊判讀</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8A8A70] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] transition-colors cursor-pointer"
            aria-label="關閉使用說明"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 min-h-112">
          <nav className="sm:w-56 shrink-0 flex sm:flex-col gap-3 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0">
            {renderCategoryNav('operate', operateSections, 1)}
            {renderCategoryNav('interpret', interpretSections, operateSections.length + 1)}
          </nav>

          <div className="flex-1 max-h-128 overflow-y-auto pr-1 space-y-4 text-sm leading-relaxed">
            <div className="rounded-xl border border-[#E9E7D4] bg-[#F8F7EB] px-3 py-2 flex items-start gap-2 text-[#5A5A40]">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>
                目前為「{CATEGORY_LABELS[activeSection.category]}」。預覽圖會顯示完整畫面；若要看清細節，可
                <strong className="font-bold">點擊放大</strong>
                。放大後可按右上角關閉、點擊背景或按 Esc 關閉。
              </p>
            </div>

            <section className="space-y-3">
              <h3 className="text-base font-bold text-[#5A5A40] flex items-center gap-2">
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

              <div className="space-y-4">
                {activeSection.images.map((image) => (
                  <GuideImageThumb
                    key={image.src}
                    src={image.src}
                    alt={image.alt}
                    caption={image.caption}
                    onExpand={() => setLightbox({ src: image.src, alt: image.alt })}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>

        <div className="pt-3 border-t border-[#E9E7D4] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-sm rounded-xl shadow-sm transition-colors cursor-pointer"
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
