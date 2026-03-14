import React from 'react';
import { Accumul8Account, Accumul8Transaction } from '../../types/accumul8';
import './Accumul8CalendarView.css';

type Accumul8CalendarViewProps = {
  accounts: Accumul8Account[];
  transactions: Accumul8Transaction[];
  onTransactionSelect?: (transactionId: number) => void;
};

type CalendarMode = 'month' | 'week';

type CalendarDay = {
  isoDate: string;
  dayNumber: number;
  inCurrentMonth: boolean;
};

function createUtcDate(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(value: string, days: number): string {
  const parsed = createUtcDate(value);
  if (!parsed) {
    return value;
  }
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return formatIsoDate(parsed);
}

function addUtcMonths(value: string, months: number): string {
  const parsed = createUtcDate(value);
  if (!parsed) {
    return value;
  }
  parsed.setUTCDate(1);
  parsed.setUTCMonth(parsed.getUTCMonth() + months);
  return formatIsoDate(parsed);
}

function startOfUtcMonth(value: string): string {
  const parsed = createUtcDate(value);
  if (!parsed) {
    return value;
  }
  parsed.setUTCDate(1);
  return formatIsoDate(parsed);
}

function endOfUtcMonth(value: string): string {
  const parsed = createUtcDate(value);
  if (!parsed) {
    return value;
  }
  parsed.setUTCMonth(parsed.getUTCMonth() + 1, 0);
  return formatIsoDate(parsed);
}

function startOfUtcWeek(value: string): string {
  const parsed = createUtcDate(value);
  if (!parsed) {
    return value;
  }
  const day = parsed.getUTCDay();
  parsed.setUTCDate(parsed.getUTCDate() - day);
  return formatIsoDate(parsed);
}

function buildMonthGridDays(anchorDate: string): CalendarDay[] {
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

function buildWeekDays(anchorDate: string): CalendarDay[] {
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

function getTransactionCalendarDate(transaction: Accumul8Transaction): string {
  return String(transaction.due_date || transaction.transaction_date || '').slice(0, 10);
}

function formatTransactionStateLabel(transaction: Accumul8Transaction, date: string, todayDate: string): string {
  if (Number(transaction.is_paid || 0) === 1) {
    return 'Occurred';
  }
  if (date > todayDate || String(transaction.due_date || '').trim()) {
    return 'Expected';
  }
  return 'Open';
}

function formatCurrencyAmount(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMonthLabel(value: string): string {
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

function formatWeekLabel(value: string): string {
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

function formatDayLabel(value: string): string {
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

export function Accumul8CalendarView({ accounts, transactions, onTransactionSelect }: Accumul8CalendarViewProps) {
  const todayDate = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [calendarMode, setCalendarMode] = React.useState<CalendarMode>('month');
  const [anchorDate, setAnchorDate] = React.useState<string>(todayDate);

  const dayTotalsByDate = React.useMemo(() => {
    const totals = new Map<string, number>();

    transactions.forEach((transaction) => {
      const date = getTransactionCalendarDate(transaction);
      if (!date) {
        return;
      }
      totals.set(date, Number(((totals.get(date) || 0) + Number(transaction.amount || 0)).toFixed(2)));
    });

    return totals;
  }, [transactions]);

  const transactionMap = React.useMemo(() => {
    const next = new Map<string, Accumul8Transaction[]>();

    transactions.forEach((transaction) => {
      const date = getTransactionCalendarDate(transaction);
      if (!date) {
        return;
      }
      const existing = next.get(date) || [];
      existing.push(transaction);
      next.set(date, existing);
    });

    next.forEach((items, key) => {
      items.sort((a, b) => {
        const aExpected = getTransactionCalendarDate(a);
        const bExpected = getTransactionCalendarDate(b);
        return aExpected.localeCompare(bExpected)
          || Number(a.amount || 0) - Number(b.amount || 0)
          || a.id - b.id;
      });
      next.set(key, items);
    });

    return next;
  }, [transactions]);

  const visibleDays = React.useMemo(
    () => (calendarMode === 'month' ? buildMonthGridDays(anchorDate) : buildWeekDays(anchorDate)),
    [anchorDate, calendarMode],
  );

  const dayBalanceByDate = React.useMemo(() => {
    const currentBalance = accounts.reduce((sum, account) => sum + Number(account.current_balance || 0), 0);
    const relevantDates = Array.from(new Set([
      todayDate,
      ...visibleDays.map((day) => day.isoDate),
      ...dayTotalsByDate.keys(),
    ])).sort((left, right) => left.localeCompare(right));
    const prefixTotalsByDate = new Map<string, number>();
    let runningTotal = 0;

    relevantDates.forEach((date) => {
      runningTotal = Number((runningTotal + Number(dayTotalsByDate.get(date) || 0)).toFixed(2));
      prefixTotalsByDate.set(date, runningTotal);
    });

    const todayPrefix = Number(prefixTotalsByDate.get(todayDate) || 0);
    const balanceByDate = new Map<string, number>();

    relevantDates.forEach((date) => {
      const prefixTotal = Number(prefixTotalsByDate.get(date) || 0);
      balanceByDate.set(date, Number((currentBalance + (prefixTotal - todayPrefix)).toFixed(2)));
    });

    return balanceByDate;
  }, [accounts, dayTotalsByDate, todayDate, visibleDays]);

  const monthValue = React.useMemo(() => startOfUtcMonth(anchorDate).slice(0, 7), [anchorDate]);
  const yearOptions = React.useMemo(() => {
    const years = new Set<number>([Number(todayDate.slice(0, 4))]);
    transactions.forEach((transaction) => {
      const date = getTransactionCalendarDate(transaction);
      if (date) {
        years.add(Number(date.slice(0, 4)));
      }
    });
    years.add(Number(monthValue.slice(0, 4)));
    const sorted = Array.from(years).filter(Number.isFinite).sort((a, b) => a - b);
    if (sorted.length === 0) {
      return [Number(todayDate.slice(0, 4))];
    }
    const minYear = sorted[0] - 1;
    const maxYear = sorted[sorted.length - 1] + 1;
    return Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);
  }, [monthValue, todayDate, transactions]);

  const periodLabel = calendarMode === 'month' ? formatMonthLabel(anchorDate) : formatWeekLabel(anchorDate);

  return (
    <div className="accumul8-calendar-view">
      <div className="catn8-card accumul8-calendar-shell">
        <div className="accumul8-calendar-toolbar">
          <div>
            <h3 className="mb-1">Calendar</h3>
            <p className="accumul8-calendar-toolbar-copy mb-0">
              Transactions shown here already respect the owner, institution, and account filters from the header.
            </p>
          </div>
          <div className="accumul8-calendar-toolbar-controls">
            <div className="btn-group" role="group" aria-label="Calendar view mode">
              <button type="button" className={`btn btn-sm ${calendarMode === 'month' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setCalendarMode('month')}>Month</button>
              <button type="button" className={`btn btn-sm ${calendarMode === 'week' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setCalendarMode('week')}>Week</button>
            </div>
            <div className="accumul8-calendar-period-picker">
              <button type="button" className="btn btn-outline-primary btn-sm" aria-label={`Previous ${calendarMode}`} onClick={() => setAnchorDate((current) => (calendarMode === 'month' ? addUtcMonths(current, -1) : addUtcDays(current, -7)))}>
                <i className="bi bi-chevron-left" aria-hidden="true"></i>
              </button>
              <strong className="accumul8-calendar-period-label">{periodLabel}</strong>
              <button type="button" className="btn btn-outline-primary btn-sm" aria-label={`Next ${calendarMode}`} onClick={() => setAnchorDate((current) => (calendarMode === 'month' ? addUtcMonths(current, 1) : addUtcDays(current, 7)))}>
                <i className="bi bi-chevron-right" aria-hidden="true"></i>
              </button>
            </div>
            <div className="accumul8-calendar-dropdowns">
              <label className="visually-hidden" htmlFor="accumul8-calendar-month">Calendar month</label>
              <select
                id="accumul8-calendar-month"
                className="form-select form-select-sm"
                value={monthValue.slice(5, 7)}
                onChange={(event) => setAnchorDate(`${monthValue.slice(0, 4)}-${event.target.value}-01`)}
              >
                {Array.from({ length: 12 }, (_, index) => {
                  const optionDate = `2026-${String(index + 1).padStart(2, '0')}-01`;
                  return (
                    <option key={optionDate} value={String(index + 1).padStart(2, '0')}>
                      {formatMonthLabel(optionDate).replace(/ \d{4}$/, '')}
                    </option>
                  );
                })}
              </select>
              <label className="visually-hidden" htmlFor="accumul8-calendar-year">Calendar year</label>
              <select
                id="accumul8-calendar-year"
                className="form-select form-select-sm"
                value={monthValue.slice(0, 4)}
                onChange={(event) => setAnchorDate(`${event.target.value}-${monthValue.slice(5, 7)}-01`)}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={String(year)}>{year}</option>
                ))}
              </select>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setAnchorDate(todayDate)}>Today</button>
            </div>
          </div>
        </div>

        <div className={`accumul8-calendar-grid accumul8-calendar-grid--${calendarMode}`}>
          {visibleDays.map((day) => {
            const dayTransactions = transactionMap.get(day.isoDate) || [];
            const dayTotal = Number(dayTotalsByDate.get(day.isoDate) || 0);
            const dayBalance = dayBalanceByDate.get(day.isoDate);
            const isToday = day.isoDate === todayDate;

            return (
              <section
                key={day.isoDate}
                className={[
                  'accumul8-calendar-day',
                  day.inCurrentMonth ? '' : 'is-outside-month',
                  isToday ? 'is-today' : '',
                ].filter(Boolean).join(' ')}
                aria-label={formatDayLabel(day.isoDate)}
              >
                <header className="accumul8-calendar-day-header">
                  <div className="accumul8-calendar-day-header-main">
                    <span className="accumul8-calendar-day-name">{formatDayLabel(day.isoDate)}</span>
                    <div className="accumul8-calendar-day-header-summary">
                      <strong className="accumul8-calendar-day-number">{day.dayNumber}</strong>
                      <span className="accumul8-calendar-day-subtotal">{dayTransactions.length > 0 ? formatCurrencyAmount(dayTotal) : ''}</span>
                    </div>
                  </div>
                  <span className="accumul8-calendar-day-total">{Number.isFinite(dayBalance) ? formatCurrencyAmount(Number(dayBalance || 0)) : ''}</span>
                </header>

                <div className="accumul8-calendar-day-body">
                  {dayTransactions.length === 0 ? (
                    <p className="accumul8-calendar-day-empty mb-0">No matching transactions.</p>
                  ) : (
                    dayTransactions.map((transaction) => {
                      const amount = Number(transaction.amount || 0);
                      const statusLabel = formatTransactionStateLabel(transaction, day.isoDate, todayDate);
                      return (
                        <button
                          key={transaction.id}
                          type="button"
                          className={`accumul8-calendar-transaction ${amount >= 0 ? 'is-inflow' : 'is-outflow'}`}
                          onClick={() => onTransactionSelect?.(transaction.id)}
                        >
                          <span className="accumul8-calendar-transaction-topline">
                            <span className="accumul8-calendar-transaction-title">{transaction.entity_name || transaction.description || 'Untitled transaction'}</span>
                            <span className="accumul8-calendar-transaction-amount">{formatCurrencyAmount(amount)}</span>
                          </span>
                          <span className="accumul8-calendar-transaction-meta">
                            <span>{statusLabel}</span>
                            <span>{transaction.account_name || transaction.banking_organization_name || 'Unassigned account'}</span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
