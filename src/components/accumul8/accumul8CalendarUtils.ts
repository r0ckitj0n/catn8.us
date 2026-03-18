import { Accumul8Transaction } from '../../types/accumul8';

export type CalendarDay = {
  isoDate: string;
  dayNumber: number;
  inCurrentMonth: boolean;
};

export function createUtcDate(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(value: string, days: number): string {
  const parsed = createUtcDate(value);
  if (!parsed) {
    return value;
  }
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return formatIsoDate(parsed);
}

export function addUtcMonths(value: string, months: number): string {
  const parsed = createUtcDate(value);
  if (!parsed) {
    return value;
  }
  parsed.setUTCDate(1);
  parsed.setUTCMonth(parsed.getUTCMonth() + months);
  return formatIsoDate(parsed);
}

export function startOfUtcMonth(value: string): string {
  const parsed = createUtcDate(value);
  if (!parsed) {
    return value;
  }
  parsed.setUTCDate(1);
  return formatIsoDate(parsed);
}

export function endOfUtcMonth(value: string): string {
  const parsed = createUtcDate(value);
  if (!parsed) {
    return value;
  }
  parsed.setUTCMonth(parsed.getUTCMonth() + 1, 0);
  return formatIsoDate(parsed);
}

export function startOfUtcWeek(value: string): string {
  const parsed = createUtcDate(value);
  if (!parsed) {
    return value;
  }
  const day = parsed.getUTCDay();
  parsed.setUTCDate(parsed.getUTCDate() - day);
  return formatIsoDate(parsed);
}

export function buildMonthGridDays(anchorDate: string): CalendarDay[] {
  const monthStart = startOfUtcMonth(anchorDate);
  const monthEnd = endOfUtcMonth(anchorDate);
  const gridStart = startOfUtcWeek(monthStart);
  const endDate = addUtcDays(startOfUtcWeek(addUtcDays(monthEnd, 6)), 6);
  const days: CalendarDay[] = [];
  let cursor = gridStart;

  while (cursor <= endDate) {
    days.push({
      isoDate: cursor,
      dayNumber: Number(cursor.slice(8, 10)),
      inCurrentMonth: cursor.slice(0, 7) === monthStart.slice(0, 7),
    });
    cursor = addUtcDays(cursor, 1);
  }

  return days;
}

export function buildWeekDays(anchorDate: string): CalendarDay[] {
  const weekStart = startOfUtcWeek(anchorDate);
  return Array.from({ length: 7 }, (_, index) => {
    const isoDate = addUtcDays(weekStart, index);
    return {
      isoDate,
      dayNumber: Number(isoDate.slice(8, 10)),
      inCurrentMonth: true,
    };
  });
}

export function getTransactionCalendarDate(transaction: Accumul8Transaction): string {
  return String(transaction.due_date || transaction.transaction_date || '').slice(0, 10);
}

export function formatTransactionStateLabel(transaction: Accumul8Transaction, date: string, todayDate: string): string {
  if (Number(transaction.is_paid || 0) === 1) {
    return 'Occurred';
  }
  if (date > todayDate || String(transaction.due_date || '').trim()) {
    return 'Expected';
  }
  return 'Open';
}

export function formatCurrencyAmount(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatMonthLabel(value: string): string {
  const parsed = createUtcDate(startOfUtcMonth(value));
  if (!parsed) {
    return value;
  }
  return parsed.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  });
}

export function formatWeekLabel(value: string): string {
  const weekStart = startOfUtcWeek(value);
  const weekEnd = addUtcDays(weekStart, 6);
  const startDate = createUtcDate(weekStart);
  const endDate = createUtcDate(weekEnd);
  if (!startDate || !endDate) {
    return weekStart;
  }
  const startLabel = startDate.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
  const endLabel = endDate.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} - ${endLabel}`;
}

export function formatDayLabel(value: string): string {
  const parsed = createUtcDate(value);
  if (!parsed) {
    return value;
  }
  return parsed.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
