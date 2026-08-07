import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  getDaysInMonth,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { NationalHoliday } from '../types';

export interface CalendarDayInfo {
  dateStr: string; // YYYY-MM-DD
  dateObj: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  nationalHoliday?: NationalHoliday;
}

/**
 * Returns a 35 or 42 grid of calendar days for a given Year and Month
 */
export function getMonthCalendarGrid(
  year: number,
  month: number, // 1-12
  nationalHolidays: NationalHoliday[] = []
): CalendarDayInfo[] {
  const targetDate = new Date(year, month - 1, 1);
  const monthStart = startOfMonth(targetDate);
  const monthEnd = endOfMonth(targetDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const days: CalendarDayInfo[] = [];

  let current = gridStart;
  while (current <= gridEnd) {
    const dateStr = format(current, 'yyyy-MM-dd');
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isCurrentMonth = isSameMonth(current, targetDate);
    const holiday = nationalHolidays.find((h) => h.date === dateStr);

    days.push({
      dateStr,
      dateObj: new Date(current),
      dayNumber: current.getDate(),
      isCurrentMonth,
      isToday: dateStr === todayStr,
      isWeekend,
      dayOfWeek,
      nationalHoliday: holiday,
    });

    current = addDays(current, 1);
  }

  return days;
}

/**
 * Returns a list of days for a specific cycle (e.g. 14 days, 28 days, 56 days) starting from startDate
 */
export function getCycleDaysList(
  startDateStr: string,
  cycleDays: number,
  nationalHolidays: NationalHoliday[] = []
): CalendarDayInfo[] {
  const start = parseISO(startDateStr);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const days: CalendarDayInfo[] = [];

  for (let i = 0; i < cycleDays; i++) {
    const current = addDays(start, i);
    const dateStr = format(current, 'yyyy-MM-dd');
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const holiday = nationalHolidays.find((h) => h.date === dateStr);

    days.push({
      dateStr,
      dateObj: new Date(current),
      dayNumber: current.getDate(),
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      isWeekend,
      dayOfWeek,
      nationalHoliday: holiday,
    });
  }

  return days;
}

/**
 * Format date in Chinese format e.g. 2026年8月6日 (週四)
 */
export function formatTaiwanDate(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    const weekNames = ['日', '一', '二', '三', '四', '五', '六'];
    return `${format(d, 'yyyy年M月d日')} (週${weekNames[d.getDay()]})`;
  } catch {
    return dateStr;
  }
}

/**
 * Get weekday name string e.g. 週一, 週二...
 */
export function getTaiwanWeekdayName(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    const weekNames = ['日', '一', '二', '三', '四', '五', '六'];
    return `週${weekNames[d.getDay()]}`;
  } catch {
    return '';
  }
}
