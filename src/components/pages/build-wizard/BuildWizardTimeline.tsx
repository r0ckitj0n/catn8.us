import React from 'react';
import { IBuildWizardStep } from '../../../types/buildWizard';
import { BuildTabId, DateRangeChartProps, FooterTimelineProps } from '../../../types/pages/buildWizardPage';
import { BUILD_TABS, TAB_PHASE_COLORS } from './buildWizardConstants';
import { formatTimelineDate, getStepPastelColor, parseDate, segmentBackground, stepDateRange, stepPhaseBucket, tabLabelShort, toIsoDate } from './buildWizardUtils';

type TimelineEditMode = 'move' | 'resize-start' | 'resize-end';

type FooterDragState = {
  stepId: number;
  mode: TimelineEditMode;
  pointerId: number;
  pointerStartX: number;
  trackWidthPx: number;
  initialStartIso: string;
  initialEndIso: string;
};

function addDays(iso: string, deltaDays: number): string {
  const date = parseDate(iso);
  if (!date) {
    return iso;
  }
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + deltaDays);
  return toIsoDate(next);
}

function clampIsoDate(iso: string, minIso: string, maxIso: string): string {
  if (iso < minIso) {
    return minIso;
  }
  if (iso > maxIso) {
    return maxIso;
  }
  return iso;
}

function toDurationDays(startIso: string, endIso: string): number {
  const start = parseDate(startIso);
  const end = parseDate(endIso);
  if (!start || !end) {
    return 1;
  }
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

export function FooterPhaseTimeline({
  steps,
  rangeStart,
  rangeEnd,
  activeTab,
  editable = false,
  displayNumberById,
  onStepTimelineChange,
}: FooterTimelineProps) {
  const startDate = parseDate(rangeStart);
  const endDate = parseDate(rangeEnd);
  const [draftDatesByStepId, setDraftDatesByStepId] = React.useState<Record<number, { start: string; end: string }>>({});
  const [dragState, setDragState] = React.useState<FooterDragState | null>(null);
  const trackRef = React.useRef<HTMLDivElement | null>(null);

  if (!startDate || !endDate || endDate.getTime() < startDate.getTime()) {
    return <div className="build-wizard-muted">Invalid date range.</div>;
  }

  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
  const rangeStartIso = toIsoDate(startDate);
  const rangeEndIso = toIsoDate(endDate);
  const timelineSteps = steps
    .filter((step) => {
      const baseStart = step.expected_start_date || step.expected_end_date;
      const baseEnd = step.expected_end_date || step.expected_start_date;
      if (!baseStart || !baseEnd) {
        return false;
      }
      return baseEnd >= rangeStartIso && baseStart <= rangeEndIso;
    })
    .sort((a, b) => {
      const aNum = Number(displayNumberById?.get(a.id) || a.step_order || 0);
      const bNum = Number(displayNumberById?.get(b.id) || b.step_order || 0);
      if (aNum !== bNum) {
        return aNum - bNum;
      }
      return a.id - b.id;
    });

  const stepColorsByDay: Array<Set<string>> = Array.from({ length: totalDays }, () => new Set<string>());
  timelineSteps.forEach((step) => {
    const liveDraft = draftDatesByStepId[step.id];
    const stepStartIso = liveDraft?.start || step.expected_start_date || step.expected_end_date;
    const stepEndIso = liveDraft?.end || step.expected_end_date || step.expected_start_date;
    if (!stepStartIso || !stepEndIso) {
      return;
    }
    const clampedStart = clampIsoDate(stepStartIso, rangeStartIso, rangeEndIso);
    const clampedEnd = clampIsoDate(stepEndIso, rangeStartIso, rangeEndIso);
    const safeStart = clampedStart <= clampedEnd ? clampedStart : clampedEnd;
    const safeEnd = clampedEnd >= clampedStart ? clampedEnd : clampedStart;
    const safeStartDate = parseDate(safeStart);
    const safeEndDate = parseDate(safeEnd);
    if (!safeStartDate || !safeEndDate) {
      return;
    }
    const startOffset = Math.max(0, Math.round((safeStartDate.getTime() - startDate.getTime()) / 86400000));
    const endOffset = Math.min(totalDays - 1, Math.round((safeEndDate.getTime() - startDate.getTime()) / 86400000));
    const stepColor = getStepPastelColor(step.id);
    for (let day = startOffset; day <= endOffset; day += 1) {
      stepColorsByDay[day].add(stepColor);
    }
  });

  const segments: Array<{ leftPercent: number; widthPercent: number; colors: string[]; key: string }> = [];
  let index = 0;
  while (index < totalDays) {
    const dayColors = Array.from(stepColorsByDay[index]);
    const key = dayColors.join('|');
    let endIndex = index;
    while (endIndex + 1 < totalDays) {
      const nextColors = Array.from(stepColorsByDay[endIndex + 1]).join('|');
      if (nextColors !== key) {
        break;
      }
      endIndex += 1;
    }
    if (dayColors.length > 0) {
      const runLen = endIndex - index + 1;
      segments.push({
        key: `${index}-${key}`,
        leftPercent: (index / totalDays) * 100,
        widthPercent: (runLen / totalDays) * 100,
        colors: dayColors,
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

  const editableRows = editable && timelineSteps.length > 0;

  return (
    <div className="build-wizard-phase-timeline">
      <div className="build-wizard-phase-range">
        {formatTimelineDate(rangeStart)} - {formatTimelineDate(rangeEnd)}
      </div>
      <div className={`build-wizard-phase-track ${editableRows ? 'is-editable' : ''}`} ref={trackRef}>
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
        {editableRows ? timelineSteps.map((step) => {
          const number = Number(displayNumberById?.get(step.id) || step.step_order || 0);
          const liveDraft = draftDatesByStepId[step.id];
          const stepStartIso = liveDraft?.start || step.expected_start_date || step.expected_end_date;
          const stepEndIso = liveDraft?.end || step.expected_end_date || step.expected_start_date;
          if (!stepStartIso || !stepEndIso) {
            return null;
          }
          const clampedStart = clampIsoDate(stepStartIso, rangeStartIso, rangeEndIso);
          const clampedEnd = clampIsoDate(stepEndIso, rangeStartIso, rangeEndIso);
          const safeStart = clampedStart <= clampedEnd ? clampedStart : clampedEnd;
          const safeEnd = clampedEnd >= clampedStart ? clampedEnd : clampedStart;
          const leftDays = Math.max(0, Math.round((parseDate(safeStart)!.getTime() - startDate.getTime()) / 86400000));
          const widthDays = Math.max(1, Math.round((parseDate(safeEnd)!.getTime() - parseDate(safeStart)!.getTime()) / 86400000) + 1);
          const leftPercent = (leftDays / totalDays) * 100;
          const widthPercent = (widthDays / totalDays) * 100;
          const stepColor = getStepPastelColor(step.id);
          const isStepReadOnly = Number(step.is_completed) === 1;
          return (
            <div
              key={step.id}
              className={`build-wizard-footer-step-bar${isStepReadOnly ? ' is-readonly' : ''}`}
              title={`#${number} ${step.title}`}
              style={{ left: `${leftPercent}%`, width: `${widthPercent}%`, background: stepColor, zIndex: dragState?.stepId === step.id ? 3 : 2 }}
              onPointerDown={(event) => {
                if (isStepReadOnly) {
                  return;
                }
                const box = trackRef.current?.getBoundingClientRect();
                const widthPx = Math.max(1, box?.width || 1);
                const pointerId = event.pointerId;
                event.currentTarget.setPointerCapture(pointerId);
                setDragState({
                  stepId: step.id,
                  mode: 'move',
                  pointerId,
                  pointerStartX: event.clientX,
                  trackWidthPx: widthPx,
                  initialStartIso: safeStart,
                  initialEndIso: safeEnd,
                });
              }}
              onPointerMove={(event) => {
                if (!dragState || dragState.stepId !== step.id || dragState.mode !== 'move' || dragState.pointerId !== event.pointerId) {
                  return;
                }
                const dayDelta = Math.round(((event.clientX - dragState.pointerStartX) / dragState.trackWidthPx) * totalDays);
                if (dayDelta === 0) {
                  return;
                }
                const movedStart = clampIsoDate(addDays(dragState.initialStartIso, dayDelta), rangeStartIso, rangeEndIso);
                const movedEnd = clampIsoDate(addDays(dragState.initialEndIso, dayDelta), rangeStartIso, rangeEndIso);
                const duration = toDurationDays(dragState.initialStartIso, dragState.initialEndIso);
                const nextStart = movedStart;
                let nextEnd = movedEnd;
                if (nextEnd < nextStart) {
                  nextEnd = clampIsoDate(addDays(nextStart, duration - 1), rangeStartIso, rangeEndIso);
                }
                setDraftDatesByStepId((prev) => ({ ...prev, [step.id]: { start: nextStart, end: nextEnd } }));
              }}
              onPointerUp={(event) => {
                if (!dragState || dragState.stepId !== step.id || dragState.mode !== 'move' || dragState.pointerId !== event.pointerId) {
                  return;
                }
                event.currentTarget.releasePointerCapture(event.pointerId);
                const dayDelta = Math.round(((event.clientX - dragState.pointerStartX) / dragState.trackWidthPx) * totalDays);
                const movedStart = clampIsoDate(addDays(dragState.initialStartIso, dayDelta), rangeStartIso, rangeEndIso);
                const movedEnd = clampIsoDate(addDays(dragState.initialEndIso, dayDelta), rangeStartIso, rangeEndIso);
                const duration = toDurationDays(dragState.initialStartIso, dragState.initialEndIso);
                const nextStart = movedStart;
                let nextEnd = movedEnd;
                if (nextEnd < nextStart) {
                  nextEnd = clampIsoDate(addDays(nextStart, duration - 1), rangeStartIso, rangeEndIso);
                }
                if (onStepTimelineChange) {
                  onStepTimelineChange(step.id, {
                    expected_start_date: nextStart,
                    expected_end_date: nextEnd,
                    expected_duration_days: toDurationDays(nextStart, nextEnd),
                  });
                }
                setDraftDatesByStepId((prev) => {
                  const next = { ...prev };
                  delete next[step.id];
                  return next;
                });
                setDragState(null);
              }}
            >
              <button
                type="button"
                className="build-wizard-footer-step-handle is-start"
                aria-label={`Adjust start date for ${step.title}`}
                disabled={isStepReadOnly}
                onPointerDown={(event) => {
                  if (isStepReadOnly) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  const box = trackRef.current?.getBoundingClientRect();
                  const widthPx = Math.max(1, box?.width || 1);
                  const pointerId = event.pointerId;
                  event.currentTarget.setPointerCapture(pointerId);
                  setDragState({
                    stepId: step.id,
                    mode: 'resize-start',
                    pointerId,
                    pointerStartX: event.clientX,
                    trackWidthPx: widthPx,
                    initialStartIso: safeStart,
                    initialEndIso: safeEnd,
                  });
                }}
                onPointerMove={(event) => {
                  if (!dragState || dragState.stepId !== step.id || dragState.mode !== 'resize-start' || dragState.pointerId !== event.pointerId) {
                    return;
                  }
                  const dayDelta = Math.round(((event.clientX - dragState.pointerStartX) / dragState.trackWidthPx) * totalDays);
                  const movedStart = clampIsoDate(addDays(dragState.initialStartIso, dayDelta), rangeStartIso, dragState.initialEndIso);
                  setDraftDatesByStepId((prev) => ({ ...prev, [step.id]: { start: movedStart, end: dragState.initialEndIso } }));
                }}
                onPointerUp={(event) => {
                  if (!dragState || dragState.stepId !== step.id || dragState.mode !== 'resize-start' || dragState.pointerId !== event.pointerId) {
                    return;
                  }
                  event.currentTarget.releasePointerCapture(event.pointerId);
                  const dayDelta = Math.round(((event.clientX - dragState.pointerStartX) / dragState.trackWidthPx) * totalDays);
                  const movedStart = clampIsoDate(addDays(dragState.initialStartIso, dayDelta), rangeStartIso, dragState.initialEndIso);
                  if (onStepTimelineChange) {
                    onStepTimelineChange(step.id, {
                      expected_start_date: movedStart,
                      expected_end_date: dragState.initialEndIso,
                      expected_duration_days: toDurationDays(movedStart, dragState.initialEndIso),
                    });
                  }
                  setDraftDatesByStepId((prev) => {
                    const next = { ...prev };
                    delete next[step.id];
                    return next;
                  });
                  setDragState(null);
                }}
              />
              <button
                type="button"
                className="build-wizard-footer-step-handle is-end"
                aria-label={`Adjust end date for ${step.title}`}
                disabled={isStepReadOnly}
                onPointerDown={(event) => {
                  if (isStepReadOnly) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  const box = trackRef.current?.getBoundingClientRect();
                  const widthPx = Math.max(1, box?.width || 1);
                  const pointerId = event.pointerId;
                  event.currentTarget.setPointerCapture(pointerId);
                  setDragState({
                    stepId: step.id,
                    mode: 'resize-end',
                    pointerId,
                    pointerStartX: event.clientX,
                    trackWidthPx: widthPx,
                    initialStartIso: safeStart,
                    initialEndIso: safeEnd,
                  });
                }}
                onPointerMove={(event) => {
                  if (!dragState || dragState.stepId !== step.id || dragState.mode !== 'resize-end' || dragState.pointerId !== event.pointerId) {
                    return;
                  }
                  const dayDelta = Math.round(((event.clientX - dragState.pointerStartX) / dragState.trackWidthPx) * totalDays);
                  const movedEnd = clampIsoDate(addDays(dragState.initialEndIso, dayDelta), dragState.initialStartIso, rangeEndIso);
                  setDraftDatesByStepId((prev) => ({ ...prev, [step.id]: { start: dragState.initialStartIso, end: movedEnd } }));
                }}
                onPointerUp={(event) => {
                  if (!dragState || dragState.stepId !== step.id || dragState.mode !== 'resize-end' || dragState.pointerId !== event.pointerId) {
                    return;
                  }
                  event.currentTarget.releasePointerCapture(event.pointerId);
                  const dayDelta = Math.round(((event.clientX - dragState.pointerStartX) / dragState.trackWidthPx) * totalDays);
                  const movedEnd = clampIsoDate(addDays(dragState.initialEndIso, dayDelta), dragState.initialStartIso, rangeEndIso);
                  if (onStepTimelineChange) {
                    onStepTimelineChange(step.id, {
                      expected_start_date: dragState.initialStartIso,
                      expected_end_date: movedEnd,
                      expected_duration_days: toDurationDays(dragState.initialStartIso, movedEnd),
                    });
                  }
                  setDraftDatesByStepId((prev) => {
                    const next = { ...prev };
                    delete next[step.id];
                    return next;
                  });
                  setDragState(null);
                }}
              />
            </div>
          );
        }) : null}
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
