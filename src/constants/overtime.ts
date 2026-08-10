/**
 * 加班模擬相關常數。
 *
 * 法規摘要（勞基法第 30、32、24 條）：
 * - 單日：正常工時＋延長工時合計原則不得超過 12 小時。
 * - 每月：延長工時原則不得超過 46 小時（經勞資會議同意並報備可放寬，此處採一般上限）。
 * - 每週正常工時基準：一般為 40 小時（不含延長工時）；變形工時以週期總量折算週平均亦約 40 小時。
 * - 加班費計算單位：法未限定半小時／一小時，出勤應記至分鐘；本系統以 0.5H 為操作步進。
 */

import { ScheduleSystemType } from '../types';
import { SYSTEM_CONFIGS } from './systems';

/** 介面每次點擊加減之加班時數（小時）。 */
export const OVERTIME_STEP_HOURS = 0.5;

/** 每月延長工時一般上限（小時）。 */
export const MAX_MONTHLY_OVERTIME_HOURS = 46;

/** 每週「正常工時」上限（小時）；延長工時不計入此上限。 */
export const WEEKLY_TOTAL_HOURS_CAP = 40;

/**
 * 依當日正常工時推算可延長工時上限。
 * @param normalWorkHours 當日班別正常工時
 * @returns 單日可登錄之最大加班時數
 */
export function getMaxDailyOvertimeHours(normalWorkHours: number): number {
  return Math.max(0, Math.round((12 - normalWorkHours) * 10) / 10);
}

/**
 * 將加班時數捨入至步進單位。
 * @param hours 原始時數
 * @returns 對齊到 0.5 的時數
 */
export function snapOvertimeHours(hours: number): number {
  const stepped = Math.round(hours / OVERTIME_STEP_HOURS) * OVERTIME_STEP_HOURS;
  return Math.max(0, Math.round(stepped * 10) / 10);
}

/**
 * 依制度取得週期內延長工時示警上限（以月 46H 按週期天數等比折算）。
 * @param systemType 工時制度
 * @returns 該週期建議加班上限（小時）
 */
export function getCycleOvertimeCapHours(systemType: ScheduleSystemType): number {
  const config = SYSTEM_CONFIGS[systemType];
  return Math.round(((MAX_MONTHLY_OVERTIME_HOURS * config.cycleDays) / 30) * 10) / 10;
}
