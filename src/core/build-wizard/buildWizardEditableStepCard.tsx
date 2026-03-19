import React from 'react';

import { BUILD_TABS } from '../../components/pages/build-wizard/buildWizardConstants';
import { calculateDurationDays, prettyPhaseLabel, sortAlpha, stepPhaseBucket, toNumberOrNull, toStringOrNull, getStepPastelColor } from '../../components/pages/build-wizard/buildWizardUtils';
import { buildWizardTokenLabel } from '../buildWizardDropdownSettings';
import { buildStepCostVerificationSignature } from './buildWizardSearchCostUtils';
import { defaultTaskMeta } from './buildWizardTaskMetaUtils';
import { BuildWizardStepActionPanel } from './buildWizardStepActionPanel';
import { BuildWizardStepAssignees } from './buildWizardStepAssignees';
import { BuildWizardStepNotes } from './buildWizardStepNotes';
import { BuildWizardStepReceiptEditor } from './buildWizardStepReceiptEditor';
import { BuildWizardStepReceiptsList } from './buildWizardStepReceiptsList';
import { BuildWizardEditableStepCardHeader } from './buildWizardEditableStepCardHeader';
import { BuildWizardEditableStepCardContext, BuildWizardEditableTreeRow } from './buildWizardEditableStepCardTypes';

interface BuildWizardEditableStepCardProps {
  context: BuildWizardEditableStepCardContext;
  row: BuildWizardEditableTreeRow;
}

export function BuildWizardEditableStepCard({ context, row }: BuildWizardEditableStepCardProps) {
  const {
    activeTabStepNumbers,
    attachExistingDocFilterByStepId,
    attachableProjectDocuments,
    authorityContacts,
    autosaveExistingReceiptDraftForStep,
    contactTypeChipClass,
    contactTypeLabel,
    contacts,
    deleteStep,
    deletingDocumentId,
    deletingNoteId,
    documents,
    dragOverParentStepId,
    draggingStepId,
    editingNoteTextById,
    editingReceiptDocumentIdByStep,
    expandedStepById,
    formatDate,
    getTaskEffectiveDate,
    inlineEditingReceiptFieldByDocId,
    inlineReceiptDraftByDocId,
    incompleteDescendantCountByStepId,
    linkedStepDisplayNumberById,
    normalizeContactType,
    noteDraftByStep,
    noteEditedAtLabel,
    noteEditorOpenByStep,
    onAddContactToStep,
    onAttachExistingDocumentToStep,
    onCancelEditNote,
    onDeleteDocument,
    onDeleteStepNoteById,
    onDropMakeChild,
    onOpenDocumentPreview,
    onOpenMoveStepModal,
    onRefreshStepActualCost,
    onSaveEditedNote,
    onSaveReceiptForStep,
    onStartEditNote,
    onStartEditReceiptForStep,
    onSubmitNote,
    openMoveTaskModal,
    openStepEditModal,
    openTaskAttachmentsModal,
    parseTaskMetaFromReceiptNotes,
    permitDocuments,
    permitStatusOptions,
    purchaseUnitOptions,
    receiptDraftByStep,
    receiptEditorOpenByStep,
    receiptEditorRefByStepId,
    receiptMetricsByStepId,
    receiptRowRefByDocId,
    refreshingActualCostByStepId,
    renderDocumentGallery,
    requestConfirmation,
    saveInlineReceiptEdit,
    savingNoteId,
    setAttachExistingDocByStepId,
    setAttachExistingDocFilterByStepId,
    setAttachExistingPickerOpenByStepId,
    setDragOverInsertIndex,
    setDragOverParentStepId,
    setEditingNoteTextById,
    setEditingReceiptDocumentIdByStep,
    setExpandedStepById,
    setInlineReceiptDraftByDocId,
    setNoteDraftByStep,
    setNoteEditorOpenByStep,
    setReceiptAttachmentDraftByStep,
    setReceiptDraftByStep,
    setReceiptEditorOpenByStep,
    setStepContactCandidateByStepId,
    setStepContactPickerOpenByStepId,
    setStepInfoModalStepId,
    startInlineReceiptEdit,
    stepAssigneesByStepId,
    stepById,
    stepContactCandidateByStepId,
    stepContactPickerOpenByStepId,
    stepDirectAssigneesByStepId,
    stepDrafts,
    taskTypeOptions,
    taskUsesManualDateOverride,
    taskVendorOptions,
    toggleStep,
    uploadDocument,
    verifiedActualCostSignatureByStepId,
  } = context;
  const safeStepAssigneesByStepId = stepAssigneesByStepId ?? new Map<number, typeof stepAssigneesByStepId extends Map<number, infer V> ? V : never>();
  const safeStepDirectAssigneesByStepId = stepDirectAssigneesByStepId ?? new Map<number, typeof stepDirectAssigneesByStepId extends Map<number, infer V> ? V : never>();
  const safeStepDrafts = stepDrafts ?? {};
  const safeExpandedStepById = expandedStepById ?? {};
  const safeReceiptMetricsByStepId = receiptMetricsByStepId ?? new Map<number, typeof receiptMetricsByStepId extends Map<number, infer V> ? V : never>();
  const safeVerifiedActualCostSignatureByStepId = verifiedActualCostSignatureByStepId ?? {};
  const safeRefreshingActualCostByStepId = refreshingActualCostByStepId ?? {};
  const safeReceiptDraftByStep = receiptDraftByStep ?? {};
  const safeAttachExistingDocFilterByStepId = attachExistingDocFilterByStepId ?? {};
  const safeReceiptEditorOpenByStep = receiptEditorOpenByStep ?? {};
  const safeStepContactCandidateByStepId = stepContactCandidateByStepId ?? {};
  const step = row.step;
  const allStepAssignees = safeStepAssigneesByStepId.get(step.id) || [];
  const directStepAssignees = safeStepDirectAssigneesByStepId.get(step.id) || [];
  const stepReadOnly = Number(step.is_completed) === 1;
  const stepDisplayNumber = activeTabStepNumbers.get(step.id) || step.step_order;
  const draft = safeStepDrafts[step.id] || step;
  const parentStep = Number(draft.parent_step_id || 0) > 0 ? stepById.get(Number(draft.parent_step_id || 0)) : null;
  const incompleteDescendantCount = incompleteDescendantCountByStepId.get(step.id) || 0;
  const completionLocked = Number(step.is_completed) !== 1 && incompleteDescendantCount > 0;
  const durationDays = calculateDurationDays(draft.expected_start_date, draft.expected_end_date) ?? (draft.expected_duration_days ?? null);
  const dependencyIds = Array.from(new Set((Array.isArray(draft.depends_on_step_ids) ? draft.depends_on_step_ids : []).map((rawId) => Number(rawId || 0)).filter((id) => id > 0 && id !== step.id)));
  const dependencyItems = dependencyIds.map((dependencyId) => {
    const dependency = stepById.get(dependencyId) || null;
    if (!dependency) {
      return { id: dependencyId, label: `#${dependencyId} (missing step)` };
    }
    const phaseId = stepPhaseBucket(dependency);
    const phase = BUILD_TABS.find((tab) => tab.id === phaseId);
    const phaseLabel = phase ? phase.label : prettyPhaseLabel(dependency.phase_key);
    return { id: dependencyId, label: `#${activeTabStepNumbers.get(dependency.id) || dependency.step_order} ${dependency.title} (${phaseLabel})` };
  });
  const stepPastelColor = getStepPastelColor(step.id);
  const isExpanded = safeExpandedStepById[step.id] === true;
  const stepDocuments = documents.filter((doc) => Number(doc.step_id || 0) === step.id);
  const stepReceiptDocuments = stepDocuments.filter((doc) => doc.kind === 'receipt').sort((a, b) => {
    const aDate = toStringOrNull(a.receipt_date || '');
    const bDate = toStringOrNull(b.receipt_date || '');
    if (aDate && bDate && aDate !== bDate) return aDate.localeCompare(bDate);
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;
    const uploadedCmp = String(a.uploaded_at || '').localeCompare(String(b.uploaded_at || ''));
    if (uploadedCmp !== 0) return uploadedCmp;
    return a.id - b.id;
  });
  const stepReceiptAttachmentDocuments = stepDocuments.filter((doc) => doc.kind === 'receipt_attachment');
  const stepNonReceiptDocuments = stepDocuments.filter((doc) => doc.kind !== 'receipt' && doc.kind !== 'receipt_attachment');
  const stepReceiptMetrics = safeReceiptMetricsByStepId.get(step.id) || {
    allCount: stepReceiptDocuments.length,
    nonQuoteCount: stepReceiptDocuments.length,
    quoteCount: 0,
    allTotal: stepReceiptDocuments.reduce((sum, doc) => sum + Number(doc.receipt_amount || 0), 0),
    nonQuoteTotal: stepReceiptDocuments.reduce((sum, doc) => sum + Number(doc.receipt_amount || 0), 0),
    quoteTotal: 0,
  };
  const stepTaskCount = Math.max(stepReceiptDocuments.length, Number(draft.receipt_count || 0));
  const stepReceiptTotal = stepReceiptMetrics.nonQuoteTotal;
  const actualCostFloor = Math.max(0, stepReceiptTotal);
  const draftActualCost = toNumberOrNull(String(draft.actual_cost ?? ''));
  const effectiveActualCost = draftActualCost;
  const recalculatedActualCost = actualCostFloor > 0 ? actualCostFloor : null;
  const actualCostVerificationSignature = buildStepCostVerificationSignature(step, safeStepDrafts[step.id], stepDocuments, effectiveActualCost);
  const refreshedActualCostVerificationSignature = buildStepCostVerificationSignature(step, safeStepDrafts[step.id], stepDocuments, recalculatedActualCost);
  const isActualCostVerified = safeVerifiedActualCostSignatureByStepId[step.id] === actualCostVerificationSignature;
  const isRefreshingActualCost = safeRefreshingActualCostByStepId[step.id] === true;
  const receiptDraft = safeReceiptDraftByStep[step.id] || {
    receipt_title: '',
    receipt_vendor: '',
    receipt_date: '',
    receipt_amount: '',
    receipt_notes: '',
    task_meta: defaultTaskMeta((step.step_type || 'construction') as Parameters<typeof defaultTaskMeta>[0]),
  };
  const stepAttachmentFilter = String(safeAttachExistingDocFilterByStepId[step.id] || '').trim().toLowerCase();
  const filteredAttachableProjectDocuments = stepAttachmentFilter ? attachableProjectDocuments.filter((doc) => {
    const linkedStepId = Number(doc.step_id || 0);
    const linkedStep = linkedStepId > 0 ? stepById.get(linkedStepId) : null;
    const haystack = `${doc.original_name} ${buildWizardTokenLabel(doc.kind, 'Other')} ${linkedStep?.title || ''}`.toLowerCase();
    return haystack.includes(stepAttachmentFilter);
  }) : attachableProjectDocuments;
  const receiptEditorOpen = safeReceiptEditorOpenByStep[step.id] === true;
  const stepDirectContactIdSet = new Set<number>(directStepAssignees.map((entry) => entry.contact.id));
  const addableStepContactOptions = contacts
    .filter((contact) => !stepDirectContactIdSet.has(contact.id))
    .sort((a, b) => sortAlpha(String(a.display_name || ''), String(b.display_name || '')));
  const selectedStepContactCandidateId = Number(safeStepContactCandidateByStepId[step.id] || 0);
  const effectiveStepContactCandidateId = selectedStepContactCandidateId > 0 && addableStepContactOptions.some((contact) => contact.id === selectedStepContactCandidateId) ? selectedStepContactCandidateId : (addableStepContactOptions[0]?.id || 0);

  return (
    <div
      id={`build-wizard-step-${step.id}`}
      className={`build-wizard-step ${row.level > 0 ? 'is-child' : ''} ${dragOverParentStepId === step.id ? 'is-parent-target' : ''} ${stepReadOnly ? 'is-readonly' : ''} ${!isExpanded ? 'is-collapsed' : ''}`}
      style={{ '--bw-indent-level': String(row.level), '--bw-step-phase-color': stepPastelColor } as React.CSSProperties}
      draggable={!stepReadOnly}
      onDragStart={(e) => {
        const target = e.target as HTMLElement | null;
        if (!target?.closest('.build-wizard-step-drag-handle-btn')) {
          e.preventDefault();
          return;
        }
        context.beginStepDrag(e as React.DragEvent<HTMLElement>, step.id, stepReadOnly);
      }}
      onDragEnd={() => context.clearStepDragState()}
      onDragOver={(e) => {
        if (!stepReadOnly && draggingStepId > 0 && draggingStepId !== step.id) {
          e.preventDefault();
          setDragOverParentStepId(step.id);
          setDragOverInsertIndex(-1);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        void onDropMakeChild(step.id);
      }}
    >
      <div className="build-wizard-step-phase-accent" style={{ background: stepPastelColor }} />
      <BuildWizardEditableStepCardHeader
        completionLocked={completionLocked}
        durationDays={durationDays}
        effectiveActualCost={effectiveActualCost}
        estimatedCost={step.estimated_cost !== null ? Number(step.estimated_cost || 0) : null}
        formatCurrency={context.formatCurrency}
        hasStepTasks={stepTaskCount > 0}
        incompleteDescendantCount={incompleteDescendantCount}
        isActualCostVerified={isActualCostVerified}
        isExpanded={isExpanded}
        isRefreshingActualCost={isRefreshingActualCost}
        onDeleteStep={() => {
          if (stepReadOnly) return;
          void (async () => {
            const ok = await requestConfirmation({
              title: 'Delete Step?',
              message: 'Delete this step?',
              confirmLabel: 'Delete Step',
              confirmButtonClass: 'btn btn-danger',
            });
            if (ok) await deleteStep(step.id);
          })();
        }}
        onOpenMoveStepModal={onOpenMoveStepModal}
        onRefreshActualCost={() => void onRefreshStepActualCost(step, refreshedActualCostVerificationSignature, recalculatedActualCost)}
        onSetExpanded={setExpandedStepById}
        onSetStepInfoModalStepId={setStepInfoModalStepId}
        openStepEditModal={openStepEditModal}
        rowLevel={row.level}
        step={step}
        stepAttachmentCount={stepDocuments.length}
        stepDisplayNumber={stepDisplayNumber}
        stepTaskCount={stepTaskCount}
        stepReadOnly={stepReadOnly}
        toggleStep={toggleStep}
      />
      {isExpanded ? (
        <>
          <fieldset className="build-wizard-step-fields" disabled={stepReadOnly}>
            <div className="build-wizard-step-grid">
              <div className={`build-wizard-type-note build-wizard-dependency-note ${dependencyItems.length ? '' : 'is-empty-inline'}`}>
                <div className="build-wizard-dependency-head"><span>Depends on:</span></div>
                {dependencyItems.length ? <div className="build-wizard-dependency-chip-list">{dependencyItems.map((dependencyItem) => <span key={`${step.id}-dependency-${dependencyItem.id}`} className="build-wizard-dependency-chip">{dependencyItem.label}</span>)}</div> : <div className="build-wizard-dependency-empty">No dependencies set.</div>}
              </div>
              {parentStep ? <div className="build-wizard-type-note">Child of: #{activeTabStepNumbers.get(parentStep.id) || parentStep.step_order} {parentStep.title}</div> : null}
              {(stepReceiptDocuments.length > 0 || stepReceiptTotal > 0) ? <div className="build-wizard-type-note">Tasks: {stepTaskCount} file{stepTaskCount === 1 ? '' : 's'} | Total {context.formatCurrency(stepReceiptTotal)}</div> : null}
            </div>

            <label className="build-wizard-notes-field">
              Step Description
              <div className="build-wizard-step-description-display">{step.description || 'No description yet.'}</div>
            </label>

            <BuildWizardStepActionPanel addableStepContacts={addableStepContactOptions} attachExistingDocByStepId={context.attachExistingDocByStepId ?? {}} attachExistingDocFilterByStepId={safeAttachExistingDocFilterByStepId} attachExistingPickerOpenByStepId={context.attachExistingPickerOpenByStepId ?? {}} attachableProjectDocuments={attachableProjectDocuments} contactTypeLabel={contactTypeLabel} draft={draft} effectiveStepContactCandidateId={effectiveStepContactCandidateId} filteredAttachableProjectDocuments={filteredAttachableProjectDocuments} linkedStepDisplayNumberById={linkedStepDisplayNumberById} normalizeContactType={normalizeContactType} noteDraftByStep={noteDraftByStep ?? {}} noteEditorOpenByStep={noteEditorOpenByStep ?? {}} onAddContactToStep={onAddContactToStep} onAttachExistingDocumentToStep={onAttachExistingDocumentToStep} onSubmitNote={onSubmitNote} setAttachExistingDocByStepId={setAttachExistingDocByStepId} setAttachExistingDocFilterByStepId={setAttachExistingDocFilterByStepId} setAttachExistingPickerOpenByStepId={setAttachExistingPickerOpenByStepId} setEditingReceiptDocumentIdByStep={setEditingReceiptDocumentIdByStep} setNoteDraftByStep={setNoteDraftByStep} setNoteEditorOpenByStep={setNoteEditorOpenByStep} setReceiptEditorOpenByStep={setReceiptEditorOpenByStep} setStepContactCandidateByStepId={setStepContactCandidateByStepId} setStepContactPickerOpenByStepId={setStepContactPickerOpenByStepId} step={step} stepById={stepById} stepContactPickerOpenByStepId={stepContactPickerOpenByStepId ?? {}} stepReadOnly={stepReadOnly} uploadDocument={uploadDocument} />
          </fieldset>

          <BuildWizardStepAssignees allStepAssignees={allStepAssignees} contactTypeChipClass={contactTypeChipClass} hasAssigneeFilters={false} normalizeContactType={normalizeContactType} open={allStepAssignees.length > 0} stepId={step.id} visibleStepAssignees={allStepAssignees} />

          {(stepReceiptDocuments.length > 0 || receiptEditorOpen) ? (
            <div className="build-wizard-step-receipts">
              <div className="build-wizard-step-receipts-head">
                <div className="build-wizard-step-assignees-label">Tasks</div>
                <div className="build-wizard-step-receipts-summary">{stepReceiptDocuments.length} file{stepReceiptDocuments.length === 1 ? '' : 's'} | {context.formatCurrency(stepReceiptTotal)}</div>
              </div>
              <BuildWizardStepReceiptEditor authorityContacts={authorityContacts} autosaveExistingReceiptDraftForStep={autosaveExistingReceiptDraftForStep} editingReceiptDocumentIdByStep={editingReceiptDocumentIdByStep ?? {}} onSaveReceiptForStep={onSaveReceiptForStep} open={receiptEditorOpen} permitDocuments={permitDocuments} permitStatusOptions={permitStatusOptions} purchaseUnitOptions={purchaseUnitOptions} receiptDraft={receiptDraft} receiptDraftByStep={safeReceiptDraftByStep} receiptEditorRefByStepId={receiptEditorRefByStepId} setEditingReceiptDocumentIdByStep={setEditingReceiptDocumentIdByStep} setReceiptAttachmentDraftByStep={setReceiptAttachmentDraftByStep} setReceiptDraftByStep={setReceiptDraftByStep} setReceiptEditorOpenByStep={setReceiptEditorOpenByStep} step={step} taskTypeOptions={taskTypeOptions} />
              <BuildWizardStepReceiptsList deletingDocumentId={deletingDocumentId} formatCurrency={context.formatCurrency} getTaskEffectiveDate={getTaskEffectiveDate} inlineEditingReceiptFieldByDocId={inlineEditingReceiptFieldByDocId ?? {}} inlineReceiptDraftByDocId={inlineReceiptDraftByDocId ?? {}} onDeleteDocument={onDeleteDocument} onOpenDocumentPreview={onOpenDocumentPreview} onStartEditReceiptForStep={onStartEditReceiptForStep} openMoveTaskModal={openMoveTaskModal} openTaskAttachmentsModal={openTaskAttachmentsModal} parseTaskMetaFromReceiptNotes={parseTaskMetaFromReceiptNotes} receiptRowRefByDocId={receiptRowRefByDocId} saveInlineReceiptEdit={saveInlineReceiptEdit} setInlineReceiptDraftByDocId={setInlineReceiptDraftByDocId} startInlineReceiptEdit={startInlineReceiptEdit} step={step} stepReadOnly={stepReadOnly} stepReceiptAttachmentDocuments={stepReceiptAttachmentDocuments} stepReceiptDocuments={stepReceiptDocuments} taskTypeOptions={taskTypeOptions} taskUsesManualDateOverride={taskUsesManualDateOverride} taskVendorOptions={taskVendorOptions} />
            </div>
          ) : null}

          {stepNonReceiptDocuments.length > 0 ? <div className="build-wizard-step-media">{renderDocumentGallery(stepNonReceiptDocuments, '', stepReadOnly)}</div> : null}

          <BuildWizardStepNotes deletingNoteId={deletingNoteId} editingNoteTextById={editingNoteTextById ?? {}} formatDate={formatDate} noteEditedAtLabel={noteEditedAtLabel} onCancelEditNote={onCancelEditNote} onDeleteStepNoteById={onDeleteStepNoteById} onSaveEditedNote={onSaveEditedNote} onStartEditNote={onStartEditNote} open={Array.isArray(step.notes) && step.notes.length > 0} savingNoteId={savingNoteId} setEditingNoteTextById={setEditingNoteTextById} step={step} stepReadOnly={stepReadOnly} />
        </>
      ) : null}
    </div>
  );
}
