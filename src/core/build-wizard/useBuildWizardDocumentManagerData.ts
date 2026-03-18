import React from 'react';

import { buildWizardTokenLabel } from '../buildWizardDropdownSettings';
import { prettyPhaseLabel, sortAlpha } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardContentSearchResult, IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';
import { BuildWizardSearchResult } from './buildWizardPageRenderTypes';

interface UseBuildWizardDocumentManagerDataOptions {
  attachExistingDocFilterByReceiptId: Record<number, string>;
  attachableProjectDocuments: IBuildWizardDocument[];
  buildTabs: Array<{ id: string; label: string }>;
  docKindOptions: Array<{ value: string }>;
  documentManagerKindFilter: string;
  documentManagerPhaseFilter: string;
  documentManagerQuery: string;
  documentManagerSearchResults: IBuildWizardContentSearchResult[];
  documentManagerStepFilter: string;
  documents: IBuildWizardDocument[];
  linkedStepOptions: Array<{ step: IBuildWizardStep; displayNumber: number; sortKey: string; label: string }>;
  moveTaskModalDocId: number;
  stepById: Map<number, IBuildWizardStep>;
  stepByIdMap: Map<number, IBuildWizardStep>;
  stepPhaseBucket: (step: IBuildWizardStep) => string;
  steps: IBuildWizardStep[];
  taskAttachmentsModalDocId: number;
  topbarSearchDocumentResults: IBuildWizardContentSearchResult[];
  topbarSearchQuery: string;
}

export function useBuildWizardDocumentManagerData({
  attachExistingDocFilterByReceiptId,
  attachableProjectDocuments,
  buildTabs,
  docKindOptions,
  documentManagerKindFilter,
  documentManagerPhaseFilter,
  documentManagerQuery,
  documentManagerSearchResults,
  documentManagerStepFilter,
  documents,
  linkedStepOptions,
  moveTaskModalDocId,
  stepById,
  stepByIdMap,
  stepPhaseBucket,
  steps,
  taskAttachmentsModalDocId,
  topbarSearchDocumentResults,
  topbarSearchQuery,
}: UseBuildWizardDocumentManagerDataOptions) {
  const projectDocuments = React.useMemo(() => documents.filter((doc) => !doc.step_id || Number(doc.step_id) <= 0), [documents]);
  const permitDocuments = React.useMemo(() => documents.filter((doc) => String(doc.kind || '') === 'permit').sort((a, b) => sortAlpha(String(a.original_name || ''), String(b.original_name || ''))), [documents]);
  const primaryPhotoChoices = React.useMemo(() => documents.filter((doc) => {
    const kind = String(doc.kind || '');
    return Number(doc.is_image) === 1 && (kind === 'photo' || kind === 'site_photo' || kind === 'home_photo' || kind === 'progress_photo');
  }).sort((a, b) => sortAlpha(String(a.original_name || ''), String(b.original_name || ''))), [documents]);
  const primaryBlueprintChoices = React.useMemo(() => documents.filter((doc) => String(doc.kind || '') === 'blueprint').sort((a, b) => sortAlpha(String(a.original_name || ''), String(b.original_name || ''))), [documents]);
  const phaseOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ value: string; label: string }> = [{ value: 'general', label: 'General' }];
    steps.forEach((step) => {
      const key = String(step.phase_key || '').trim() || 'general';
      if (seen.has(key) || key === 'general') return;
      seen.add(key);
      options.push({ value: key, label: prettyPhaseLabel(key) });
    });
    return options.sort((a, b) => sortAlpha(a.label, b.label));
  }, [steps]);
  const moveTaskModalDoc = React.useMemo(() => {
    const doc = moveTaskModalDocId > 0 ? (documents.find((candidate) => candidate.id === moveTaskModalDocId) || null) : null;
    return doc && String(doc.kind || '').trim() === 'receipt' ? doc : null;
  }, [documents, moveTaskModalDocId]);
  const taskAttachmentsModalDoc = React.useMemo(() => {
    const doc = taskAttachmentsModalDocId > 0 ? (documents.find((candidate) => candidate.id === taskAttachmentsModalDocId) || null) : null;
    return doc && String(doc.kind || '').trim() === 'receipt' ? doc : null;
  }, [documents, taskAttachmentsModalDocId]);
  const moveTaskStepOptions = React.useMemo(() => (!moveTaskModalDoc ? [] : linkedStepOptions.filter((option) => option.step.id !== Number(moveTaskModalDoc.step_id || 0))), [linkedStepOptions, moveTaskModalDoc]);
  const taskAttachmentsModalStep = React.useMemo(() => (!taskAttachmentsModalDoc ? null : (stepByIdMap.get(Number(taskAttachmentsModalDoc.step_id || 0)) || null)), [stepByIdMap, taskAttachmentsModalDoc]);
  const taskAttachmentsModalAttachableDocuments = React.useMemo(() => {
    if (!taskAttachmentsModalDoc) return [] as IBuildWizardDocument[];
    const receiptId = taskAttachmentsModalDoc.id;
    const receiptFilter = String(attachExistingDocFilterByReceiptId[receiptId] || '').trim().toLowerCase();
    return attachableProjectDocuments.filter((candidate) => {
      if (candidate.id === receiptId || String(candidate.kind || '').trim() === 'receipt') return false;
      const isAlreadyAttached = String(candidate.kind || '').trim() === 'receipt_attachment' && Number(candidate.receipt_parent_document_id || 0) === receiptId;
      if (isAlreadyAttached) return false;
      if (!receiptFilter) return true;
      return `${candidate.original_name} ${buildWizardTokenLabel(candidate.kind, 'Other')}`.toLowerCase().includes(receiptFilter);
    }).sort((a, b) => sortAlpha(String(a.original_name || ''), String(b.original_name || '')));
  }, [attachExistingDocFilterByReceiptId, attachableProjectDocuments, taskAttachmentsModalDoc]);
  const documentManagerKindOptions = React.useMemo(() => {
    const fromDocs = documents.filter((doc) => String(doc.kind || '').trim() !== 'receipt_attachment').map((doc) => String(doc.kind || '').trim()).filter(Boolean);
    const fromSettings = docKindOptions.map((opt) => String(opt.value || '').trim()).filter(Boolean);
    return Array.from(new Set([...fromSettings, ...fromDocs])).sort((a, b) => sortAlpha(a, b));
  }, [docKindOptions, documents]);
  const documentManagerPhaseOptions = React.useMemo(() => {
    const keys = new Set<string>(['general']);
    steps.forEach((step) => keys.add(String(step.phase_key || '').trim() || 'general'));
    documents.forEach((doc) => {
      const key = String(doc.step_phase_key || '').trim();
      if (key) keys.add(key);
    });
    return Array.from(keys).sort((a, b) => sortAlpha(prettyPhaseLabel(a), prettyPhaseLabel(b)));
  }, [documents, steps]);
  const documentManagerLinkedStepFilterOptions = React.useMemo(() => {
    const linkedIds = new Set<number>();
    documents.forEach((doc) => {
      const stepId = Number(doc.step_id || 0);
      if (stepId > 0) linkedIds.add(stepId);
    });
    return linkedStepOptions.filter((option) => linkedIds.has(option.step.id));
  }, [documents, linkedStepOptions]);
  const documentManagerSearchIds = React.useMemo(() => {
    const ids = new Set<number>();
    documentManagerSearchResults.forEach((doc) => {
      if (Number(doc.id) > 0) ids.add(Number(doc.id));
    });
    return ids;
  }, [documentManagerSearchResults]);
  const filteredDocumentManagerDocs = React.useMemo(() => {
    const query = documentManagerQuery.trim();
    return documents.filter((doc) => {
      const docKindValue = String(doc.kind || '').trim();
      if (docKindValue === 'receipt_attachment') return false;
      if (documentManagerKindFilter !== 'all' && docKindValue !== documentManagerKindFilter) return false;
      const docPhaseValue = String(doc.step_phase_key || '').trim() || 'general';
      if (documentManagerPhaseFilter !== 'all' && docPhaseValue !== documentManagerPhaseFilter) return false;
      if (documentManagerStepFilter === 'unlinked' && Number(doc.step_id || 0) > 0) return false;
      if (documentManagerStepFilter !== 'all' && documentManagerStepFilter !== 'unlinked' && Number(doc.step_id || 0) !== Number(documentManagerStepFilter)) return false;
      if (query.length >= 2 && !documentManagerSearchIds.has(Number(doc.id))) return false;
      return true;
    });
  }, [documentManagerKindFilter, documentManagerPhaseFilter, documentManagerQuery, documentManagerSearchIds, documentManagerStepFilter, documents]);
  const documentManagerSearchResultById = React.useMemo(() => {
    const map = new Map<number, IBuildWizardContentSearchResult>();
    documentManagerSearchResults.forEach((doc) => {
      if (Number(doc.id) > 0) {
        map.set(Number(doc.id), doc);
      }
    });
    return map;
  }, [documentManagerSearchResults]);
  const topbarSearchResults = React.useMemo<BuildWizardSearchResult[]>(() => {
    const query = topbarSearchQuery.trim().toLowerCase();
    if (!query) return [];
    const tokens = query.split(/\s+/g).filter(Boolean);
    if (!tokens.length) return [];
    const includesAll = (haystack: string) => tokens.every((token) => haystack.includes(token));
    const rank = (haystack: string) => (haystack.includes(query) ? 20 : 0) + tokens.reduce((score, token) => score + (haystack.includes(token) ? 5 : 0), 0);
    const results: BuildWizardSearchResult[] = [];
    buildTabs.filter((tab) => tab.id !== 'desk').forEach((tab) => {
      const normalized = `${String(tab.label || '').toLowerCase()} ${String(prettyPhaseLabel(tab.id)).toLowerCase()}`;
      if (includesAll(normalized)) results.push({ id: `phase:${tab.id}`, score: 90 + rank(normalized), kind: 'phase', title: tab.label, subtitle: 'Build Wizard phase', phaseId: tab.id as any });
    });
    steps.forEach((step) => {
      const phaseId = stepPhaseBucket(step);
      const notesText = (step.notes || []).map((note) => String(note.note_text || '')).join(' ');
      const normalized = [step.title, step.description, step.phase_key, prettyPhaseLabel(step.phase_key), step.step_type, notesText].map((value) => String(value || '').toLowerCase()).join(' ');
      if (includesAll(normalized)) results.push({ id: `step:${step.id}`, score: 70 + rank(normalized), kind: 'step', title: `#${step.step_order} ${step.title}`, subtitle: `${prettyPhaseLabel(step.phase_key)} phase`, stepId: step.id, phaseId: phaseId as any });
    });
    topbarSearchDocumentResults.forEach((doc) => {
      const normalized = [doc.original_name, doc.caption, doc.kind, doc.step_title, doc.step_phase_key, prettyPhaseLabel(doc.step_phase_key || 'general'), doc.snippet].map((value) => String(value || '').toLowerCase()).join(' ');
      if (!includesAll(normalized)) return;
      const linkedStepId = Number(doc.step_id || 0);
      const linkedStep = linkedStepId > 0 ? stepById.get(linkedStepId) : null;
      const linkedPhaseId = linkedStep ? stepPhaseBucket(linkedStep) : null;
      results.push({
        id: `document:${doc.id}`,
        score: 60 + rank(normalized),
        kind: 'document',
        title: doc.original_name || `Document #${doc.id}`,
        subtitle: linkedStepId > 0 ? `${buildWizardTokenLabel(doc.kind, 'Other')} | Linked to ${doc.step_title || `step #${linkedStepId}`}${doc.snippet ? ` | ${doc.snippet}` : ''}` : `${buildWizardTokenLabel(doc.kind, 'Other')} | Project document${doc.snippet ? ` | ${doc.snippet}` : ''}`,
        document: doc,
        linkedStepId,
        linkedPhaseId: linkedPhaseId as any,
      });
    });
    return results.sort((a, b) => b.score - a.score).slice(0, 20);
  }, [buildTabs, stepById, stepPhaseBucket, steps, topbarSearchDocumentResults, topbarSearchQuery]);
  return { documentManagerKindOptions, documentManagerLinkedStepFilterOptions, documentManagerPhaseOptions, documentManagerSearchResultById, filteredDocumentManagerDocs, moveTaskModalDoc, moveTaskStepOptions, permitDocuments, phaseOptions, primaryBlueprintChoices, primaryPhotoChoices, projectDocuments, taskAttachmentsModalAttachableDocuments, taskAttachmentsModalDoc, taskAttachmentsModalStep, topbarSearchResults };
}
