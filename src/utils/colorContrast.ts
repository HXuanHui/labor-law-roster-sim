/**
 * 班別色塊對比文字色：淺色背景用介面主色，深色背景用白字。
 * 僅兩階，不做多色適應。
 */
export const CONTRAST_TEXT_LIGHT = '#FFFFFF';
/** 淺底深字，與介面主文字色一致。 */
export const CONTRAST_TEXT_DARK = '#2D2D2D';

/**
 * 將 CSS 色碼（#RGB / #RRGGBB）解析為 0–255 的 RGB。
 * @param color - 十六進位色碼；無效時回傳 null。
 * @returns 正規化後的 RGB，或無法解析時為 null。
 */
function parseHexRgb(color: string): { r: number; g: number; b: number } | null {
  const raw = color.trim().replace(/^#/, '');
  if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) return null;

  // 三碼簡寫展開為六碼，避免亮度計算失真
  const hex =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;

  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

/**
 * 依 WCAG 相對亮度將 sRGB 通道線性化。
 * @param channel - 0–255 通道值。
 * @returns 0–1 線性通道。
 */
function linearizeChannel(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * 依背景色自動選擇深色或淺色文字，確保基本可讀對比。
 * @param backgroundColor - 班別背景色（建議 #RRGGBB）。
 * @returns `#FFFFFF` 或 `#2D2D2D`。
 */
export function getContrastingTextColor(backgroundColor: string): string {
  const rgb = parseHexRgb(backgroundColor);
  // 無法解析時偏向白字，維持既有深橄欖系預設班別的可讀性
  if (!rgb) return CONTRAST_TEXT_LIGHT;

  const luminance =
    0.2126 * linearizeChannel(rgb.r) +
    0.7152 * linearizeChannel(rgb.g) +
    0.0722 * linearizeChannel(rgb.b);

  // 中介亮度偏淺時改深字，避免淺藍／米黃上放白字看不清
  return luminance > 0.45 ? CONTRAST_TEXT_DARK : CONTRAST_TEXT_LIGHT;
}
