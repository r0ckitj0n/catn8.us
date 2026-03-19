import React from 'react';

import { IBuildWizardDocument } from '../../types/buildWizard';
import { BuildTabId } from '../../types/pages/buildWizardPage';
import { BuildWizardSearchResult, LightboxPreview } from './buildWizardPageRenderTypes';

export function useBuildWizardWorkspaceUiCallbacks(options: {
  activeTab: BuildTabId;
  clampLightboxZoom: (value: number) => number;
  deleteProject: (projectId: number) => Promise<unknown>;
  focusStepExpansion: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  lightboxSupportsZoom: boolean;
  lightboxZoomStep: number;
  lightboxZoomStepFast: number;
  onOpenDocumentPreview: (document: IBuildWizardDocument) => Promise<void>;
  requestConfirmation: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    confirmButtonClass?: string;
  }) => Promise<boolean>;
  setActiveTab: React.Dispatch<React.SetStateAction<BuildTabId>>;
  setDeletingProjectId: React.Dispatch<React.SetStateAction<number>>;
  setLightboxZoom: React.Dispatch<React.SetStateAction<number>>;
  setTopbarSearchFocusStepId: React.Dispatch<React.SetStateAction<number>>;
  setTopbarSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const {
    activeTab,
    clampLightboxZoom,
    deleteProject,
    focusStepExpansion,
    lightboxSupportsZoom,
    lightboxZoomStep,
    lightboxZoomStepFast,
    onOpenDocumentPreview,
    requestConfirmation,
    setActiveTab,
    setDeletingProjectId,
    setLightboxZoom,
    setTopbarSearchFocusStepId,
    setTopbarSearchOpen,
  } = options;

  const zoomLightboxBy = React.useCallback((delta: number) => {
    setLightboxZoom((prev) => clampLightboxZoom(prev + delta));
  }, [clampLightboxZoom, setLightboxZoom]);

  const resetLightboxZoom = React.useCallback(() => {
    setLightboxZoom(1);
  }, [setLightboxZoom]);

  const onLightboxWheelZoom = React.useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!lightboxSupportsZoom) {
      return;
    }
    e.preventDefault();
    const direction = e.deltaY < 0 ? 1 : -1;
    const delta = (e.shiftKey ? lightboxZoomStepFast : lightboxZoomStep) * direction;
    setLightboxZoom((prev) => clampLightboxZoom(prev + delta));
  }, [clampLightboxZoom, lightboxSupportsZoom, lightboxZoomStep, lightboxZoomStepFast, setLightboxZoom]);

  const focusStepInBuildView = React.useCallback((phaseId: BuildTabId, stepId: number) => {
    if (stepId <= 0) {
      return;
    }
    setActiveTab(phaseId);
    focusStepExpansion((prev) => ({ ...prev, [stepId]: true }));
    setTopbarSearchFocusStepId(0);
    window.setTimeout(() => setTopbarSearchFocusStepId(stepId), 0);
  }, [focusStepExpansion, setActiveTab, setTopbarSearchFocusStepId]);

  const selectTopbarSearchResult = React.useCallback((result: BuildWizardSearchResult) => {
    setTopbarSearchOpen(false);

    if (result.kind === 'phase') {
      setActiveTab(result.phaseId);
      return;
    }

    if (result.kind === 'step') {
      focusStepInBuildView(result.phaseId, result.stepId);
      return;
    }

    if (result.linkedPhaseId) {
      setActiveTab(result.linkedPhaseId);
    }
    if (result.linkedStepId > 0) {
      focusStepInBuildView(result.linkedPhaseId || activeTab, result.linkedStepId);
      return;
    }
    void onOpenDocumentPreview(result.document);
  }, [activeTab, focusStepInBuildView, onOpenDocumentPreview, setActiveTab, setTopbarSearchOpen]);

  const onDeleteProject = React.useCallback(async (projectSummary: { id: number; title: string }) => {
    if (projectSummary.id <= 0) {
      return;
    }
    const confirmed = await requestConfirmation({
      title: 'Delete Project?',
      message: `Delete "${projectSummary.title}"?\n\nThis will permanently purge this project and all related records from the database.`,
      confirmLabel: 'Delete Project',
      confirmButtonClass: 'btn btn-danger',
    });
    if (!confirmed) {
      return;
    }
    setDeletingProjectId(projectSummary.id);
    try {
      await deleteProject(projectSummary.id);
    } finally {
      setDeletingProjectId(0);
    }
  }, [deleteProject, requestConfirmation, setDeletingProjectId]);

  return {
    focusStepInBuildView,
    onDeleteProject,
    onLightboxWheelZoom,
    resetLightboxZoom,
    selectTopbarSearchResult,
    zoomLightboxBy,
  };
}
