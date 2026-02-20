import React from 'react';
import { IBuildWizardStep } from '../../../types/buildWizard';
import { BuildTabId, DateRangeChartProps, FooterTimelineProps } from '../../../types/pages/buildWizardPage';
import { BUILD_TABS, TAB_PHASE_COLORS } from './buildWizardConstants';
import { formatTimelineDate, parseDate, segmentBackground, stepDateRange, stepPhaseBucket, tabLabelShort, toIsoDate } from './buildWizardUtils';

export function FooterPhaseTimeline({ steps, rangeStart, rangeEnd }: FooterTimelineProps) {
  const startDate = parseDate(rangeStart);
  const endDate = parseDate(rangeEnd);

  if (!startDate || !endDate || endDate.getTime() < startDate.getTime()) {
    return <div className="build-wizard-muted">Invalid date range.</div>;
  }

  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
  const phaseByDay: Array<Set<BuildTabId>> = Array.from({ length: totalDays }, () => new Set<BuildTabId>());

  steps.forEach((step) => {
    const range = stepDateRange(step);
    if (!range.start || !range.end) {
      return;
    }
    if (range.end.getTime() < startDate.getTime() || range.start.getTime() > endDate.getTime()) {
      return;
    }
    const clampedStartMs = Math.max(range.start.getTime(), startDate.getTime());
    const clampedEndMs = Math.min(range.end.getTime(), endDate.getTime());
    const startOffset = Math.max(0, Math.round((clampedStartMs - startDate.getTime()) / 86400000));
    const endOffset = Math.min(totalDays - 1, Math.round((clampedEndMs - startDate.getTime()) / 86400000));
    const phase = stepPhaseBucket(step);
    for (let day = startOffset; day <= endOffset; day += 1) {
      phaseByDay[day].add(phase);
    }
  });

  const segments: Array<{ leftPercent: number; widthPercent: number; colors: string[]; key: string }> = [];
  let index = 0;
  while (index < totalDays) {
    const phaseIds = Array.from(phaseByDay[index]).sort() as BuildTabId[];
    const key = phaseIds.join('|');
    let endIndex = index;
    while (endIndex + 1 < totalDays) {
      const nextIds = Array.from(phaseByDay[endIndex + 1]).sort().join('|');
      if (nextIds !== key) {
        break;
      }
      endIndex += 1;
    }
    if (phaseIds.length > 0) {
      const runLen = endIndex - index + 1;
      segments.push({
        key: `${index}-${key}`,
        leftPercent: (index / totalDays) * 100,
        widthPercent: (runLen / totalDays) * 100,
        colors: phaseIds.map((phaseId) => TAB_PHASE_COLORS[phaseId]),
      });
    }
    index = endIndex + 1;
  }

  const quarterDate = toIsoDate(new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) * 0.25));
  const midDate = toIsoDate(new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) * 0.5));
  const threeQuarterDate = toIsoDate(new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) * 0.75));
  const phaseStatus = new Map<BuildTabId, { total: number; done: number }>();

  steps.forEach((step) => {
    const phaseId = stepPhaseBucket(step);
    if (!phaseStatus.has(phaseId)) {
      phaseStatus.set(phaseId, { total: 0, done: 0 });
    }
    const stat = phaseStatus.get(phaseId)!;
    stat.total += 1;
    if (Number(step.is_completed) === 1) {
      stat.done += 1;
    }
  });

  const orderedStatusPhases = BUILD_TABS.map((tab) => tab.id).filter(
    (id): id is BuildTabId => id !== 'overview' && id !== 'start' && id !== 'completed' && (phaseStatus.get(id)?.total || 0) > 0,
  );

  return (
    <div className="build-wizard-phase-timeline">
      <div className="build-wizard-phase-range">
        {formatTimelineDate(rangeStart)} - {formatTimelineDate(rangeEnd)}
      </div>
      <div className="build-wizard-phase-track">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className="build-wizard-phase-segment"
            style={{
              left: `${segment.leftPercent}%`,
              width: `${segment.widthPercent}%`,
              background: segmentBackground(segment.colors),
            }}
          />
        ))}
      </div>
      <div className="build-wizard-phase-ticks">
        <span className="is-edge is-start" style={{ left: '0%' }}>{formatTimelineDate(rangeStart)}</span>
        <span className="is-mid" style={{ left: '25%' }}>{formatTimelineDate(quarterDate)}</span>
        <span className="is-mid" style={{ left: '50%' }}>{formatTimelineDate(midDate)}</span>
        <span className="is-mid" style={{ left: '75%' }}>{formatTimelineDate(threeQuarterDate)}</span>
        <span className="is-edge is-end" style={{ left: '100%' }}>{formatTimelineDate(rangeEnd)}</span>
      </div>
      {orderedStatusPhases.length ? (
        <div className="build-wizard-phase-status">
          {orderedStatusPhases.map((phaseId) => {
            const stat = phaseStatus.get(phaseId)!;
            return (
              <div key={phaseId} className="build-wizard-phase-status-chip">
                <span className="build-wizard-phase-status-swatch" style={{ background: TAB_PHASE_COLORS[phaseId] }} />
                <span>{tabLabelShort(phaseId)}: {stat.done}/{stat.total}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function DateRangeChart({ steps, rangeStart, rangeEnd, compact = false }: DateRangeChartProps) {
  const startDate = parseDate(rangeStart);
  const endDate = parseDate(rangeEnd);

  if (!startDate || !endDate || endDate.getTime() < startDate.getTime()) {
    return <div className="build-wizard-muted">Invalid date range.</div>;
  }

  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);

  const rows = steps
    .map((step) => mapStepToChartRow(step, startDate, endDate, totalDays))
    .filter(Boolean) as Array<{ step: IBuildWizardStep; leftPercent: number; widthPercent: number }>;

  if (!rows.length) {
    return <div className="build-wizard-muted">No step dates in selected range.</div>;
  }

  return (
    <div className={`build-wizard-chart ${compact ? 'is-compact' : ''}`}>
      {rows.map((row) => (
        <div key={row.step.id} className="build-wizard-chart-row">
          <div className="build-wizard-chart-label">#{row.step.step_order} {row.step.title}</div>
          <div className="build-wizard-chart-track">
            <div className="build-wizard-chart-bar" style={{ left: `${row.leftPercent}%`, width: `${row.widthPercent}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function mapStepToChartRow(step: IBuildWizardStep, startDate: Date, endDate: Date, totalDays: number) {
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
