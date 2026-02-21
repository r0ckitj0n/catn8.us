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
  IBuildWizardPurchaseOption,
  IBuildWizardProject,
  IBuildWizardProjectSummary,
  IBuildWizardQuestionnaire,
  IBuildWizardSingletreeRecoverResponse,
  IBuildWizardSingletreeStageUploadResponse,
  IBuildWizardStep,
} from '../../types/buildWizard';
import {
  normalizeBuildWizardStep,
  normalizeBuildWizardSteps,
  sanitizeBuildWizardStepTitle,
} from './buildWizardSanitizers';

type BuildWizardPayloadResponse = {
  success: boolean;
  prompt_text: string;
  payload: Record<string, unknown>;
};

type BuildWizardAiGenerateResponse = {
  success: boolean;
  provider: string;
  model: string;
  mode?: 'optimize' | 'fill_missing' | 'complete';
  parsed_step_count: number;
  inserted_count: number;
  updated_count: number;
  missing_fields?: string[];
  steps: IBuildWizardStep[];
};

type CreateProjectResponse = {
  success: boolean;
  project_id: number;
};

type UpdateProjectResponse = {
  success: boolean;
  project: IBuildWizardProject;
};

type AddStepResponse = {
  success: boolean;
  step: IBuildWizardStep;
};

type DeleteStepResponse = {
  success: boolean;
  deleted_step_id: number;
  steps: IBuildWizardStep[];
};

type ReorderStepsResponse = {
  success: boolean;
  steps: IBuildWizardStep[];
};

type DeleteDocumentResponse = {
  success: boolean;
  deleted_document_id: number;
  documents: IBuildWizardDocument[];
};

type DeleteProjectResponse = {
  success: boolean;
  deleted_project_id: number;
  selected_project_id: number | null;
  projects: IBuildWizardProjectSummary[];
};

type UpdateDocumentResponse = {
  success: boolean;
  document: IBuildWizardDocument;
};

type ReplaceDocumentResponse = {
  success: boolean;
  document: IBuildWizardDocument;
};

type SaveContactResponse = {
  success: boolean;
  contact: IBuildWizardContact;
};

type DeleteContactResponse = {
  success: boolean;
  deleted_contact_id: number;
};

type AddContactAssignmentResponse = {
  success: boolean;
  assignment: IBuildWizardContactAssignment;
};

type DeleteContactAssignmentResponse = {
  success: boolean;
  deleted_assignment_id: number;
};

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function useBuildWizardInternal(onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void) {
  const [loading, setLoading] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [aiBusy, setAiBusy] = React.useState<boolean>(false);
  const [recoveryBusy, setRecoveryBusy] = React.useState<boolean>(false);
  const [projectId, setProjectId] = React.useState<number>(0);
  const [projects, setProjects] = React.useState<IBuildWizardProjectSummary[]>([]);
  const [project, setProject] = React.useState<IBuildWizardProject | null>(null);
  const [questions, setQuestions] = React.useState<string[]>([]);
  const [questionnaire, setQuestionnaire] = React.useState<IBuildWizardQuestionnaire>({
    title: '',
    status: 'planning',
    square_feet: null,
    home_style: '',
    home_type: '',
    room_count: null,
    bedrooms_count: null,
    kitchens_count: null,
    bathroom_count: null,
    stories_count: null,
    lot_size_sqft: null,
    garage_spaces: null,
    parking_spaces: null,
    year_built: null,
    hoa_fee_monthly: null,
    lot_address: '',
    target_start_date: null,
    target_completion_date: null,
    wizard_notes: '',
  });
  const [steps, setSteps] = React.useState<IBuildWizardStep[]>([]);
  const [documents, setDocuments] = React.useState<IBuildWizardDocument[]>([]);
  const [contacts, setContacts] = React.useState<IBuildWizardContact[]>([]);
  const [contactAssignments, setContactAssignments] = React.useState<IBuildWizardContactAssignment[]>([]);
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

  const openProject = React.useCallback(async (nextProjectId: number) => {
    if (nextProjectId <= 0) {
      return;
    }
    await load(nextProjectId);
  }, [load]);

  const createProject = React.useCallback(async (title: string, seedMode: 'blank' | 'spreadsheet' = 'blank') => {
    try {
      const res = await ApiClient.post<CreateProjectResponse>('/api/build_wizard.php?action=create_project', {
        title,
        seed_mode: seedMode,
      });
      const nextId = Number(res?.project_id || 0);
      if (nextId > 0) {
        await load(nextId);
      }
      onToast?.({ tone: 'success', message: 'New build created.' });
      return nextId;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to create build' });
      return 0;
    }
  }, [load, onToast]);

  const saveQuestionnaire = React.useCallback(async () => {
    if (projectId <= 0) {
      return;
    }
    setSaving(true);
    try {
      const res = await ApiClient.post<UpdateProjectResponse>('/api/build_wizard.php?action=save_project', {
        project_id: projectId,
        ...questionnaire,
      });
      if (res?.project) {
        setProject(res.project);
      }
      onToast?.({ tone: 'success', message: 'Build profile saved.' });
      await refreshCurrentProject();
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to save profile' });
    } finally {
      setSaving(false);
    }
  }, [projectId, questionnaire, onToast, refreshCurrentProject]);

  const updateProject = React.useCallback(async (patch: Partial<IBuildWizardQuestionnaire & IBuildWizardProject>) => {
    if (projectId <= 0) {
      return;
    }
    setSaving(true);
    const nextQuestionnaire = {
      ...questionnaire,
      ...patch,
    };

    setQuestionnaire(nextQuestionnaire);

    try {
      const res = await ApiClient.post<UpdateProjectResponse>('/api/build_wizard.php?action=save_project', {
        project_id: projectId,
        ...nextQuestionnaire,
      });
      if (res?.project) {
        setProject(res.project);
      }
      await refreshCurrentProject();
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to update project field' });
      await refreshCurrentProject();
    } finally {
      setSaving(false);
    }
  }, [projectId, questionnaire, onToast, refreshCurrentProject]);

  const updateStep = React.useCallback(async (stepId: number, patch: Partial<IBuildWizardStep>) => {
    if (stepId <= 0) {
      return;
    }
    const body: Record<string, unknown> = { step_id: stepId };
    const acceptedFields = [
      'phase_key',
      'parent_step_id',
      'step_type',
      'title',
      'description',
      'permit_required',
      'permit_document_id',
      'permit_name',
      'permit_authority',
      'permit_status',
      'permit_application_url',
      'purchase_category',
      'purchase_brand',
      'purchase_model',
      'purchase_sku',
      'purchase_unit',
      'purchase_qty',
      'purchase_unit_price',
      'purchase_vendor',
      'purchase_url',
      'expected_start_date',
      'expected_end_date',
      'expected_duration_days',
      'estimated_cost',
      'actual_cost',
      'is_completed',
      'source_ref',
      'depends_on_step_ids',
      'ai_estimated_fields',
    ] as const;

    acceptedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(patch, field)) {
        body[field] = (patch as any)[field];
      }
    });

    if (Object.keys(body).length <= 1) {
      return;
    }

    try {
      const res = await ApiClient.post<{ success: boolean; step: IBuildWizardStep; steps?: IBuildWizardStep[] }>('/api/build_wizard.php?action=update_step', body);
      if (Array.isArray(res?.steps)) {
        setSteps(normalizeBuildWizardSteps(res.steps));
      } else {
        const next = res?.step ? normalizeBuildWizardStep(res.step) : null;
        setSteps((prev) => prev.map((s) => (s.id === stepId ? (next || s) : s)));
      }
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to update step' });
      await refreshCurrentProject();
    }
  }, [onToast, refreshCurrentProject]);

  const toggleStep = React.useCallback(async (step: IBuildWizardStep, checked: boolean) => {
    await updateStep(step.id, { is_completed: checked ? 1 : 0 });
  }, [updateStep]);

  const addStepNote = React.useCallback(async (stepId: number, noteText: string) => {
    const t = String(noteText || '').trim();
    if (!t) {
      return;
    }
    try {
      const res = await ApiClient.post<{ success: boolean; step: IBuildWizardStep }>('/api/build_wizard.php?action=add_step_note', {
        step_id: stepId,
        note_text: t,
      });
      const next = res?.step ? normalizeBuildWizardStep(res.step) : null;
      setSteps((prev) => prev.map((s) => (s.id === stepId ? (next || s) : s)));
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to add note' });
    }
  }, [onToast]);

  const addStep = React.useCallback(async (phaseKey: string) => {
    if (projectId <= 0) {
      return;
    }
    try {
      const res = await ApiClient.post<AddStepResponse>('/api/build_wizard.php?action=add_step', {
        project_id: projectId,
        phase_key: phaseKey,
      });
      if (res?.step) {
        const nextStep = normalizeBuildWizardStep(res.step);
        setSteps((prev) => {
          const next = [...prev, nextStep];
          next.sort((a, b) => {
            if (a.step_order !== b.step_order) {
              return a.step_order - b.step_order;
            }
            return a.id - b.id;
          });
          return next;
        });
      } else {
        await refreshCurrentProject();
      }
      onToast?.({ tone: 'success', message: 'Step added.' });
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to add step' });
    }
  }, [projectId, onToast, refreshCurrentProject]);

  const deleteStep = React.useCallback(async (stepId: number) => {
    if (stepId <= 0) {
      return;
    }
    try {
      const res = await ApiClient.post<DeleteStepResponse>('/api/build_wizard.php?action=delete_step', {
        step_id: stepId,
      });
      if (Array.isArray(res?.steps)) {
        setSteps(normalizeBuildWizardSteps(res.steps));
      } else {
        setSteps((prev) => prev.filter((s) => s.id !== stepId));
      }
      onToast?.({ tone: 'success', message: 'Step deleted.' });
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to delete step' });
      await refreshCurrentProject();
    }
  }, [onToast, refreshCurrentProject]);

  const reorderSteps = React.useCallback(async (phaseKey: string, orderedStepIds: number[]) => {
    if (projectId <= 0 || !Array.isArray(orderedStepIds) || orderedStepIds.length === 0) {
      return false;
    }
    try {
      const res = await ApiClient.post<ReorderStepsResponse>('/api/build_wizard.php?action=reorder_steps', {
        project_id: projectId,
        phase_key: phaseKey,
        ordered_step_ids: orderedStepIds,
      });
      if (Array.isArray(res?.steps)) {
        setSteps(normalizeBuildWizardSteps(res.steps));
      } else {
        await refreshCurrentProject();
      }
      return true;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to reorder steps' });
      await refreshCurrentProject();
      return false;
    }
  }, [onToast, projectId, refreshCurrentProject]);

  const deleteProject = React.useCallback(async (targetProjectId: number) => {
    if (targetProjectId <= 0) {
      return false;
    }
    try {
      const res = await ApiClient.post<DeleteProjectResponse>('/api/build_wizard.php?action=delete_project', {
        project_id: targetProjectId,
      });
      const deletedProjectId = Number(res?.deleted_project_id || 0);
      const nextProjects = Array.isArray(res?.projects) ? res.projects : [];
      setProjects(nextProjects);

      const deletedCurrent = deletedProjectId > 0 && deletedProjectId === projectId;
      if (!deletedCurrent) {
        onToast?.({ tone: 'success', message: 'Project deleted.' });
        return true;
      }

      const fallbackProjectId = Number(res?.selected_project_id || 0);
      if (fallbackProjectId > 0) {
        await load(fallbackProjectId);
      } else {
        setProjectId(0);
        setProject(null);
        setQuestionnaire({
          title: '',
          status: 'planning',
          square_feet: null,
          home_style: '',
          home_type: '',
          room_count: null,
          bedrooms_count: null,
          kitchens_count: null,
          bathroom_count: null,
          stories_count: null,
          lot_size_sqft: null,
          garage_spaces: null,
          parking_spaces: null,
          year_built: null,
          hoa_fee_monthly: null,
          lot_address: '',
          target_start_date: null,
          target_completion_date: null,
          wizard_notes: '',
        });
        setSteps([]);
        setDocuments([]);
        setContacts([]);
        setContactAssignments([]);
        setAiPromptText('');
        setAiPayloadJson('');
      }
      onToast?.({ tone: 'success', message: 'Project deleted.' });
      return true;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to delete project' });
      await refreshCurrentProject();
      return false;
    }
  }, [load, onToast, projectId, refreshCurrentProject]);

  const uploadDocument = React.useCallback(async (kind: string, file: File, stepId?: number, caption?: string, phaseKey?: string) => {
    if (!file || projectId <= 0) {
      return;
    }
    const formData = new FormData();
    formData.append('project_id', String(projectId));
    formData.append('kind', kind);
    formData.append('file', file);
    if (stepId && stepId > 0) {
      formData.append('step_id', String(stepId));
    }
    if (phaseKey && String(phaseKey).trim() !== '') {
      formData.append('phase_key', String(phaseKey).trim());
    }
    if (caption && String(caption).trim() !== '') {
      formData.append('caption', String(caption).trim());
    }

    try {
      const res = await ApiClient.postFormData<{ success: boolean; document: IBuildWizardDocument }>('/api/build_wizard.php?action=upload_document', formData);
      if (res?.document) {
        setDocuments((prev) => [res.document, ...prev]);
      }
      onToast?.({ tone: 'success', message: 'Document uploaded.' });
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Upload failed' });
    }
  }, [projectId, onToast]);

  const deleteDocument = React.useCallback(async (documentId: number) => {
    if (documentId <= 0) {
      return false;
    }
    try {
      const res = await ApiClient.post<DeleteDocumentResponse>('/api/build_wizard.php?action=delete_document', {
        document_id: documentId,
      });
      if (Array.isArray(res?.documents)) {
        setDocuments(res.documents);
      } else {
        setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      }
      onToast?.({ tone: 'success', message: 'Document deleted.' });
      return true;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to delete document' });
      await refreshCurrentProject();
      return false;
    }
  }, [onToast, refreshCurrentProject]);

  const replaceDocument = React.useCallback(async (documentId: number, file: File) => {
    if (documentId <= 0 || !file) {
      return null;
    }

    const formData = new FormData();
    formData.append('document_id', String(documentId));
    formData.append('file', file);

    try {
      const res = await ApiClient.postFormData<ReplaceDocumentResponse>('/api/build_wizard.php?action=replace_document', formData);
      if (res?.document) {
        setDocuments((prev) => prev.map((doc) => (doc.id === documentId ? res.document : doc)));
      }
      onToast?.({ tone: 'success', message: 'Document file replaced.' });
      return res?.document || null;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to replace document file' });
      await refreshCurrentProject();
      return null;
    }
  }, [onToast, refreshCurrentProject]);

  const updateDocument = React.useCallback(async (
    documentId: number,
    patch: { kind?: string; caption?: string | null; step_id?: number | null },
  ) => {
    if (documentId <= 0) {
      return null;
    }
    const body: Record<string, unknown> = { document_id: documentId };
    if (Object.prototype.hasOwnProperty.call(patch, 'kind')) {
      body.kind = String(patch.kind || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'caption')) {
      body.caption = patch.caption;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'step_id')) {
      body.step_id = patch.step_id;
    }
    if (Object.keys(body).length <= 1) {
      return null;
    }

    try {
      const res = await ApiClient.post<UpdateDocumentResponse>('/api/build_wizard.php?action=update_document', body);
      if (res?.document) {
        setDocuments((prev) => prev.map((doc) => (doc.id === documentId ? res.document : doc)));
      }
      onToast?.({ tone: 'success', message: 'Document updated.' });
      return res?.document || null;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to update document' });
      await refreshCurrentProject();
      return null;
    }
  }, [onToast, refreshCurrentProject]);

  const findPurchaseOptions = React.useCallback(async (stepId: number, productUrl?: string): Promise<{ options: IBuildWizardPurchaseOption[]; step: IBuildWizardStep | null } | null> => {
    if (stepId <= 0) {
      return null;
    }
    try {
      const res = await ApiClient.post<IBuildWizardFindPurchaseOptionsResponse>('/api/build_wizard.php?action=find_purchase_options', {
        step_id: stepId,
        product_url: (productUrl || '').trim() || undefined,
      });
      const nextStep = res?.step ? normalizeBuildWizardStep(res.step) : null;
      if (nextStep) {
        setSteps((prev) => prev.map((s) => (s.id === stepId ? nextStep : s)));
      }
      const nextOptions = Array.isArray(res?.options)
        ? res.options.map((opt) => ({
          ...opt,
          title: sanitizeBuildWizardStepTitle(opt?.title || '', 'purchase'),
        }))
        : [];
      return {
        options: nextOptions,
        step: nextStep,
      };
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to find purchase options' });
      return null;
    }
  }, [onToast]);

  const packageForAi = React.useCallback(async () => {
    if (projectId <= 0) {
      return;
    }
    try {
      const res = await ApiClient.post<BuildWizardPayloadResponse>('/api/build_wizard.php?action=build_ai_payload', {
        project_id: projectId,
      });
      setAiPromptText(String(res?.prompt_text || ''));
      setAiPayloadJson(JSON.stringify(res?.payload || {}, null, 2));
      onToast?.({ tone: 'success', message: 'AI package built. Ready to send to agent.' });
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to build AI payload' });
    }
  }, [projectId, onToast]);

  const generateStepsFromAi = React.useCallback(async (mode: 'optimize' | 'fill_missing' | 'complete' = 'optimize'): Promise<BuildWizardAiGenerateResponse | null> => {
    if (projectId <= 0) {
      return null;
    }
    setAiBusy(true);
    try {
      const res = await ApiClient.post<BuildWizardAiGenerateResponse>('/api/build_wizard.php?action=generate_steps_from_ai', {
        project_id: projectId,
        mode,
      });
      if (Array.isArray(res?.steps)) {
        setSteps(normalizeBuildWizardSteps(res.steps));
      }
      const missingFields = Array.isArray(res?.missing_fields) ? res.missing_fields.length : 0;
      const modeLabel = mode === 'complete' ? 'AI full completion' : (mode === 'fill_missing' ? 'AI missing-field estimate' : 'AI step ingestion');
      onToast?.({
        tone: 'success',
        message: `${modeLabel} complete (${res?.inserted_count || 0} inserted, ${res?.updated_count || 0} updated${missingFields > 0 ? `, ${missingFields} fields still missing` : ''}).`,
      });
      await refreshCurrentProject();
      return res || null;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to run AI step generation' });
      return null;
    } finally {
      setAiBusy(false);
    }
  }, [projectId, onToast, refreshCurrentProject]);

  const backfillDocumentBlobs = React.useCallback(async (apply: boolean, targetProjectId?: number, limit: number = 0) => {
    try {
      const res = await ApiClient.post<IBuildWizardDocumentBlobBackfillResponse>('/api/build_wizard.php?action=backfill_document_blobs', {
        apply: apply ? 1 : 0,
        project_id: (targetProjectId && targetProjectId > 0) ? targetProjectId : undefined,
        limit: Number.isFinite(limit) ? Math.max(0, Math.min(5000, Math.trunc(limit))) : 0,
      });
      const report = res?.report;
      if (!report) {
        throw new Error('Missing backfill report');
      }
      return report;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to backfill Build Wizard file blobs' });
      return null;
    }
  }, [onToast]);

  const hydrateMissingDocumentBlobs = React.useCallback(async (files: File[], targetProjectId?: number) => {
    if (!Array.isArray(files) || files.length === 0) {
      return null;
    }
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files[]', file);
    });
    if (targetProjectId && targetProjectId > 0) {
      formData.append('project_id', String(targetProjectId));
    }
    try {
      const res = await ApiClient.postFormData<IBuildWizardHydrateBlobsResponse>('/api/build_wizard.php?action=hydrate_missing_document_blobs', formData);
      return res || null;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to hydrate missing file blobs' });
      return null;
    }
  }, [onToast]);

  const hydrateMissingDocumentBlobsFromSources = React.useCallback(async (targetProjectId?: number, scanLimit: number = 10000) => {
    try {
      const res = await ApiClient.post<IBuildWizardHydrateFromSourcesResponse>('/api/build_wizard.php?action=hydrate_missing_document_blobs_from_sources', {
        project_id: (targetProjectId && targetProjectId > 0) ? targetProjectId : undefined,
        scan_limit: Number.isFinite(scanLimit) ? Math.max(1, Math.min(25000, Math.trunc(scanLimit))) : 10000,
      });
      return res || null;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to hydrate missing blobs from server sources' });
      return null;
    }
  }, [onToast]);

  const recoverSingletreeDocuments = React.useCallback(async (
    apply: boolean,
    options?: {
      db_env?: 'live' | 'local';
      project_title?: string;
      source_root?: string;
      owner_user_id?: number;
      include_archives?: boolean;
    },
  ) => {
    setRecoveryBusy(true);
    try {
      const queued = await ApiClient.post<IBuildWizardSingletreeRecoverResponse>('/api/build_wizard_recover_singletree.php', {
        apply: apply ? 1 : 0,
        db_env: options?.db_env || 'live',
        project_title: options?.project_title || 'Cabin - 91 Singletree Ln',
        source_root: options?.source_root || '/Users/jongraves/Documents/Home/91 Singletree Ln',
        owner_user_id: options?.owner_user_id && options.owner_user_id > 0 ? options.owner_user_id : undefined,
        include_archives: options?.include_archives ? 1 : 0,
      });

      const jobId = String(queued?.job_id || '').trim();
      if (!jobId) {
        throw new Error('Recovery job did not return a job_id');
      }

      onToast?.({ tone: 'info', message: `${apply ? 'Apply' : 'Dry run'} recovery started...` });
      return queued;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to run Singletree recovery' });
      return null;
    } finally {
      setRecoveryBusy(false);
    }
  }, [onToast]);

  const fetchSingletreeRecoveryStatus = React.useCallback(async (jobId: string) => {
    const cleanJobId = String(jobId || '').trim();
    if (!cleanJobId) {
      return null;
    }
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      const response = await fetch(
        `/api/build_wizard_recover_singletree.php?job_id=${encodeURIComponent(cleanJobId)}`,
        {
          method: 'GET',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        },
      );
      window.clearTimeout(timeout);
      const text = await response.text();
      let res: IBuildWizardSingletreeRecoverResponse | null = null;
      try {
        res = text ? JSON.parse(text) : null;
      } catch (_) {
        res = null;
      }
      if (!response.ok || !res) {
        throw new Error((res as any)?.error || `Status check failed (${response.status})`);
      }

      if (Number(res?.completed || 0) === 1 && res.success) {
        const result = (typeof res?.result === 'object' && res?.result !== null) ? res.result : null;
        const summary = result?.summary;
        if (summary) {
          onToast?.({
            tone: 'success',
            message: `Recovery complete: matched ${summary.matched_existing}, inserted ${summary.inserted_documents}, mapped ${summary.updated_mappings}, blobs ${summary.blob_backfilled}.`,
          });
        } else {
          onToast?.({ tone: 'success', message: 'Recovery complete.' });
        }
        await refreshCurrentProject();
      } else if (Number(res?.completed || 0) === 1 && !res.success) {
        onToast?.({ tone: 'error', message: String(res.error || 'Recovery failed') });
      }

      return res;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to fetch recovery status' });
      return null;
    }
  }, [onToast, refreshCurrentProject]);

  const stageSingletreeSourceFiles = React.useCallback(async (files: File[], uploadToken?: string) => {
    if (!Array.isArray(files) || files.length === 0) {
      return null;
    }
    const formData = new FormData();
    files.forEach((file) => formData.append('files[]', file));
    if (uploadToken && String(uploadToken).trim() !== '') {
      formData.append('upload_token', String(uploadToken).trim());
    }
    try {
      const res = await ApiClient.postFormData<IBuildWizardSingletreeStageUploadResponse>('/api/build_wizard_recover_stage_upload.php', formData);
      if (res?.success) {
        onToast?.({
          tone: 'success',
          message: `Uploaded ${res.files_saved}/${res.files_total} files to server staging.`,
        });
      }
      return res || null;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to upload recovery source files' });
      return null;
    }
  }, [onToast]);

  const searchContent = React.useCallback(async (query: string, limit: number = 20) => {
    if (projectId <= 0) {
      return null;
    }
    const q = String(query || '').trim();
    if (q === '') {
      return { results: [], query: q };
    }
    try {
      const res = await ApiClient.post<IBuildWizardContentSearchResponse>('/api/build_wizard.php?action=search_content', {
        project_id: projectId,
        query: q,
        limit: Number.isFinite(limit) ? Math.max(1, Math.min(50, Math.trunc(limit))) : 20,
      });
      return {
        results: Array.isArray(res?.results) ? res.results : [],
        query: String(res?.query || q),
      };
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to search Build Wizard content' });
      return null;
    }
  }, [onToast, projectId]);

  const saveContact = React.useCallback(async (
    payload: {
      project_id: number;
      contact_id?: number;
      display_name: string;
      contact_type?: 'contact' | 'vendor' | 'authority';
      email?: string | null;
      phone?: string | null;
      company?: string | null;
      role_title?: string | null;
      notes?: string | null;
      is_vendor?: number;
      is_project_only?: number;
      vendor_type?: string | null;
      vendor_license?: string | null;
      vendor_trade?: string | null;
      vendor_website?: string | null;
    },
  ) => {
    if (Number(payload.project_id || 0) <= 0) {
      return null;
    }
    try {
      const res = await ApiClient.post<SaveContactResponse>('/api/build_wizard.php?action=save_contact', payload);
      const next = res?.contact || null;
      if (next) {
        setContacts((prev) => {
          const existingIndex = prev.findIndex((item) => item.id === next.id);
          if (existingIndex >= 0) {
            const merged = [...prev];
            merged[existingIndex] = next;
            return merged;
          }
          return [...prev, next];
        });
      }
      onToast?.({ tone: 'success', message: 'Contact saved.' });
      return next;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to save contact' });
      return null;
    }
  }, [onToast]);

  const deleteContact = React.useCallback(async (projectIdValue: number, contactId: number) => {
    if (projectIdValue <= 0 || contactId <= 0) {
      return false;
    }
    try {
      await ApiClient.post<DeleteContactResponse>('/api/build_wizard.php?action=delete_contact', {
        project_id: projectIdValue,
        contact_id: contactId,
      });
      setContacts((prev) => prev.filter((contact) => contact.id !== contactId));
      setContactAssignments((prev) => prev.filter((assignment) => assignment.contact_id !== contactId));
      onToast?.({ tone: 'success', message: 'Contact deleted.' });
      return true;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to delete contact' });
      return false;
    }
  }, [onToast]);

  const addContactAssignment = React.useCallback(async (
    payload: {
      project_id: number;
      contact_id: number;
      step_id?: number | null;
      phase_key?: string | null;
    },
  ) => {
    if (Number(payload.project_id || 0) <= 0 || Number(payload.contact_id || 0) <= 0) {
      return null;
    }
    try {
      const res = await ApiClient.post<AddContactAssignmentResponse>('/api/build_wizard.php?action=add_contact_assignment', payload);
      const next = res?.assignment || null;
      if (next) {
        setContactAssignments((prev) => {
          const exists = prev.some((assignment) => assignment.id === next.id);
          if (exists) {
            return prev.map((assignment) => (assignment.id === next.id ? next : assignment));
          }
          return [...prev, next];
        });
      }
      onToast?.({ tone: 'success', message: 'Assignment added.' });
      return next;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to add assignment' });
      return null;
    }
  }, [onToast]);

  const deleteContactAssignment = React.useCallback(async (projectIdValue: number, assignmentId: number) => {
    if (projectIdValue <= 0 || assignmentId <= 0) {
      return false;
    }
    try {
      await ApiClient.post<DeleteContactAssignmentResponse>('/api/build_wizard.php?action=delete_contact_assignment', {
        project_id: projectIdValue,
        assignment_id: assignmentId,
      });
      setContactAssignments((prev) => prev.filter((assignment) => assignment.id !== assignmentId));
      onToast?.({ tone: 'success', message: 'Assignment removed.' });
      return true;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to remove assignment' });
      return false;
    }
  }, [onToast]);

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
    aiPromptText,
    aiPayloadJson,
    openProject,
    createProject,
    saveQuestionnaire,
    updateProject,
    updateStep,
    toggleStep,
    addStep,
    reorderSteps,
    deleteStep,
    deleteProject,
    addStepNote,
    uploadDocument,
    replaceDocument,
    deleteDocument,
    updateDocument,
    findPurchaseOptions,
    packageForAi,
    generateStepsFromAi,
    backfillDocumentBlobs,
    hydrateMissingDocumentBlobs,
    hydrateMissingDocumentBlobsFromSources,
    recoverSingletreeDocuments,
    fetchSingletreeRecoveryStatus,
    stageSingletreeSourceFiles,
    searchContent,
    saveContact,
    deleteContact,
    addContactAssignment,
    deleteContactAssignment,
  };
}
