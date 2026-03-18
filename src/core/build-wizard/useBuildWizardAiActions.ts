import React from 'react';

import { ApiClient } from '../ApiClient';
import {
  IBuildWizardContentSearchResponse,
  IBuildWizardDocumentBlobBackfillResponse,
  IBuildWizardHydrateBlobsResponse,
  IBuildWizardHydrateFromSourcesResponse,
} from '../../types/buildWizard';
import { normalizeBuildWizardSteps } from './buildWizardSanitizers';
import { BuildWizardAiGenerateResponse, BuildWizardPayloadResponse, BuildWizardToast } from './buildWizardInternalTypes';

interface UseBuildWizardAiActionsArgs {
  onToast?: (t: BuildWizardToast) => void;
  projectId: number;
  setAiBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setAiPromptText: React.Dispatch<React.SetStateAction<string>>;
  setAiPayloadJson: React.Dispatch<React.SetStateAction<string>>;
  setSteps: React.Dispatch<React.SetStateAction<any[]>>;
  refreshCurrentProject: () => Promise<void>;
}

export function useBuildWizardAiActions({
  onToast,
  projectId,
  setAiBusy,
  setAiPromptText,
  setAiPayloadJson,
  setSteps,
  refreshCurrentProject,
}: UseBuildWizardAiActionsArgs) {
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
  }, [onToast, projectId, setAiPayloadJson, setAiPromptText]);

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
  }, [onToast, projectId, refreshCurrentProject, setAiBusy, setSteps]);

  const backfillDocumentBlobs = React.useCallback(async (apply: boolean, targetProjectId?: number, limit: number = 0) => {
    try {
      const res = await ApiClient.post<IBuildWizardDocumentBlobBackfillResponse>('/api/build_wizard.php?action=backfill_document_blobs', {
        apply: apply ? 1 : 0,
        project_id: (targetProjectId && targetProjectId > 0) ? targetProjectId : undefined,
        limit: Number.isFinite(limit) ? Math.max(0, Math.min(5000, Math.trunc(limit))) : 0,
      });
      return res?.report || null;
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
      return await ApiClient.postFormData<IBuildWizardHydrateBlobsResponse>('/api/build_wizard.php?action=hydrate_missing_document_blobs', formData);
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to hydrate missing file blobs' });
      return null;
    }
  }, [onToast]);

  const hydrateMissingDocumentBlobsFromSources = React.useCallback(async (targetProjectId?: number, scanLimit: number = 10000) => {
    try {
      return await ApiClient.post<IBuildWizardHydrateFromSourcesResponse>('/api/build_wizard.php?action=hydrate_missing_document_blobs_from_sources', {
        project_id: (targetProjectId && targetProjectId > 0) ? targetProjectId : undefined,
        scan_limit: Number.isFinite(scanLimit) ? Math.max(1, Math.min(25000, Math.trunc(scanLimit))) : 10000,
      });
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to hydrate missing blobs from server sources' });
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

  return {
    packageForAi,
    generateStepsFromAi,
    backfillDocumentBlobs,
    hydrateMissingDocumentBlobs,
    hydrateMissingDocumentBlobsFromSources,
    searchContent,
  };
}
