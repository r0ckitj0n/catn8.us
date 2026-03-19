import React from 'react';

export function useBuildWizardWorkspaceCleanupEffects(options: any) {
  const {
    documents,
    moveTaskModalDocId,
    setAttachExistingDocFilterByReceiptId,
    setAttachExistingDocFilterByStepId,
    setAttachExistingPickerOpenByStepId,
    setDependencyCandidateByStepId,
    setExpandedStepById,
    setMoveTaskModalDocId,
    setMoveTaskModalTargetStepId,
    setReceiptAttachmentDraftByStep,
    setReceiptDraftByStep,
    setReceiptEditorOpenByStep,
    setStepDrafts,
    setStepInfoModalStepId,
    setTaskAttachmentsModalDocId,
    stepEditModalStepId,
    stepInfoModalStepId,
    steps,
    taskAttachmentsModalDocId,
  } = options;

  React.useEffect(() => {
    setStepDrafts((prev: any) => {
      const next = { ...prev };
      const validIds = new Set<number>();
      steps.forEach((step: any) => {
        validIds.add(step.id);
        if (step.id === stepEditModalStepId && Object.prototype.hasOwnProperty.call(next, step.id)) {
          return;
        }
        if (!Object.prototype.hasOwnProperty.call(next, step.id)) {
          next[step.id] = { ...step };
          return;
        }
        next[step.id] = { ...step };
      });
      Object.keys(next).forEach((idText) => {
        const id = Number(idText);
        if (!validIds.has(id)) {
          delete next[id];
        }
      });
      return next;
    });
  }, [setStepDrafts, stepEditModalStepId, steps]);

  React.useEffect(() => {
    const validIds = new Set(steps.map((step: any) => step.id));
    setDependencyCandidateByStepId((prev: any) => {
      const next: typeof prev = {};
      Object.keys(prev).forEach((idText) => {
        const stepId = Number(idText);
        if (validIds.has(stepId)) {
          next[stepId] = prev[stepId];
        }
      });
      return next;
    });
    setAttachExistingDocFilterByStepId((prev: any) => {
      const next: typeof prev = {};
      Object.keys(prev).forEach((idText) => {
        const stepId = Number(idText);
        if (validIds.has(stepId)) {
          next[stepId] = prev[stepId];
        }
      });
      return next;
    });
    setAttachExistingPickerOpenByStepId((prev: any) => {
      const next: typeof prev = {};
      Object.keys(prev).forEach((idText) => {
        const stepId = Number(idText);
        if (validIds.has(stepId) && prev[stepId]) {
          next[stepId] = true;
        }
      });
      return next;
    });
    setReceiptEditorOpenByStep((prev: any) => {
      const next: typeof prev = {};
      Object.keys(prev).forEach((idText) => {
        const stepId = Number(idText);
        if (validIds.has(stepId) && prev[stepId]) {
          next[stepId] = true;
        }
      });
      return next;
    });
    setReceiptDraftByStep((prev: any) => {
      const next: typeof prev = {};
      Object.keys(prev).forEach((idText) => {
        const stepId = Number(idText);
        if (validIds.has(stepId)) {
          next[stepId] = prev[stepId];
        }
      });
      return next;
    });
    setReceiptAttachmentDraftByStep((prev: any) => {
      const next: typeof prev = {};
      Object.keys(prev).forEach((idText) => {
        const stepId = Number(idText);
        if (validIds.has(stepId)) {
          next[stepId] = prev[stepId];
        }
      });
      return next;
    });
  }, [
    setAttachExistingDocFilterByStepId,
    setAttachExistingPickerOpenByStepId,
    setDependencyCandidateByStepId,
    setReceiptAttachmentDraftByStep,
    setReceiptDraftByStep,
    setReceiptEditorOpenByStep,
    steps,
  ]);

  React.useEffect(() => {
    setExpandedStepById((prev: Record<number, boolean>) => {
      const next: Record<number, boolean> = {};
      const validIds = new Set(steps.map((step: any) => step.id));
      Object.keys(prev).forEach((idText) => {
        const id = Number(idText);
        if (validIds.has(id) && prev[id]) {
          next[id] = true;
        }
      });
      return next;
    });
    if (stepInfoModalStepId > 0 && !steps.some((step: any) => step.id === stepInfoModalStepId)) {
      setStepInfoModalStepId(0);
    }
  }, [setExpandedStepById, setStepInfoModalStepId, stepInfoModalStepId, steps]);

  React.useEffect(() => {
    const validDocumentIds = new Set<number>(documents.map((doc: any) => doc.id));
    setAttachExistingDocFilterByReceiptId((prev: any) => {
      const next: typeof prev = {};
      Object.keys(prev).forEach((idText) => {
        const documentId = Number(idText);
        if (validDocumentIds.has(documentId)) {
          next[documentId] = prev[documentId];
        }
      });
      return next;
    });
    if (moveTaskModalDocId > 0 && !validDocumentIds.has(moveTaskModalDocId)) {
      setMoveTaskModalDocId(0);
      setMoveTaskModalTargetStepId(0);
    }
    if (taskAttachmentsModalDocId > 0 && !validDocumentIds.has(taskAttachmentsModalDocId)) {
      setTaskAttachmentsModalDocId(0);
    }
  }, [
    documents,
    moveTaskModalDocId,
    setAttachExistingDocFilterByReceiptId,
    setMoveTaskModalDocId,
    setMoveTaskModalTargetStepId,
    setTaskAttachmentsModalDocId,
    taskAttachmentsModalDocId,
  ]);
}
