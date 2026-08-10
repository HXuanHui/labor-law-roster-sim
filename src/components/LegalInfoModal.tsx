import React from 'react';
import { ExternalLink, Scale, X } from 'lucide-react';

/** 勞動部全國法規資料庫：勞動基準法全文（官方正確條文）。 */
const LABOR_STANDARDS_ACT_URL =
  'https://laws.mol.gov.tw/FLAW/FLAWDAT0201.aspx?id=FL014930';

/**
 * 法條摘要項目（本系統模擬檢核所對應之條文說明）。
 */
interface LegalArticleSummary {
  /** 條文名稱。 */
  article: string;
  /** 本系統如何套用／摘要。 */
  summary: string;
}

/**
 * 法規說明 Modal 屬性。
 */
interface LegalInfoModalProps {
  /** 是否顯示。 */
  isOpen: boolean;
  /** 關閉回呼。 */
  onClose: () => void;
}

/** 本系統模擬檢核主要對應之條文摘要（非正式全文；全文請以勞動部連結為準）。 */
const LEGAL_ARTICLE_SUMMARIES: LegalArticleSummary[] = [
  {
    article: '第 30 條第 1 項（一般工時）',
    summary:
      '勞工正常工作時間每日不得超過 8 小時、每週不得超過 40 小時。本系統「一般工時」制度以此為週期正常工時上限基準。',
  },
  {
    article: '第 30 條第 2 項（2 週變形工時）',
    summary:
      '經指定行業得將 2 週內之正常工作時數分配於其他工作日，每日正常工時至多 10 小時；週期正常工時上限採 80 小時。仍須符合例假／休息日與連班相關規範。',
  },
  {
    article: '第 30 條第 3 項（8 週變形工時）',
    summary:
      '經指定行業得將 8 週內之正常工作時數加以分配，每日正常工時原則仍不得超過 8 小時；週期正常工時上限採 320 小時。',
  },
  {
    article: '第 30 條之 1（4 週變形工時）',
    summary:
      '經中央主管機關指定行業，得實施 4 週變形工時；週期正常工時上限採 160 小時，每日正常工時至多 10 小時，並依規定配置例假與休息日。',
  },
  {
    article: '第 32 條（延長工時）',
    summary:
      '延長工作時間另有規範；本系統以一般情形下每月延長工時不得超過 46 小時為警示上限，並對單日正常＋延長合計原則不得超過 12 小時進行控管／提示。經勞資會議同意並備查之例外放寬，本模擬未全數覆蓋。',
  },
  {
    article: '第 34 條第 2 項（輪班間隔）',
    summary:
      '輪班制勞工更換班次時，至少應有連續 11 小時之休息時間。本系統對相鄰班次間隔不足會提出風險提示。',
  },
  {
    article: '第 36 條（例假與休息日）',
    summary:
      '勞工每 7 日中應有 2 日之休息，其中 1 日為例假、1 日為休息日；變形工時另有週期內例／休配置規則。本系統依所選制度檢核例假／休息日配額與連班天數。',
  },
  {
    article: '第 37 條（國定假日）',
    summary:
      '國定假日應放假；實務上經勞工同意得調移。本系統以「國／調」班別與補假設定輔助模擬，實際補償或出勤費率請另依法令與單位規定辦理。',
  },
];

/**
 * 法規說明：條文摘要與勞動部官方全文連結。
 *
 * @param props.isOpen 是否顯示
 * @param props.onClose 關閉回呼
 */
export const LegalInfoModal: React.FC<LegalInfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-info-modal-title"
        className="bg-white border border-[#E9E7D4] rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-xl text-[#2D2D2D] space-y-4 my-6"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E9E7D4] pb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl border border-[#5A5A40]/20 shrink-0">
              <Scale className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2
                id="legal-info-modal-title"
                className="text-xl font-bold text-[#2D2D2D] font-serif"
              >
                法規說明
              </h2>
              <p className="text-sm text-[#8A8A70] mt-0.5">本系統模擬檢核所對應之勞基法條文摘要</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8A8A70] hover:text-[#2D2D2D] hover:bg-[#E9E7D4] transition-colors cursor-pointer shrink-0"
            aria-label="關閉法規說明"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-4 text-sm leading-relaxed">
          <p className="text-[#2D2D2D]">
            本網站之工時制度與模擬檢核，主要參照中華民國
            <strong className="font-bold">《勞動基準法》</strong>
            及實務上常見之工時／例休／延長工時規則所內建。以下為系統對應條文之摘要說明，
            <strong className="font-bold">並非法條全文</strong>
            ，亦可能因修法而未即時同步。
          </p>

          {/* 官方正確條文連結（勞動部全國法規資料庫） */}
          <div className="rounded-xl border border-[#5A5A40]/25 bg-[#F8F7EB] p-3.5 space-y-2">
            <p className="font-bold text-[#5A5A40]">正確條文請以勞動部全國法規資料庫為準：</p>
            <a
              href={LABOR_STANDARDS_ACT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-start gap-2 text-[#2F5D50] hover:text-[#1F3F36] underline underline-offset-2 break-all"
            >
              <ExternalLink className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{LABOR_STANDARDS_ACT_URL}</span>
            </a>
            <p className="text-[#8A8A70]">
              法規名稱：勞動基準法（法規資料庫條文頁）。點擊上方連結可於新分頁開啟官方全文與最新修正內容。
            </p>
          </div>

          <div className="space-y-2">
            {LEGAL_ARTICLE_SUMMARIES.map((item) => (
              <article
                key={item.article}
                className="rounded-lg border border-[#E9E7D4] bg-white px-3 py-2.5 space-y-1"
              >
                <h3 className="text-sm font-bold text-[#5A5A40]">{item.article}</h3>
                <p className="text-[#2D2D2D]">{item.summary}</p>
              </article>
            ))}
          </div>

          <p className="text-[#8A8A70]">
            提醒：實際行業是否得適用變形工時、延長工時是否經勞資會議同意並完成報備／備查、國定假日調移與加班費計算等，均請另依主管機關規定與單位制度確認；切勿僅依本模擬結果作為對外正式決策唯一依據。
          </p>
        </div>

        <div className="pt-3 border-t border-[#E9E7D4] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-sm rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
