import React from 'react';

import { IBuildWizardStep } from '../../../types/buildWizard';
import { BuildTabId, FooterTimelineProps } from '../../../types/pages/buildWizardPage';
import { formatTimelineDate, getStepPastelColor, parseDate, segmentBackground, tabLabelShort } from './buildWizardUtils';
import { BUILD_TABS } from './buildWizardConstants';
import { TAB_PHASE_COLORS } from './buildWizardConstants';
import { addDays, clampIsoDate, toDurationDays } from './buildWizardTimelineUtils';

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

interface BuildWizardFooterTimelineTrackProps {
  activeTab: FooterTimelineProps['activeTab'];
  displayNumberById: FooterTimelineProps['displayNumberById'];
  dragState: FooterDragState | null;
  draftDatesByStepId: Record<number, { end: string; start: string }>;
  editableRows: boolean;
  endDate: Date;
  onDragStateChange: React.Dispatch<React.SetStateAction<FooterDragState | null>>;
  onDraftDatesChange: React.Dispatch<React.SetStateAction<Record<number, { end: string; start: string }>>>;
  onStepTimelineChange?: FooterTimelineProps['onStepTimelineChange'];
  orderedStatusPhases: BuildTabId[];
  phaseStatus: Map<BuildTabId, { done: number; total: number }>;
  rangeEnd: string;
  rangeEndIso: string;
  rangeStart: string;
  rangeStartIso: string;
  segments: Array<{ colors: string[]; key: string; leftPercent: number; widthPercent: number }>;
  startDate: Date;
  timelineSteps: IBuildWizardStep[];
  totalDays: number;
  trackRef: React.RefObject<HTMLDivElement | null>;
}

export function BuildWizardFooterTimelineTrack({
  activeTab,
  displayNumberById,
  dragState,
  draftDatesByStepId,
  editableRows,
  onDragStateChange,
  onDraftDatesChange,
  onStepTimelineChange,
  orderedStatusPhases,
  phaseStatus,
  rangeEnd,
  rangeEndIso,
  rangeStart,
  rangeStartIso,
  segments,
  startDate,
  timelineSteps,
  totalDays,
  trackRef,
}: BuildWizardFooterTimelineTrackProps) {
  const quarterDate = formatTimelineDate(new Date(startDate.getTime() + (parseDate(rangeEnd)!.getTime() - startDate.getTime()) * 0.25).toISOString().slice(0, 10));
  const midDate = formatTimelineDate(new Date(startDate.getTime() + (parseDate(rangeEnd)!.getTime() - startDate.getTime()) * 0.5).toISOString().slice(0, 10));
  const threeQuarterDate = formatTimelineDate(new Date(startDate.getTime() + (parseDate(rangeEnd)!.getTime() - startDate.getTime()) * 0.75).toISOString().slice(0, 10));

  return (
    <>
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

          const clearDraft = () => {
            onDraftDatesChange((prev) => {
              const next = { ...prev };
              delete next[step.id];
              return next;
            });
            onDragStateChange(null);
          };

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
                event.currentTarget.setPointerCapture(event.pointerId);
                onDragStateChange({
                  stepId: step.id,
                  mode: 'move',
                  pointerId: event.pointerId,
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
                let nextEnd = movedEnd;
                if (nextEnd < movedStart) {
                  nextEnd = clampIsoDate(addDays(movedStart, duration - 1), rangeStartIso, rangeEndIso);
                }
                onDraftDatesChange((prev) => ({ ...prev, [step.id]: { start: movedStart, end: nextEnd } }));
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
                let nextEnd = movedEnd;
                if (nextEnd < movedStart) {
                  nextEnd = clampIsoDate(addDays(movedStart, duration - 1), rangeStartIso, rangeEndIso);
                }
                onStepTimelineChange?.(step.id, {
                  expected_start_date: movedStart,
                  expected_end_date: nextEnd,
                  expected_duration_days: toDurationDays(movedStart, nextEnd),
                });
                clearDraft();
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
                  event.currentTarget.setPointerCapture(event.pointerId);
                  onDragStateChange({
                    stepId: step.id,
                    mode: 'resize-start',
                    pointerId: event.pointerId,
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
                  onDraftDatesChange((prev) => ({ ...prev, [step.id]: { start: movedStart, end: dragState.initialEndIso } }));
                }}
                onPointerUp={(event) => {
                  if (!dragState || dragState.stepId !== step.id || dragState.mode !== 'resize-start' || dragState.pointerId !== event.pointerId) {
                    return;
                  }
                  event.currentTarget.releasePointerCapture(event.pointerId);
                  const dayDelta = Math.round(((event.clientX - dragState.pointerStartX) / dragState.trackWidthPx) * totalDays);
                  const movedStart = clampIsoDate(addDays(dragState.initialStartIso, dayDelta), rangeStartIso, dragState.initialEndIso);
                  onStepTimelineChange?.(step.id, {
                    expected_start_date: movedStart,
                    expected_end_date: dragState.initialEndIso,
                    expected_duration_days: toDurationDays(movedStart, dragState.initialEndIso),
                  });
                  clearDraft();
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
                  event.currentTarget.setPointerCapture(event.pointerId);
                  onDragStateChange({
                    stepId: step.id,
                    mode: 'resize-end',
                    pointerId: event.pointerId,
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
                  onDraftDatesChange((prev) => ({ ...prev, [step.id]: { start: dragState.initialStartIso, end: movedEnd } }));
                }}
                onPointerUp={(event) => {
                  if (!dragState || dragState.stepId !== step.id || dragState.mode !== 'resize-end' || dragState.pointerId !== event.pointerId) {
                    return;
                  }
                  event.currentTarget.releasePointerCapture(event.pointerId);
                  const dayDelta = Math.round(((event.clientX - dragState.pointerStartX) / dragState.trackWidthPx) * totalDays);
                  const movedEnd = clampIsoDate(addDays(dragState.initialEndIso, dayDelta), dragState.initialStartIso, rangeEndIso);
                  onStepTimelineChange?.(step.id, {
                    expected_start_date: dragState.initialStartIso,
                    expected_end_date: movedEnd,
                    expected_duration_days: toDurationDays(dragState.initialStartIso, movedEnd),
                  });
                  clearDraft();
                }}
              />
            </div>
          );
        }) : null}
      </div>
      <div className="build-wizard-phase-ticks">
        <span className="is-edge is-start" style={{ left: '0%' }}>{formatTimelineDate(rangeStart)}</span>
        <span className="is-mid" style={{ left: '25%' }}>{quarterDate}</span>
        <span className="is-mid" style={{ left: '50%' }}>{midDate}</span>
        <span className="is-mid" style={{ left: '75%' }}>{threeQuarterDate}</span>
        <span className="is-edge is-end" style={{ left: '100%' }}>{formatTimelineDate(rangeEnd)}</span>
      </div>
      {orderedStatusPhases.length ? (
        <div className="build-wizard-phase-status">
          {orderedStatusPhases.map((phaseId) => {
            const stat = phaseStatus.get(phaseId)!;
            return (
              <div key={`${activeTab}-${phaseId}`} className="build-wizard-phase-status-chip">
                <span className="build-wizard-phase-status-swatch" style={{ background: TAB_PHASE_COLORS[phaseId] }} />
                <span>{tabLabelShort(phaseId)}: {stat.done}/{stat.total}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
