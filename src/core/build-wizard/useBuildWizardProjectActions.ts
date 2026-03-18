import React from 'react';

import { ApiClient } from '../ApiClient';
import {
  IBuildWizardProject,
  IBuildWizardProjectSummary,
  IBuildWizardQuestionnaire,
} from '../../types/buildWizard';
import { createEmptyBuildWizardQuestionnaire } from './buildWizardProjectDefaults';
import {
  BuildWizardToast,
  CreateProjectResponse,
  DeleteProjectResponse,
  UpdateProjectResponse,
} from './buildWizardInternalTypes';

interface UseBuildWizardProjectActionsArgs {
  onToast?: (t: BuildWizardToast) => void;
  load: (requestedProjectId?: number) => Promise<void>;
  refreshCurrentProject: () => Promise<void>;
  projectId: number;
  questionnaire: IBuildWizardQuestionnaire;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setProjectId: React.Dispatch<React.SetStateAction<number>>;
  setProjects: React.Dispatch<React.SetStateAction<IBuildWizardProjectSummary[]>>;
  setProject: React.Dispatch<React.SetStateAction<IBuildWizardProject | null>>;
  setQuestionnaire: React.Dispatch<React.SetStateAction<IBuildWizardQuestionnaire>>;
  setSteps: React.Dispatch<React.SetStateAction<any[]>>;
  setDocuments: React.Dispatch<React.SetStateAction<any[]>>;
  setContacts: React.Dispatch<React.SetStateAction<any[]>>;
  setContactAssignments: React.Dispatch<React.SetStateAction<any[]>>;
  setPhaseDateRanges: React.Dispatch<React.SetStateAction<any[]>>;
  setAiPromptText: React.Dispatch<React.SetStateAction<string>>;
  setAiPayloadJson: React.Dispatch<React.SetStateAction<string>>;
}

export function useBuildWizardProjectActions(args: UseBuildWizardProjectActionsArgs) {
  const {
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
  } = args;

  const openProject = React.useCallback(async (nextProjectId: number) => {
    if (nextProjectId <= 0) return;
    await load(nextProjectId);
  }, [load]);

  const createProject = React.useCallback(async (
    title: string,
    seedMode: 'blank' | 'spreadsheet' = 'blank',
    wastewaterKind: 'septic' | 'public_sewer' = 'septic',
    waterKind: 'county_water' | 'private_well' = 'county_water',
    isTemplate: boolean = false,
  ) => {
    try {
      const res = await ApiClient.post<CreateProjectResponse>('/api/build_wizard.php?action=create_project', {
        title,
        seed_mode: seedMode,
        wastewater_kind: wastewaterKind,
        water_kind: waterKind,
        is_template: isTemplate ? 1 : 0,
      });
      const nextId = Number(res?.project_id || 0);
      if (nextId > 0) {
        await load(nextId);
      }
      onToast?.({ tone: 'success', message: isTemplate ? 'New template created.' : 'New build created.' });
      return nextId;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || (isTemplate ? 'Failed to create template' : 'Failed to create build') });
      return 0;
    }
  }, [load, onToast]);

  const saveQuestionnaire = React.useCallback(async () => {
    if (projectId <= 0) return;
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
  }, [onToast, projectId, questionnaire, refreshCurrentProject, setProject, setSaving]);

  const updateProject = React.useCallback(async (patch: Partial<IBuildWizardQuestionnaire & IBuildWizardProject>) => {
    if (projectId <= 0) return;
    setSaving(true);
    const nextQuestionnaire = { ...questionnaire, ...patch };
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
  }, [onToast, projectId, questionnaire, refreshCurrentProject, setProject, setQuestionnaire, setSaving]);

  const deleteProject = React.useCallback(async (targetProjectId: number) => {
    if (targetProjectId <= 0) return false;
    try {
      const res = await ApiClient.post<DeleteProjectResponse>('/api/build_wizard.php?action=delete_project', {
        project_id: targetProjectId,
      });
      const deletedProjectId = Number(res?.deleted_project_id || 0);
      setProjects(Array.isArray(res?.projects) ? res.projects : []);
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
        setQuestionnaire(createEmptyBuildWizardQuestionnaire());
        setSteps([]);
        setDocuments([]);
        setContacts([]);
        setContactAssignments([]);
        setPhaseDateRanges([]);
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
  }, [load, onToast, projectId, refreshCurrentProject, setAiPayloadJson, setAiPromptText, setContactAssignments, setContacts, setDocuments, setPhaseDateRanges, setProject, setProjectId, setProjects, setQuestionnaire, setSteps]);

  return {
    openProject,
    createProject,
    saveQuestionnaire,
    updateProject,
    deleteProject,
  };
}
