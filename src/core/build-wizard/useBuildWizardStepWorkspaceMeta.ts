import React from 'react';

import { BUILD_TABS, PHASE_PROGRESS_ORDER, TAB_DEFAULT_PHASE_KEY } from '../../components/pages/build-wizard/buildWizardConstants';
import { prettyPhaseLabel, sortAlpha } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardContact, IBuildWizardContactAssignment, IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';
import { BuildTabId } from '../../types/pages/buildWizardPage';
import { BuildWizardTaskMeta, normalizeContactType } from './buildWizardPageRenderTypes';
import { buildSearchText } from './buildWizardSearchCostUtils';

export function useBuildWizardStepWorkspaceMeta({
  contactAssignments,
  contacts,
  documents,
  filteredTabSteps,
  parseTaskMetaFromReceiptNotes,
  stepCardTextFilter,
  stepPhaseBucket,
  steps,
}: {
  contactAssignments: IBuildWizardContactAssignment[];
  contacts: IBuildWizardContact[];
  documents: IBuildWizardDocument[];
  filteredTabSteps: IBuildWizardStep[];
  parseTaskMetaFromReceiptNotes: (notes: string) => { plainNotes: string; taskMeta: BuildWizardTaskMeta };
  stepCardTextFilter: string;
  stepPhaseBucket: (step: IBuildWizardStep) => BuildTabId;
  steps: IBuildWizardStep[];
}) {
  const stepAssigneesByStepId = React.useMemo(() => {
    const normalizePhaseKey = (value: string | null | undefined): string => String(value || '').trim().toLowerCase();
    const contactMap = new Map<number, IBuildWizardContact>(contacts.map((contact) => [contact.id, contact]));
    const byStep = new Map<number, Array<{ contact: IBuildWizardContact; source: 'step' | 'phase' }>>();
    steps.forEach((step) => {
      const phaseKey = normalizePhaseKey(step.phase_key || 'general');
      const dedupByContact = new Map<number, { contact: IBuildWizardContact; source: 'step' | 'phase' }>();
      contactAssignments.forEach((assignment) => {
        const assignmentStepId = Number(assignment.step_id || 0);
        const assignmentPhaseKey = normalizePhaseKey(assignment.phase_key || '');
        const isStepMatch = assignmentStepId > 0 && assignmentStepId === step.id;
        const isPhaseMatch = assignmentStepId <= 0 && assignmentPhaseKey !== '' && assignmentPhaseKey === phaseKey;
        if (!isStepMatch && !isPhaseMatch) return;
        const contact = contactMap.get(assignment.contact_id);
        if (!contact) return;
        const nextSource: 'step' | 'phase' = isStepMatch ? 'step' : 'phase';
        const existing = dedupByContact.get(contact.id);
        if (!existing || (existing.source === 'phase' && nextSource === 'step')) dedupByContact.set(contact.id, { contact, source: nextSource });
      });
      if (dedupByContact.size > 0) byStep.set(step.id, Array.from(dedupByContact.values()).sort((a, b) => sortAlpha(String(a.contact.display_name || ''), String(b.contact.display_name || ''))));
    });
    return byStep;
  }, [contactAssignments, contacts, steps]);

  const stepDirectAssigneesByStepId = React.useMemo(() => {
    const contactMap = new Map<number, IBuildWizardContact>(contacts.map((contact) => [contact.id, contact]));
    const byStep = new Map<number, Array<{ assignment: IBuildWizardContactAssignment; contact: IBuildWizardContact }>>();
    contactAssignments.forEach((assignment) => {
      const stepId = Number(assignment.step_id || 0);
      if (stepId <= 0) return;
      const contact = contactMap.get(assignment.contact_id);
      if (!contact) return;
      const rows = byStep.get(stepId) || [];
      rows.push({ assignment, contact });
      byStep.set(stepId, rows);
    });
    byStep.forEach((rows, stepId) => byStep.set(stepId, [...rows].sort((a, b) => sortAlpha(String(a.contact.display_name || ''), String(b.contact.display_name || '')))));
    return byStep;
  }, [contactAssignments, contacts]);

  const stepFilterContactOptions = React.useMemo(() => {
    const inTabContactIds = new Set<number>();
    filteredTabSteps.forEach((step) => (stepAssigneesByStepId.get(step.id) || []).forEach((entry) => inTabContactIds.add(entry.contact.id)));
    return contacts.filter((contact) => inTabContactIds.has(contact.id)).sort((a, b) => sortAlpha(String(a.display_name || ''), String(b.display_name || '')));
  }, [contacts, filteredTabSteps, stepAssigneesByStepId]);

  const moveStepPhaseTabOptions = React.useMemo(() => PHASE_PROGRESS_ORDER.map((tabId) => {
    const tab = BUILD_TABS.find((candidate) => candidate.id === tabId);
    return { value: tabId, label: tab?.label || prettyPhaseLabel(TAB_DEFAULT_PHASE_KEY[tabId] || tabId) };
  }), []);

  const moveStepPhaseOrderPreviewByTab = React.useMemo(() => {
    const compareStepsByTimeline = (left: IBuildWizardStep, right: IBuildWizardStep): number => {
      const leftStart = String(left.expected_start_date || '').trim() || null;
      const leftEnd = String(left.expected_end_date || '').trim() || null;
      const rightStart = String(right.expected_start_date || '').trim() || null;
      const rightEnd = String(right.expected_end_date || '').trim() || null;
      const leftAnchor = leftStart || leftEnd;
      const rightAnchor = rightStart || rightEnd;
      if (leftAnchor === null && rightAnchor !== null) return 1;
      if (leftAnchor !== null && rightAnchor === null) return -1;
      if (leftAnchor !== null && rightAnchor !== null && leftAnchor !== rightAnchor) return leftAnchor.localeCompare(rightAnchor);
      if (leftStart === null && rightStart !== null) return 1;
      if (leftStart !== null && rightStart === null) return -1;
      if (leftStart !== null && rightStart !== null && leftStart !== rightStart) return leftStart.localeCompare(rightStart);
      if (leftEnd === null && rightEnd !== null) return 1;
      if (leftEnd !== null && rightEnd === null) return -1;
      if (leftEnd !== null && rightEnd !== null && leftEnd !== rightEnd) return leftEnd.localeCompare(rightEnd);
      if (left.step_order !== right.step_order) return left.step_order - right.step_order;
      return left.id - right.id;
    };

    const previewByTab = {} as Partial<Record<BuildTabId, Array<{ id: number; label: string }>>>;
    PHASE_PROGRESS_ORDER.forEach((tabId) => {
      const orderedSteps = steps
        .filter((step) => stepPhaseBucket(step) === tabId)
        .sort(compareStepsByTimeline);
      previewByTab[tabId] = orderedSteps.map((step, index) => ({ id: step.id, label: `#${index + 1} ${String(step.title || '').trim() || 'Untitled step'}` }));
    });
    return previewByTab;
  }, [stepPhaseBucket, steps]);

  const stepCardTextFilterTokens = React.useMemo(() => stepCardTextFilter.trim().toLowerCase().split(/\s+/g).filter(Boolean), [stepCardTextFilter]);

  const stepSearchTextById = React.useMemo(() => {
    const documentsByStepId = new Map<number, IBuildWizardDocument[]>();
    documents.forEach((documentItem) => {
      const stepId = Number(documentItem.step_id || 0);
      if (stepId <= 0) return;
      const rows = documentsByStepId.get(stepId) || [];
      rows.push(documentItem);
      documentsByStepId.set(stepId, rows);
    });
    const byId = new Map<number, string>();
    steps.forEach((step) => {
      const stepDocuments = documentsByStepId.get(step.id) || [];
      const stepAssignees = stepAssigneesByStepId.get(step.id) || [];
      const parsedReceiptData = stepDocuments.filter((documentItem) => String(documentItem.kind || '').trim() === 'receipt').map((documentItem) => parseTaskMetaFromReceiptNotes(documentItem.receipt_notes));
      byId.set(step.id, buildSearchText(step, stepDocuments, stepAssignees.map((entry) => entry.contact), parsedReceiptData, prettyPhaseLabel(step.phase_key)));
    });
    return byId;
  }, [documents, parseTaskMetaFromReceiptNotes, stepAssigneesByStepId, steps]);

  const receiptMetricsByStepId = React.useMemo(() => {
    const map = new Map<number, { allCount: number; nonQuoteCount: number; quoteCount: number; allTotal: number; nonQuoteTotal: number; quoteTotal: number }>();
    documents.forEach((documentItem) => {
      if (String(documentItem.kind || '').trim() !== 'receipt') return;
      const stepId = Number(documentItem.step_id || 0);
      if (stepId <= 0) return;
      const existing = map.get(stepId) || { allCount: 0, nonQuoteCount: 0, quoteCount: 0, allTotal: 0, nonQuoteTotal: 0, quoteTotal: 0 };
      const parsed = parseTaskMetaFromReceiptNotes(documentItem.receipt_notes || '');
      const isQuote = parsed.taskMeta.task_type === 'quote';
      const amount = Number(documentItem.receipt_amount || 0);
      const normalizedAmount = Number.isFinite(amount) ? amount : 0;
      existing.allCount += 1;
      existing.allTotal += normalizedAmount;
      if (isQuote) {
        existing.quoteCount += 1;
        existing.quoteTotal += normalizedAmount;
      } else {
        existing.nonQuoteCount += 1;
        existing.nonQuoteTotal += normalizedAmount;
      }
      map.set(stepId, existing);
    });
    return map;
  }, [documents, parseTaskMetaFromReceiptNotes]);

  const getStepQuoteTotal = React.useCallback((stepId: number): number => receiptMetricsByStepId.get(stepId)?.quoteTotal || 0, [receiptMetricsByStepId]);
  const getStepActualExcludingQuotes = React.useCallback((step: IBuildWizardStep): number => {
    const receiptMetrics = receiptMetricsByStepId.get(step.id);
    if (receiptMetrics && receiptMetrics.allCount > 0) {
      return Math.max(0, receiptMetrics.nonQuoteTotal);
    }
    return Math.max(0, (Number.isFinite(Number(step.actual_cost)) && Number(step.actual_cost) > 0 ? Number(step.actual_cost) : 0) - getStepQuoteTotal(step.id));
  }, [getStepQuoteTotal, receiptMetricsByStepId]);
  const getStepEstimatedExcludingQuotes = React.useCallback((step: IBuildWizardStep): number => Math.max(0, (Number.isFinite(Number(step.estimated_cost)) && Number(step.estimated_cost) > 0 ? Number(step.estimated_cost) : 0) - getStepQuoteTotal(step.id)), [getStepQuoteTotal]);

  return { getStepActualExcludingQuotes, getStepEstimatedExcludingQuotes, moveStepPhaseOrderPreviewByTab, moveStepPhaseTabOptions, receiptMetricsByStepId, stepAssigneesByStepId, stepCardTextFilterTokens, stepDirectAssigneesByStepId, stepFilterContactOptions, stepSearchTextById };
}
