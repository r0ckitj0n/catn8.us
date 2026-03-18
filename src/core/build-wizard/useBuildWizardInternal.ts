import React from 'react';
import { ApiClient } from '../ApiClient';
import {
  IBuildWizardDocumentBlobBackfillResponse,
  IBuildWizardBootstrapResponse,
  IBuildWizardContentSearchResponse,
  IBuildWizardContact,
  IBuildWizardContactAssignment,
  IBuildWizardDocument,
  IBuildWizardFindPurchaseOptionsResponse,
  IBuildWizardHydrateBlobsResponse,
  IBuildWizardHydrateFromSourcesResponse,
  IBuildWizardPhaseDateRange,
  IBuildWizardPurchaseOption,
  IBuildWizardProject,
  IBuildWizardProjectSummary,
  IBuildWizardQuestionnaire,
  IBuildWizardSingletreeRecoverResponse,
  IBuildWizardSingletreeStageUploadResponse,
  IBuildWizardStep,
} from '../../types/buildWizard';
import { createEmptyBuildWizardQuestionnaire, toNullableNumber } from './buildWizardProjectDefaults';
import {
  normalizeBuildWizardStep,
  normalizeBuildWizardSteps,
  sanitizeBuildWizardStepTitle,
} from './buildWizardSanitizers';
import {
  BuildWizardAiGenerateResponse,
} from './buildWizardInternalTypes';
import { useBuildWizardAiActions } from './useBuildWizardAiActions';
import { useBuildWizardContactActions } from './useBuildWizardContactActions';
import { useBuildWizardProjectActions } from './useBuildWizardProjectActions';
import { useBuildWizardRecoveryActions } from './useBuildWizardRecoveryActions';
import { useBuildWizardStepDocumentActions } from './useBuildWizardStepDocumentActions';

export function useBuildWizardInternal(onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void) {
  const [loading, setLoading] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [aiBusy, setAiBusy] = React.useState<boolean>(false);
  const [recoveryBusy, setRecoveryBusy] = React.useState<boolean>(false);
  const [projectId, setProjectId] = React.useState<number>(0);
  const [projects, setProjects] = React.useState<IBuildWizardProjectSummary[]>([]);
  const [project, setProject] = React.useState<IBuildWizardProject | null>(null);
  const [questions, setQuestions] = React.useState<string[]>([]);
  const [questionnaire, setQuestionnaire] = React.useState<IBuildWizardQuestionnaire>(createEmptyBuildWizardQuestionnaire());
  const [steps, setSteps] = React.useState<IBuildWizardStep[]>([]);
  const [documents, setDocuments] = React.useState<IBuildWizardDocument[]>([]);
  const [contacts, setContacts] = React.useState<IBuildWizardContact[]>([]);
  const [contactAssignments, setContactAssignments] = React.useState<IBuildWizardContactAssignment[]>([]);
  const [phaseDateRanges, setPhaseDateRanges] = React.useState<IBuildWizardPhaseDateRange[]>([]);
  const [aiPromptText, setAiPromptText] = React.useState<string>('');
  const [aiPayloadJson, setAiPayloadJson] = React.useState<string>('');

  const load = React.useCallback(async (requestedProjectId?: number) => {
    setLoading(true);
    try {
      const query = requestedProjectId && requestedProjectId > 0
        ? `?action=bootstrap&project_id=${encodeURIComponent(String(requestedProjectId))}`
        : '?action=bootstrap';
      const res = await ApiClient.get<IBuildWizardBootstrapResponse>(`/api/build_wizard.php${query}`);
      setProjectId(Number(res?.selected_project_id || res?.project?.id || 0));
      setProjects(Array.isArray(res?.projects) ? res.projects : []);
      setProject(res?.project || null);
      setQuestions(Array.isArray(res?.leading_questions) ? res.leading_questions : []);
      setQuestionnaire({
        title: String(res?.project?.title || ''),
        status: String(res?.project?.status || 'planning'),
        square_feet: toNullableNumber(res?.project?.square_feet),
        home_style: String(res?.project?.home_style || ''),
        home_type: String(res?.project?.home_type || ''),
        room_count: toNullableNumber(res?.project?.room_count),
        bedrooms_count: toNullableNumber(res?.project?.bedrooms_count),
        kitchens_count: toNullableNumber(res?.project?.kitchens_count),
        bathroom_count: toNullableNumber(res?.project?.bathroom_count),
        stories_count: toNullableNumber(res?.project?.stories_count),
        lot_size_sqft: toNullableNumber(res?.project?.lot_size_sqft),
        garage_spaces: toNullableNumber(res?.project?.garage_spaces),
        parking_spaces: toNullableNumber(res?.project?.parking_spaces),
        year_built: toNullableNumber(res?.project?.year_built),
        hoa_fee_monthly: toNullableNumber(res?.project?.hoa_fee_monthly),
        lot_address: String(res?.project?.lot_address || ''),
        target_start_date: res?.project?.target_start_date || null,
        target_completion_date: res?.project?.target_completion_date || null,
        wizard_notes: String(res?.project?.wizard_notes || ''),
      });
      setSteps(normalizeBuildWizardSteps(Array.isArray(res?.steps) ? res.steps : []));
      setDocuments(Array.isArray(res?.documents) ? res.documents : []);
      setContacts(Array.isArray(res?.contacts) ? res.contacts : []);
      setContactAssignments(Array.isArray(res?.contact_assignments) ? res.contact_assignments : []);
      setPhaseDateRanges(Array.isArray(res?.phase_date_ranges) ? res.phase_date_ranges : []);
      setAiPromptText(String(res?.project?.ai_prompt_text || ''));
      setAiPayloadJson(String(res?.project?.ai_payload_json || ''));
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to load Build Wizard' });
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const refreshCurrentProject = React.useCallback(async () => {
    if (projectId > 0) {
      await load(projectId);
    } else {
      await load();
    }
  }, [load, projectId]);

  const projectActions = useBuildWizardProjectActions({
    onToast,
    load,
    refreshCurrentProject,
    projectId,
    questionnaire,
    setSaving,
    setProjectId,
    setProjects,
    setProject,
    setQuestionnaire,
    setSteps,
    setDocuments,
    setContacts,
    setContactAssignments,
    setPhaseDateRanges,
    setAiPromptText,
    setAiPayloadJson,
  });
  const stepDocumentActions = useBuildWizardStepDocumentActions({
    onToast,
    projectId,
    refreshCurrentProject,
    setSteps,
    setDocuments,
  });

  const aiActions = useBuildWizardAiActions({
    onToast,
    projectId,
    setAiBusy,
    setAiPromptText,
    setAiPayloadJson,
    setSteps,
    refreshCurrentProject,
  });
  const recoveryActions = useBuildWizardRecoveryActions({
    onToast,
    setRecoveryBusy,
    refreshCurrentProject,
  });
  const contactActions = useBuildWizardContactActions({
    onToast,
    setContacts,
    setContactAssignments,
    setPhaseDateRanges,
  });

  return {
    loading,
    saving,
    aiBusy,
    recoveryBusy,
    projectId,
    projects,
    project,
    questions,
    questionnaire,
    setQuestionnaire,
    steps,
    documents,
    contacts,
    contactAssignments,
    phaseDateRanges,
    aiPromptText,
    aiPayloadJson,
    ...projectActions,
    ...stepDocumentActions,
    ...aiActions,
    ...recoveryActions,
    ...contactActions,
  };
}
