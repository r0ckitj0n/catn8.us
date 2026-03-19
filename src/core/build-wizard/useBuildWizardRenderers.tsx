import React from 'react';

import { IBuildWizardDocument } from '../../types/buildWizard';
import {
  BuildWizardDocumentGallery,
  BuildWizardLauncher,
  BuildWizardProjectPhotosSection,
  BuildWizardTemplateEditor,
} from './buildWizardRenderSections';

export function useBuildWizardRenderers(options: any) {
  const renderDocumentGallery = React.useCallback((items: IBuildWizardDocument[], emptyText: string, readOnly: boolean = false) => (
    <BuildWizardDocumentGallery
      emptyText={emptyText}
      isPlanPreviewDoc={options.isPlanPreviewDoc}
      isSpreadsheetPreviewDoc={options.isSpreadsheetPreviewDoc}
      items={items}
      openDocumentPreview={(doc) => { void options.openDocumentPreview(doc); }}
      onRemoveDocumentFromStep={(id) => options.onRemoveDocumentFromStep(id)}
      readOnly={readOnly}
      unlinkingDocumentId={options.unlinkingDocumentId}
    />
  ), [options]);

  const projectPhotosSection = React.useMemo(() => (
    <BuildWizardProjectPhotosSection
      docKind={options.docKind}
      docKindOptions={options.docKindOptions}
      docPhaseKey={options.docPhaseKey}
      docStepId={options.docStepId}
      phaseOptions={options.phaseOptions}
      primaryBlueprintChoices={options.primaryBlueprintChoices}
      primaryPhotoChoices={options.primaryPhotoChoices}
      project={options.project}
      projectDocuments={options.projectDocuments}
      renderDocumentGallery={renderDocumentGallery}
      selectableDocSteps={options.selectableDocSteps}
      setDocKind={options.setDocKind}
      setDocPhaseKey={options.setDocPhaseKey}
      setDocStepId={options.setDocStepId}
      updateProject={options.updateProject}
      uploadDocument={options.uploadDocument}
    />
  ), [options, renderDocumentGallery]);

  const renderLauncher = React.useCallback(() => (
    <BuildWizardLauncher
      deletingProjectId={options.deletingProjectId}
      launcherProjects={options.launcherProjects}
      newHomeWastewaterKind={options.newHomeWastewaterKind}
      newHomeWaterKind={options.newHomeWaterKind}
      onCloseWizard={options.onCloseWizard}
      onCreateNewBuild={options.onCreateNewBuild}
      onDeleteProject={options.onDeleteProject}
      onOpenTemplateEditor={options.onOpenTemplateEditor}
      openBuild={options.openBuild}
      setNewHomeWastewaterKind={options.setNewHomeWastewaterKind}
      setNewHomeWaterKind={options.setNewHomeWaterKind}
    />
  ), [options]);

  const renderTemplateEditor = React.useCallback(() => (
    <BuildWizardTemplateEditor
      deletingProjectId={options.deletingProjectId}
      formatDate={options.formatDate}
      onBackToLauncher={options.onBackToLauncher}
      onCloseWizard={options.onCloseWizard}
      onCreateTemplate={options.onCreateTemplate}
      onDeleteProject={options.onDeleteProject}
      openBuild={options.openBuild}
      templateProjects={options.templateProjects}
    />
  ), [options]);

  return {
    projectPhotosSection,
    renderDocumentGallery,
    renderLauncher,
    renderTemplateEditor,
  };
}
