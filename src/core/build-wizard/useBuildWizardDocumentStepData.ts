import React from 'react';

import { PHASE_PROGRESS_ORDER } from '../../components/pages/build-wizard/buildWizardConstants';
import { calculateDurationDays, isBuildWizardTaskDocumentKind, toStringOrNull } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardContact, IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';
import { BuildTabId } from '../../types/pages/buildWizardPage';

interface UseBuildWizardDocumentStepDataOptions {
  contacts: IBuildWizardContact[];
  documentSavingId: number;
  documents: IBuildWizardDocument[];
  projectId: number;
  resolvePhaseDateRange: (tabId: BuildTabId) => { start: string | null; end: string | null };
  savePhaseDateRange: (projectId: number, phaseTab: 'land' | 'permits' | 'site' | 'framing' | 'mep' | 'finishes', startDate: string | null, endDate: string | null) => Promise<unknown>;
  setDocumentSavingId: React.Dispatch<React.SetStateAction<number>>;
  stepPhaseBucket: (step: IBuildWizardStep) => BuildTabId;
  updateDocument: (documentId: number, patch: Partial<IBuildWizardDocument>) => Promise<IBuildWizardDocument | null | undefined>;
}

export function useBuildWizardDocumentStepData({
  contacts,
  documentSavingId,
  documents,
  projectId,
  resolvePhaseDateRange,
  savePhaseDateRange,
  setDocumentSavingId,
  stepPhaseBucket,
  updateDocument,
}: UseBuildWizardDocumentStepDataOptions) {
  const expandPhaseRangeForStep = React.useCallback(async (
    step: IBuildWizardStep,
    overrides?: Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'>,
  ) => {
    const tabId = stepPhaseBucket(step);
    if (!PHASE_PROGRESS_ORDER.includes(tabId)) {
      return;
    }
    const stepStart = toStringOrNull((overrides?.expected_start_date ?? step.expected_start_date) || '');
    const stepEnd = toStringOrNull((overrides?.expected_end_date ?? step.expected_end_date) || '') || stepStart;
    if (!stepStart && !stepEnd) {
      return;
    }
    const currentRange = resolvePhaseDateRange(tabId);
    const nextStart = stepStart ? (currentRange.start ? (stepStart < currentRange.start ? stepStart : currentRange.start) : stepStart) : currentRange.start;
    const nextEnd = stepEnd ? (currentRange.end ? (stepEnd > currentRange.end ? stepEnd : currentRange.end) : stepEnd) : currentRange.end;
    if (nextStart === currentRange.start && nextEnd === currentRange.end) {
      return;
    }
    await savePhaseDateRange(projectId, tabId as 'land' | 'permits' | 'site' | 'framing' | 'mep' | 'finishes', nextStart || null, nextEnd || null);
  }, [projectId, resolvePhaseDateRange, savePhaseDateRange, stepPhaseBucket]);

  const onSaveDocument = React.useCallback(async (
    documentId: number,
    patch: {
      kind?: string;
      caption?: string | null;
      step_id?: number | null;
      receipt_parent_document_id?: number | null;
      receipt_amount?: number | null;
      receipt_title?: string | null;
      receipt_vendor?: string | null;
      receipt_date?: string | null;
      receipt_notes?: string | null;
    },
  ) => {
    if (documentSavingId === documentId) {
      return null;
    }
    setDocumentSavingId(documentId);
    try {
      return await updateDocument(documentId, patch);
    } finally {
      setDocumentSavingId(0);
    }
  }, [documentSavingId, setDocumentSavingId, updateDocument]);

  const taskVendorOptions = React.useMemo(() => {
    const names = new Set<string>();
    contacts.forEach((contact) => {
      const displayName = String(contact.display_name || '').trim();
      const company = String(contact.company || '').trim();
      if (displayName) names.add(displayName);
      if (company) names.add(company);
    });
    documents.forEach((doc) => {
      if (!isBuildWizardTaskDocumentKind(doc.kind)) {
        return;
      }
      const vendor = String(doc.receipt_vendor || '').trim();
      if (vendor) names.add(vendor);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [contacts, documents]);

  const clampStepDatesWithinRange = React.useCallback((
    step: Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'>,
    minDate?: string | null,
    maxDate?: string | null,
  ) => {
    const lower = toStringOrNull(minDate || '');
    const upper = toStringOrNull(maxDate || '');
    if (!lower && !upper) {
      return null;
    }
    let nextStart = toStringOrNull(step.expected_start_date || '');
    let nextEnd = toStringOrNull(step.expected_end_date || '');
    if (!nextStart) nextStart = lower || upper || null;
    if (!nextEnd) nextEnd = nextStart;
    if (lower && nextStart && nextStart < lower) nextStart = lower;
    if (upper && nextStart && nextStart > upper) nextStart = upper;
    if (lower && nextEnd && nextEnd < lower) nextEnd = lower;
    if (upper && nextEnd && nextEnd > upper) nextEnd = upper;
    if (nextStart && nextEnd && nextEnd < nextStart) nextEnd = nextStart;
    const changed = nextStart !== toStringOrNull(step.expected_start_date || '') || nextEnd !== toStringOrNull(step.expected_end_date || '');
    if (!changed) {
      return null;
    }
    return { expected_start_date: nextStart, expected_end_date: nextEnd, expected_duration_days: calculateDurationDays(nextStart, nextEnd) ?? null };
  }, []);

  return { clampStepDatesWithinRange, expandPhaseRangeForStep, onSaveDocument, taskVendorOptions };
}
