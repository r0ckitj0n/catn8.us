import React from 'react';

import { ApiClient } from '../ApiClient';
import { IBuildWizardDocument } from '../../types/buildWizard';

interface UseBuildWizardRecoveryUiActionsOptions {
  fetchSingletreeRecoveryStatus: (jobId: string) => Promise<unknown>;
  isAdmin?: boolean;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
  openProject: (projectId: number) => Promise<unknown>;
  parseTaskMetaFromReceiptNotes: (notes: string) => { taskMeta: unknown };
  projectId: number;
  recoverSingletreeDocuments: (apply: boolean, options: Record<string, unknown>) => Promise<any>;
  recoveryBusy: boolean;
  recoveryJobId: string;
  recoveryPolling: boolean;
  recoveryStagedRoot: string;
  recoveryStatus: string;
  recoveryUploadBusy: boolean;
  recoveryUploadInputRef: React.RefObject<HTMLInputElement | null>;
  requestConfirmation: (config: { title: string; message: string; confirmLabel?: string; confirmButtonClass?: string }) => Promise<boolean>;
  setRecoveryJobId: React.Dispatch<React.SetStateAction<string>>;
  setRecoveryPolling: React.Dispatch<React.SetStateAction<boolean>>;
  setRecoveryReportJson: React.Dispatch<React.SetStateAction<string>>;
  setRecoveryReportOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRecoveryStagedCount: React.Dispatch<React.SetStateAction<number>>;
  setRecoveryStagedRoot: React.Dispatch<React.SetStateAction<string>>;
  setRecoveryStatus: React.Dispatch<React.SetStateAction<string>>;
  setRecoveryUploadBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setRecoveryUploadToken: React.Dispatch<React.SetStateAction<string>>;
  stageSingletreeSourceFiles: (files: File[], uploadToken?: string) => Promise<any>;
  documents: IBuildWizardDocument[];
  isLegacyAutoStampedTaskDate: (doc: IBuildWizardDocument, taskMeta: unknown) => boolean;
  clearedLegacyTaskDatesByProjectRef: React.MutableRefObject<Set<number>>;
  setTaskDateOverrideInReceiptNotes: (notes: string | null | undefined, taskDate: string | null | undefined) => string;
}

export function useBuildWizardRecoveryUiActions({
  documents,
  fetchSingletreeRecoveryStatus,
  isAdmin,
  isLegacyAutoStampedTaskDate,
  clearedLegacyTaskDatesByProjectRef,
  onToast,
  openProject,
  parseTaskMetaFromReceiptNotes,
  projectId,
  recoverSingletreeDocuments,
  recoveryBusy,
  recoveryJobId,
  recoveryPolling,
  recoveryStagedRoot,
  recoveryStatus,
  recoveryUploadBusy,
  recoveryUploadInputRef,
  requestConfirmation,
  setRecoveryJobId,
  setRecoveryPolling,
  setRecoveryReportJson,
  setRecoveryReportOpen,
  setRecoveryStagedCount,
  setRecoveryStagedRoot,
  setRecoveryStatus,
  setRecoveryUploadBusy,
  setRecoveryUploadToken,
  setTaskDateOverrideInReceiptNotes,
  stageSingletreeSourceFiles,
}: UseBuildWizardRecoveryUiActionsOptions) {
  const onRunSingletreeRecovery = React.useCallback(async (apply: boolean) => {
    if (!isAdmin || recoveryBusy) {
      return;
    }
    if (apply) {
      const confirmed = await requestConfirmation({
        title: 'Apply Recovery?',
        message: 'Apply Singletree recovery now?\n\nThis will write document mappings/blobs for "Cabin - 91 Singletree Ln".',
        confirmLabel: 'Apply Recovery',
        confirmButtonClass: 'btn btn-danger',
      });
      if (!confirmed) {
        return;
      }
    }
    const host = typeof window !== 'undefined' ? String(window.location.hostname || '').toLowerCase() : '';
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');
    const sourceRootToUse = String(recoveryStagedRoot || '').trim() || '/Users/jongraves/Documents/Home/91 Singletree Ln';
    if (!isLocalHost && !String(recoveryStagedRoot || '').trim()) {
      onToast?.({ tone: 'error', message: 'Upload source files to server first, then run recovery.' });
      setRecoveryReportOpen(true);
      return;
    }
    const res = await recoverSingletreeDocuments(apply, { db_env: 'live', project_title: 'Cabin - 91 Singletree Ln', source_root: sourceRootToUse });
    if (res) {
      setRecoveryReportJson(JSON.stringify(res, null, 2));
      setRecoveryJobId(String(res.job_id || ''));
      setRecoveryStatus(String(res.status || 'queued'));
      setRecoveryReportOpen(true);
    }
  }, [isAdmin, onToast, recoverSingletreeDocuments, recoveryBusy, recoveryStagedRoot, requestConfirmation, setRecoveryJobId, setRecoveryReportJson, setRecoveryReportOpen, setRecoveryStatus]);

  const onUploadRecoveryFiles = React.useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || recoveryUploadBusy) {
      return;
    }
    setRecoveryUploadBusy(true);
    try {
      const fileArray = Array.from(files);
      let token = '';
      let totalSaved = 0;
      let stagedRoot = recoveryStagedRoot || '';
      for (let i = 0; i < fileArray.length; i += 12) {
        const res = await stageSingletreeSourceFiles(fileArray.slice(i, i + 12), token || undefined);
        if (!res?.success) {
          break;
        }
        token = String(res.upload_token || token);
        stagedRoot = String(res.staged_root || stagedRoot);
        totalSaved += Number(res.files_saved || 0);
      }
      if (token) setRecoveryUploadToken(token);
      if (stagedRoot) setRecoveryStagedRoot(stagedRoot);
      if (totalSaved > 0) {
        setRecoveryStagedCount((prev) => prev + totalSaved);
        setRecoveryReportOpen(true);
      }
    } finally {
      setRecoveryUploadBusy(false);
      if (recoveryUploadInputRef.current) {
        recoveryUploadInputRef.current.value = '';
      }
    }
  }, [recoveryStagedRoot, recoveryUploadBusy, recoveryUploadInputRef, setRecoveryReportOpen, setRecoveryStagedCount, setRecoveryStagedRoot, setRecoveryUploadBusy, setRecoveryUploadToken, stageSingletreeSourceFiles]);

  React.useEffect(() => {
    if (!recoveryJobId || recoveryStatus === 'completed' || recoveryStatus === 'failed') {
      return undefined;
    }
    let cancelled = false;
    const timer = window.setInterval(async () => {
      if (cancelled || recoveryPolling) {
        return;
      }
      setRecoveryPolling(true);
      try {
        const status = await fetchSingletreeRecoveryStatus(recoveryJobId);
        if (!status) return;
        setRecoveryStatus(String((status as any).status || ''));
        setRecoveryReportJson(JSON.stringify(status, null, 2));
        if (Number((status as any).completed || 0) === 1 || (status as any).status === 'completed' || (status as any).status === 'failed') {
          setRecoveryJobId('');
        }
      } finally {
        if (!cancelled) setRecoveryPolling(false);
      }
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [fetchSingletreeRecoveryStatus, recoveryJobId, recoveryPolling, recoveryStatus, setRecoveryJobId, setRecoveryPolling, setRecoveryReportJson, setRecoveryStatus]);

  React.useEffect(() => {
    if (projectId <= 0) {
      return undefined;
    }
    if (clearedLegacyTaskDatesByProjectRef.current.has(projectId)) {
      return undefined;
    }
    const legacyTaskDocs = documents.filter((doc) => {
      const parsed = parseTaskMetaFromReceiptNotes(doc.receipt_notes || '');
      return isLegacyAutoStampedTaskDate(doc, parsed.taskMeta);
    });
    if (legacyTaskDocs.length === 0) {
      clearedLegacyTaskDatesByProjectRef.current.add(projectId);
      return undefined;
    }
    clearedLegacyTaskDatesByProjectRef.current.add(projectId);
    let cancelled = false;
    void (async () => {
      try {
        for (const doc of legacyTaskDocs) {
          if (cancelled) return;
          await ApiClient.post<{ document?: IBuildWizardDocument; documents?: IBuildWizardDocument[] }>(
            '/api/build_wizard.php?action=update_document',
            {
              document_id: doc.id,
              receipt_date: null,
              receipt_notes: setTaskDateOverrideInReceiptNotes(doc.receipt_notes, null),
            },
          );
        }
        if (!cancelled) {
          await openProject(projectId);
          onToast?.({
            tone: 'info',
            message: legacyTaskDocs.length === 1
              ? 'Cleared one legacy task date. Tasks now follow the step date unless you set an override.'
              : `Cleared ${legacyTaskDocs.length} legacy task dates. Tasks now follow the step date unless you set an override.`,
          });
        }
      } catch (error: any) {
        clearedLegacyTaskDatesByProjectRef.current.delete(projectId);
        if (!cancelled) {
          onToast?.({ tone: 'warning', message: error?.message || 'Failed to clear legacy task dates automatically.' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearedLegacyTaskDatesByProjectRef, documents, isLegacyAutoStampedTaskDate, onToast, openProject, parseTaskMetaFromReceiptNotes, projectId, setTaskDateOverrideInReceiptNotes]);

  return { onRunSingletreeRecovery, onUploadRecoveryFiles };
}
