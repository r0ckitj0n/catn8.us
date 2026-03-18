import { IBuildWizardStep } from '../../../types/buildWizard';
import { LotSizeUnit } from '../../../types/pages/buildWizardPage';
import { SQFT_PER_ACRE } from './buildWizardConstants';

export function parseDate(input: string | null | undefined): Date | null {
  if (!input) {
    return null;
  }
  const str = String(input).trim();
  if (!str) {
    return null;
  }
  const normalized = str.length > 10 ? str.slice(0, 10) : str;
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(input: string | null | undefined): string {
  const date = parseDate(input);
  return date ? toIsoDate(date) : '-';
}

export function formatTimelineDate(input: string | null | undefined): string {
  const date = parseDate(input);
  if (!date) {
    return '-';
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function toNumberOrNull(value: string): number | null {
  const trimmed = String(value || '').trim();
  if (trimmed === '') {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function detectLotSizeUnit(inputValue: string): LotSizeUnit {
  const parsed = toNumberOrNull(inputValue);
  if (parsed === null) {
    return 'acres';
  }
  return parsed < 1000 ? 'acres' : 'sqft';
}

export function lotSizeInputToSqftAuto(inputValue: string): number | null {
  const parsed = toNumberOrNull(inputValue);
  if (parsed === null) {
    return null;
  }
  const unit = detectLotSizeUnit(inputValue);
  if (unit === 'sqft') {
    return Math.round(parsed);
  }
  return Math.round(parsed * SQFT_PER_ACRE);
}

export function lotSizeSqftToDisplayInput(sqft: number | null): string {
  if (sqft === null || !Number.isFinite(Number(sqft)) || Number(sqft) <= 0) {
    return '';
  }
  const acres = Number(sqft) / SQFT_PER_ACRE;
  return acres.toFixed(4).replace(/\.?0+$/, '');
}

export function calculateDurationDays(startDate: string | null | undefined, endDate: string | null | undefined): number | null {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) {
    return null;
  }
  const millisecondsDiff = end.getTime() - start.getTime();
  const days = Math.round(millisecondsDiff / 86400000) + 1;
  return Math.max(1, days);
}

export function stepDateRange(step: IBuildWizardStep): { start: Date | null; end: Date | null } {
  const start = parseDate(step.expected_start_date) || parseDate(step.completed_at) || parseDate(step.expected_end_date);
  const end = parseDate(step.expected_end_date) || parseDate(step.completed_at) || parseDate(step.expected_start_date);

  if (!start && !end) {
    return { start: null, end: null };
  }
  if (start && end && end.getTime() < start.getTime()) {
    return { start: end, end: start };
  }
  return {
    start: start || end,
    end: end || start,
  };
}

export function getDefaultRange(steps: IBuildWizardStep[]): { start: string; end: string } {
  const allDates: Date[] = [];
  steps.forEach((step) => {
    const range = stepDateRange(step);
    if (range.start) {
      allDates.push(range.start);
    }
    if (range.end) {
      allDates.push(range.end);
    }
  });

  if (!allDates.length) {
    const today = new Date();
    return { start: toIsoDate(today), end: toIsoDate(today) };
  }

  allDates.sort((a, b) => a.getTime() - b.getTime());
  return {
    start: toIsoDate(allDates[0]),
    end: toIsoDate(allDates[allDates.length - 1]),
  };
}
