import React from 'react';
import { BuildTabId, FooterTimelineProps } from '../../../types/pages/buildWizardPage';
import { BUILD_TABS, TAB_PHASE_COLORS } from './buildWizardConstants';
import { formatTimelineDate, getStepPastelColor, parseDate, stepPhaseBucket, toIsoDate } from './buildWizardUtils';
import { BuildWizardDateRangeChart } from './BuildWizardDateRangeChart';
import { BuildWizardFooterTimelineTrack } from './BuildWizardFooterTimelineTrack';
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
      <BuildWizardFooterTimelineTrack
        activeTab={activeTab}
        displayNumberById={displayNumberById}
        dragState={dragState}
        draftDatesByStepId={draftDatesByStepId}
        editableRows={editableRows}
        endDate={endDate}
        onDragStateChange={setDragState}
        onDraftDatesChange={setDraftDatesByStepId}
        onStepTimelineChange={onStepTimelineChange}
        orderedStatusPhases={orderedStatusPhases}
        phaseStatus={phaseStatus}
        rangeEnd={rangeEnd}
        rangeEndIso={rangeEndIso}
        rangeStart={rangeStart}
        rangeStartIso={rangeStartIso}
        segments={segments}
        startDate={startDate}
        timelineSteps={timelineSteps}
        totalDays={totalDays}
        trackRef={trackRef}
      />
    </div>
  );
}

export const DateRangeChart = BuildWizardDateRangeChart;
