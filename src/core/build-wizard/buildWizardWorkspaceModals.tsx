import React from 'react';

import { BuildWizardAiToolsModal } from './buildWizardAiToolsModal';
import { BuildWizardDocumentUploadModal } from './buildWizardDocumentUploadModal';
import { BuildWizardLightboxModal } from './buildWizardLightboxModal';
import { BuildWizardProjectOverviewModal } from './buildWizardProjectOverviewModal';
import { BuildWizardRecoveryReportModal } from './buildWizardRecoveryReportModal';
import { BuildWizardStepEditModal } from './buildWizardStepEditModal';
import { BuildWizardStepInfoModal } from './buildWizardStepInfoModal';
import { BuildWizardWorkspaceActionModals } from './buildWizardWorkspaceActionModals';

interface BuildWizardWorkspaceModalsProps {
  aiToolsProps: React.ComponentProps<typeof BuildWizardAiToolsModal>;
  documentUploadProps: React.ComponentProps<typeof BuildWizardDocumentUploadModal>;
  lightboxProps: React.ComponentProps<typeof BuildWizardLightboxModal>;
  projectOverviewProps: React.ComponentProps<typeof BuildWizardProjectOverviewModal>;
  recoveryReportProps: React.ComponentProps<typeof BuildWizardRecoveryReportModal>;
  stepEditProps: React.ComponentProps<typeof BuildWizardStepEditModal>;
  stepInfoProps: React.ComponentProps<typeof BuildWizardStepInfoModal>;
  workspaceActionModalProps: React.ComponentProps<typeof BuildWizardWorkspaceActionModals>;
}

export function BuildWizardWorkspaceModals({
  aiToolsProps,
  documentUploadProps,
  lightboxProps,
  projectOverviewProps,
  recoveryReportProps,
  stepEditProps,
  stepInfoProps,
  workspaceActionModalProps,
}: BuildWizardWorkspaceModalsProps) {
  return (
    <>
      <BuildWizardProjectOverviewModal {...projectOverviewProps} />
      <BuildWizardDocumentUploadModal {...documentUploadProps} />
      <BuildWizardAiToolsModal {...aiToolsProps} />
      <BuildWizardStepEditModal {...stepEditProps} />
      <BuildWizardStepInfoModal {...stepInfoProps} />
      <BuildWizardLightboxModal {...lightboxProps} />
      <BuildWizardWorkspaceActionModals {...workspaceActionModalProps} />
      <BuildWizardRecoveryReportModal {...recoveryReportProps} />
    </>
  );
}
