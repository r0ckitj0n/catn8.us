import React from 'react';

import { ApiClient } from '../ApiClient';
import {
  IBuildWizardSingletreeRecoverResponse,
  IBuildWizardSingletreeStageUploadResponse,
} from '../../types/buildWizard';
import { BuildWizardToast } from './buildWizardInternalTypes';

interface UseBuildWizardRecoveryActionsArgs {
  onToast?: (t: BuildWizardToast) => void;
  setRecoveryBusy: React.Dispatch<React.SetStateAction<boolean>>;
  refreshCurrentProject: () => Promise<void>;
}

export function useBuildWizardRecoveryActions({
  onToast,
  setRecoveryBusy,
  refreshCurrentProject,
}: UseBuildWizardRecoveryActionsArgs) {
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
  }, [onToast, setRecoveryBusy]);

  const fetchSingletreeRecoveryStatus = React.useCallback(async (jobId: string) => {
    const cleanJobId = String(jobId || '').trim();
    if (!cleanJobId) {
      return null;
    }
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      const response = await fetch(`/api/build_wizard_recover_singletree.php?job_id=${encodeURIComponent(cleanJobId)}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
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
          onToast?.({ tone: 'success', message: `Recovery complete: matched ${summary.matched_existing}, inserted ${summary.inserted_documents}, mapped ${summary.updated_mappings}, blobs ${summary.blob_backfilled}.` });
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
        onToast?.({ tone: 'success', message: `Uploaded ${res.files_saved}/${res.files_total} files to server staging.` });
      }
      return res || null;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to upload recovery source files' });
      return null;
    }
  }, [onToast]);

  return {
    recoverSingletreeDocuments,
    fetchSingletreeRecoveryStatus,
    stageSingletreeSourceFiles,
  };
}
