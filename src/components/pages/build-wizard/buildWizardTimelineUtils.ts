import { IBuildWizardStep } from '../../../types/buildWizard';
import { parseDate, stepDateRange, toIsoDate } from './buildWizardUtils';

export function addDays(iso: string, deltaDays: number): string {
  const date = parseDate(iso);
  if (!date) {
    return iso;
  }
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + deltaDays);
  return toIsoDate(next);
}

export function clampIsoDate(iso: string, minIso: string, maxIso: string): string {
  if (iso < minIso) {
    return minIso;
  }
  if (iso > maxIso) {
    return maxIso;
  }
  return iso;
}

export function toDurationDays(startIso: string, endIso: string): number {
  const start = parseDate(startIso);
  const end = parseDate(endIso);
  if (!start || !end) {
    return 1;
  }
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

export function mapStepToChartRow(step: IBuildWizardStep, startDate: Date, endDate: Date, totalDays: number) {
  const range = stepDateRange(step);
  if (!range.start || !range.end) {
    return null;
  }

  if (range.end.getTime() < startDate.getTime() || range.start.getTime() > endDate.getTime()) {
    return null;
  }

  const clampedStartMs = Math.max(range.start.getTime(), startDate.getTime());
  const clampedEndMs = Math.min(range.end.getTime(), endDate.getTime());
  const leftDays = Math.round((clampedStartMs - startDate.getTime()) / 86400000);
  const widthDays = Math.max(1, Math.round((clampedEndMs - clampedStartMs) / 86400000) + 1);

  return {
    step,
    leftPercent: (leftDays / totalDays) * 100,
    widthPercent: (widthDays / totalDays) * 100,
  };
}
