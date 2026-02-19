import React from 'react';
import { ApiClient } from '../core/ApiClient';
import {
  IBuildWizardBootstrapResponse,
  IBuildWizardDocument,
  IBuildWizardProject,
  IBuildWizardProjectSummary,
  IBuildWizardQuestionnaire,
  IBuildWizardStep,
} from '../types/buildWizard';

type BuildWizardPayloadResponse = {
  success: boolean;
  prompt_text: string;
  payload: Record<string, unknown>;
};

type BuildWizardAiGenerateResponse = {
  success: boolean;
  provider: string;
  model: string;
  parsed_step_count: number;
  inserted_count: number;
  updated_count: number;
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

export function useBuildWizard(onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void) {
  const [loading, setLoading] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [aiBusy, setAiBusy] = React.useState<boolean>(false);
  const [projectId, setProjectId] = React.useState<number>(0);
  const [projects, setProjects] = React.useState<IBuildWizardProjectSummary[]>([]);
  const [project, setProject] = React.useState<IBuildWizardProject | null>(null);
  const [questions, setQuestions] = React.useState<string[]>([]);
  const [questionnaire, setQuestionnaire] = React.useState<IBuildWizardQuestionnaire>({
    title: '',
    status: 'planning',
    square_feet: null,
    home_style: '',
    room_count: null,
    bathroom_count: null,
    stories_count: null,
    lot_address: '',
    target_start_date: null,
    target_completion_date: null,
    wizard_notes: '',
  });
  const [steps, setSteps] = React.useState<IBuildWizardStep[]>([]);
  const [documents, setDocuments] = React.useState<IBuildWizardDocument[]>([]);
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
        square_feet: res?.project?.square_feet ?? null,
        home_style: String(res?.project?.home_style || ''),
        room_count: res?.project?.room_count ?? null,
        bathroom_count: res?.project?.bathroom_count ?? null,
        stories_count: res?.project?.stories_count ?? null,
        lot_address: String(res?.project?.lot_address || ''),
        target_start_date: res?.project?.target_start_date || null,
        target_completion_date: res?.project?.target_completion_date || null,
        wizard_notes: String(res?.project?.wizard_notes || ''),
      });
      setSteps(Array.isArray(res?.steps) ? res.steps : []);
      setDocuments(Array.isArray(res?.documents) ? res.documents : []);
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

  const updateProject = React.useCallback(async (patch: Partial<IBuildWizardQuestionnaire>) => {
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
      'title',
      'description',
      'permit_required',
      'permit_name',
      'expected_start_date',
      'expected_end_date',
      'expected_duration_days',
      'estimated_cost',
      'actual_cost',
      'is_completed',
      'source_ref',
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
      const res = await ApiClient.post<{ success: boolean; step: IBuildWizardStep }>('/api/build_wizard.php?action=update_step', body);
      const next = res?.step;
      setSteps((prev) => prev.map((s) => (s.id === stepId ? (next || s) : s)));
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
      const next = res?.step;
      setSteps((prev) => prev.map((s) => (s.id === stepId ? (next || s) : s)));
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to add note' });
    }
  }, [onToast]);

  const uploadDocument = React.useCallback(async (kind: string, file: File) => {
    if (!file || projectId <= 0) {
      return;
    }
    const formData = new FormData();
    formData.append('project_id', String(projectId));
    formData.append('kind', kind);
    formData.append('file', file);

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

  const generateStepsFromAi = React.useCallback(async () => {
    if (projectId <= 0) {
      return;
    }
    setAiBusy(true);
    try {
      const res = await ApiClient.post<BuildWizardAiGenerateResponse>('/api/build_wizard.php?action=generate_steps_from_ai', {
        project_id: projectId,
      });
      if (Array.isArray(res?.steps)) {
        setSteps(res.steps);
      }
      onToast?.({
        tone: 'success',
        message: `AI step ingestion complete (${res?.inserted_count || 0} inserted, ${res?.updated_count || 0} updated).`,
      });
      await refreshCurrentProject();
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to generate steps from AI' });
    } finally {
      setAiBusy(false);
    }
  }, [projectId, onToast, refreshCurrentProject]);

  return {
    loading,
    saving,
    aiBusy,
    projectId,
    projects,
    project,
    questions,
    questionnaire,
    setQuestionnaire,
    steps,
    documents,
    aiPromptText,
    aiPayloadJson,
    openProject,
    createProject,
    saveQuestionnaire,
    updateProject,
    updateStep,
    toggleStep,
    addStepNote,
    uploadDocument,
    packageForAi,
    generateStepsFromAi,
  };
}
