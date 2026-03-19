import React from 'react';

import { useBuildWizard } from '../../hooks/useBuildWizard';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { BuildWizardWorkspaceMain } from './buildWizardWorkspaceMain';
import { BuildWizardWorkspaceModals } from './buildWizardWorkspaceModals';
import { useBuildWizardPageActionData } from './useBuildWizardPageActionData';
import { useBuildWizardPageRenderSetup } from './useBuildWizardPageRenderSetup';
import { useBuildWizardPageState } from './useBuildWizardPageState';
import { useBuildWizardPageWorkspaceData } from './useBuildWizardPageWorkspaceData';
import { allowedTaskTypes, LIGHTBOX_ZOOM_STEP, LIGHTBOX_ZOOM_STEP_FAST, TASK_META_FIELD_LABELS } from './buildWizardPageRenderConstants';
import { clampLightboxZoom } from './buildWizardPageRenderConstants';
import { formatCurrency, formatDate, formatTimelineDate, lotSizeSqftToDisplayInput, stepPhaseBucket, toNumberOrNull, toStringOrNull } from '../../components/pages/build-wizard/buildWizardUtils';
import { BUILD_TABS, PHASE_PROGRESS_ORDER, isAiEstimatedField } from '../../components/pages/build-wizard/buildWizardConstants';
import { getTaskEffectiveDate, isLegacyAutoStampedTaskDate, parseTaskDocumentPreview as parseTaskDocumentPreviewBase, parseTaskMetaFromReceiptNotes as parseTaskMetaFromReceiptNotesBase, setTaskDateOverrideInReceiptNotes as setTaskDateOverrideInReceiptNotesBase, taskUsesManualDateOverride } from './buildWizardTaskMetaUtils';
import { contactTypeChipClass, contactTypeLabel, normalizeContactType, TaskDocumentPreview } from './buildWizardPageRenderTypes';
import '../../components/pages/BuildWizardPage.css';

interface BuildWizardPageProps extends AppShellPageProps {
  isAdmin?: boolean;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}

const parseTaskMetaFromReceiptNotes = (notes: string | null | undefined) => parseTaskMetaFromReceiptNotesBase(notes, allowedTaskTypes);
const setTaskDateOverrideInReceiptNotes = (notes: string | null | undefined, taskDate: string | null | undefined) => setTaskDateOverrideInReceiptNotesBase(notes, taskDate, allowedTaskTypes);
const parseTaskDocumentPreview = (text: string): TaskDocumentPreview | null => parseTaskDocumentPreviewBase(text, TASK_META_FIELD_LABELS);

export function renderBuildWizardPage({ onToast, isAdmin }: BuildWizardPageProps) {
  const buildWizard = useBuildWizard(onToast);
  const state = useBuildWizardPageState(buildWizard.questionnaire);
  const workspace = useBuildWizardPageWorkspaceData({
    BUILD_TABS,
    PHASE_PROGRESS_ORDER,
    buildWizard,
    isAiEstimatedField,
    lotSizeSqftToDisplayInput,
    normalizeContactType,
    onToast,
    parseTaskDocumentPreview,
    parseTaskMetaFromReceiptNotes,
    state,
    stepPhaseBucket,
    taskUsesManualDateOverride,
  });
  const actions = useBuildWizardPageActionData({
    LIGHTBOX_ZOOM_STEP,
    LIGHTBOX_ZOOM_STEP_FAST,
    buildWizard,
    clampLightboxZoom,
    formatDate,
    isAdmin,
    isLegacyAutoStampedTaskDate,
    onToast,
    parseTaskMetaFromReceiptNotes,
    setTaskDateOverrideInReceiptNotes,
    state,
    stepPhaseBucket,
    toStringOrNull,
    workspace,
  });
  const { buildWorkspaceProps, workspaceModalProps } = useBuildWizardPageRenderSetup({
    actions,
    buildWizard,
    contactTypeChipClass,
    contactTypeLabel,
    formatCurrency,
    formatDate,
    formatTimelineDate,
    getTaskEffectiveDate,
    normalizeContactType,
    onToast,
    parseTaskMetaFromReceiptNotes,
    state,
    stepPhaseBucket,
    taskUsesManualDateOverride,
    toNumberOrNull,
    toStringOrNull,
    workspace,
  });

  if (state.view === 'launcher') {
    return actions.renderers.renderLauncher();
  }
  if (state.view === 'template_editor') {
    return actions.renderers.renderTemplateEditor();
  }
  return (
    <BuildWizardWorkspaceMain {...buildWorkspaceProps}>
      <BuildWizardWorkspaceModals {...workspaceModalProps} />
    </BuildWizardWorkspaceMain>
  );
}
