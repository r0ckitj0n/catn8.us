import React from 'react';

import { DateRangeChartProps } from '../../../types/pages/buildWizardPage';
import { getStepPastelColor, parseDate } from './buildWizardUtils';
import { mapStepToChartRow } from './buildWizardTimelineUtils';

export function BuildWizardDateRangeChart({ steps, rangeStart, rangeEnd, compact = false }: DateRangeChartProps) {
  const startDate = parseDate(rangeStart);
  const endDate = parseDate(rangeEnd);

  if (!startDate || !endDate || endDate.getTime() < startDate.getTime()) {
    return <div className="build-wizard-muted">Invalid date range.</div>;
  }

  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
  const rows = steps
    .map((step) => mapStepToChartRow(step, startDate, endDate, totalDays))
    .filter(Boolean) as Array<{ leftPercent: number; widthPercent: number; step: typeof steps[number] }>;

  if (!rows.length) {
    return <div className="build-wizard-muted">No step dates in selected range.</div>;
  }

  return (
    <div className={`build-wizard-chart ${compact ? 'is-compact' : ''}`}>
      {rows.map((row) => {
        const stepColor = getStepPastelColor(row.step.id);
        return (
          <div key={row.step.id} className="build-wizard-chart-row">
            <div className="build-wizard-chart-label">#{row.step.step_order} {row.step.title}</div>
            <div className="build-wizard-chart-track">
              <div className="build-wizard-chart-bar" style={{ left: `${row.leftPercent}%`, width: `${row.widthPercent}%`, background: stepColor }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
