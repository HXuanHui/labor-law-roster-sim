export type ScheduleSystemType = 'standard' | '2-week' | '4-week' | '8-week';

export interface ShiftType {
  id: string;
  code: string; // e.g. "D", "E", "N", "OFF", "HOL", "NAT"
  name: string; // e.g. "早班", "中班", "夜班", "休息日", "例假日", "國定假日"
  startTime: string; // e.g. "09:00"
  endTime: string; // e.g. "18:00"
  workHours: number; // e.g. 8 or 10
  breakHours: number; // e.g. 1
  color: string; // Tailwind background color class or hex
  textColor: string;
  category: 'work' | 'rest' | 'mandatory' | 'national_holiday';
}

export interface DayShift {
  date: string; // YYYY-MM-DD
  shiftTypeId: string;
  note?: string;
  isOvertime?: boolean;
  isPinned?: boolean;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  scheduleSystem: ScheduleSystemType;
  cycleStartDate?: string; // YYYY-MM-DD (e.g. 第一週/週期起始日)
  schedules: Record<string, DayShift>; // key: YYYY-MM-DD
}

export interface NationalHoliday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  isStatutory: boolean; // True if statutory Taiwan national holiday
  description?: string;
}

export interface LaborRuleViolation {
  type: 'consecutive_work' | 'insufficient_mandatory_off' | 'insufficient_rest_day' | 'exceed_max_hours' | 'shift_interval_insufficient' | 'daily_hours_exceeded';
  severity: 'error' | 'warning';
  article: string; // e.g. "勞基法第36條"
  title: string;
  message: string;
  dates?: string[];
  affectedEmployeeId?: string;
}

export interface SnapResult {
  allowed: boolean;
  snappedDate: string; // YYYY-MM-DD (Closest legal date or original target if valid)
  originalTargetDate: string;
  wasAdjusted: boolean; // true if snapped away from target due to violation
  reason?: string;
  ruleViolated?: string;
}

export interface SystemConfig {
  name: string;
  type: ScheduleSystemType;
  cycleDays: number;
  maxConsecutiveWorkDays: number;
  minMandatoryOffPerCycle: number;
  minRestDaysPerCycle: number;
  maxNormalHoursPerCycle: number;
  maxDailyNormalHours: number;
  description: string;
  legalBasis: string;
  applicableIndustries: string;
}
