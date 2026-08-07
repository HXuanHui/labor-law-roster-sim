import { ShiftType } from '../types';

export const DEFAULT_SHIFTS: ShiftType[] = [
  {
    id: 'shift_morning',
    code: '早',
    name: '早班 (8H)',
    startTime: '08:00',
    endTime: '17:00',
    workHours: 8,
    breakHours: 1,
    color: '#5A5A40', // Olive/Dark Sage
    textColor: '#ffffff',
    category: 'work',
  },
  {
    id: 'shift_afternoon',
    code: '中',
    name: '中班 (8H)',
    startTime: '15:00',
    endTime: '24:00',
    workHours: 8,
    breakHours: 1,
    color: '#757551', // Medium Olive
    textColor: '#ffffff',
    category: 'work',
  },
  {
    id: 'shift_night',
    code: '夜',
    name: '大夜班 (8H)',
    startTime: '00:00',
    endTime: '08:00',
    workHours: 8,
    breakHours: 0,
    color: '#42422F', // Deep Olive
    textColor: '#ffffff',
    category: 'work',
  },
  {
    id: 'shift_long',
    code: '全',
    name: '變形長班 (10H)',
    startTime: '08:00',
    endTime: '19:00',
    workHours: 10,
    breakHours: 1,
    color: '#8A8A70', // Sage Grey
    textColor: '#ffffff',
    category: 'work',
  },
  {
    id: 'shift_rest',
    code: '休',
    name: '休息日 (OFF)',
    startTime: '00:00',
    endTime: '00:00',
    workHours: 0,
    breakHours: 0,
    color: '#94A381', // Muted Leaf Green
    textColor: '#ffffff',
    category: 'rest',
  },
  {
    id: 'shift_mandatory',
    code: '例',
    name: '例假日 (HOL)',
    startTime: '00:00',
    endTime: '00:00',
    workHours: 0,
    breakHours: 0,
    color: '#D17A60', // Terracotta
    textColor: '#ffffff',
    category: 'mandatory',
  },
  {
    id: 'shift_national_holiday',
    code: '國',
    name: '國定假日 (NAT)',
    startTime: '00:00',
    endTime: '00:00',
    workHours: 0,
    breakHours: 0,
    color: '#B85338', // Deep Terracotta
    textColor: '#ffffff',
    category: 'national_holiday',
  },
];
