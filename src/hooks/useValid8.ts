import React from 'react';
import { ApiClient } from '../core/ApiClient';
import { IToast } from '../types/common';
import { useValid8Lookups } from './valid8/useValid8Lookups';
import {
  Valid8VaultAttachment,
  Valid8VaultAttachmentListResponse,
  Valid8VaultAttachmentUploadResponse,
  Valid8VaultEntryCreateRequest,
  Valid8VaultEntryWithSecrets,
  Valid8VaultEntryMutationResponse,
  Valid8VaultEntryUpdateRequest,
  Valid8VaultListResponse,
} from '../types/valid8';

export function useValid8(enabled: boolean, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [includeInactive, setIncludeInactive] = React.useState(false);
  const [entries, setEntries] = React.useState<Valid8VaultEntryWithSecrets[]>([]);
  const [attachmentsByEntryId, setAttachmentsByEntryId] = React.useState<Record<string, Valid8VaultAttachment[]>>({});

  const loadAttachments = React.useCallback(async (entryId?: string) => {
    const suffix = entryId ? `&entry_id=${encodeURIComponent(entryId)}` : '';
    const res = await ApiClient.get<Valid8VaultAttachmentListResponse>(`/api/valid8.php?action=list_attachments${suffix}`);
    const rows = Array.isArray(res?.attachments) ? res.attachments : [];
    if (entryId) {
      setAttachmentsByEntryId((prev) => ({ ...prev, [entryId]: rows }));
      return;
    }
    const grouped: Record<string, Valid8VaultAttachment[]> = {};
    rows.forEach((attachment) => {
      const key = String(attachment.entry_id || '');
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(attachment);
    });
    setAttachmentsByEntryId(grouped);
  }, []);

  const uploadAttachment = React.useCallback(async (entryId: string, file: File) => {
    const fd = new FormData();
    fd.append('entry_id', entryId);
    fd.append('image', file);
    try {
      await ApiClient.postFormData<Valid8VaultAttachmentUploadResponse>('/api/valid8.php?action=upload_attachment', fd);
      await loadAttachments(entryId);
      if (onToast) {
        onToast({ tone: 'success', message: 'Attachment uploaded.' });
      }
    } catch (error: any) {
      const message = String(error?.message || 'Failed to upload attachment');
      if (onToast) {
        onToast({ tone: 'error', message });
      }
    }
  }, [loadAttachments, onToast]);

  const {
    owners,
    categories,
    setOwners,
    setCategories,
    loadOwners,
    loadCategories,
    refreshLookups,
    createOwner,
    updateOwner,
    archiveOwner,
    setOwnerArchived,
    deleteOwner,
    createCategory,
    updateCategory,
    archiveCategory,
    setCategoryArchived,
    deleteCategory,
  } = useValid8Lookups(includeInactive, () => load(includeInactive), onToast);

  const load = React.useCallback(async (nextIncludeInactive: boolean = includeInactive) => {
    setBusy(true);
    try {
      const includeInactiveValue = nextIncludeInactive ? 1 : 0;
      const res = await ApiClient.get<Valid8VaultListResponse>(`/api/valid8.php?action=list&include_inactive=${includeInactiveValue}`);
      setEntries(Array.isArray(res?.entries) ? res.entries : []);
      setLoaded(true);

      void Promise.allSettled([
        loadAttachments(),
        loadOwners(),
        loadCategories(),
      ]).then((results) => {
        const rejectedCount = results.filter((result) => result.status === 'rejected').length;
        if (rejectedCount > 0 && onToast) {
          onToast({
            tone: 'error',
            message: rejectedCount === 1
              ? 'Some VALID8 metadata failed to load.'
              : 'Some VALID8 metadata and attachments failed to load.',
          });
        }
      });
    } catch (error: any) {
      const message = String(error?.message || 'Failed to load VALID8 entries');
      if (onToast) {
        onToast({ tone: 'error', message });
      }
    } finally {
      setBusy(false);
    }
  }, [includeInactive, loadAttachments, loadCategories, loadOwners, onToast]);

  const deleteAttachment = React.useCallback(async (entryId: string, attachmentId: string) => {
    try {
      await ApiClient.post('/api/valid8.php?action=delete_attachment', { attachment_id: attachmentId });
      await loadAttachments(entryId);
      if (onToast) {
        onToast({ tone: 'success', message: 'Attachment deleted.' });
      }
    } catch (error: any) {
      const message = String(error?.message || 'Failed to delete attachment');
      if (onToast) {
        onToast({ tone: 'error', message });
      }
    }
  }, [loadAttachments, onToast]);

  const updateEntry = React.useCallback(async (payload: Valid8VaultEntryUpdateRequest) => {
    const res = await ApiClient.post<Valid8VaultEntryMutationResponse>('/api/valid8.php?action=update_entry', payload);
    const next = res?.entry;
    if (next) {
      setEntries((prev) => prev.map((entry) => (entry.id === next.id ? next : entry)));
    }
    return next || null;
  }, []);

  const createEntry = React.useCallback(async (payload: Valid8VaultEntryCreateRequest) => {
    const res = await ApiClient.post<Valid8VaultEntryMutationResponse>('/api/valid8.php?action=create_entry', payload);
    await load(includeInactive);
    return res?.entry || null;
  }, [includeInactive, load]);

  const archiveEntry = React.useCallback(async (entryId: string) => {
    await ApiClient.post<Valid8VaultEntryMutationResponse>('/api/valid8.php?action=archive_entry', { entry_id: entryId });
    setEntries((prev) => prev.map((entry) => (entry.id === entryId ? { ...entry, is_active: 0 } : entry)));
  }, []);

  const deleteEntry = React.useCallback(async (entryId: string) => {
    await ApiClient.post<Valid8VaultEntryMutationResponse>('/api/valid8.php?action=delete_entry', { entry_id: entryId });
    setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    setAttachmentsByEntryId((prev) => {
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (!enabled) {
      setLoaded(false);
      setEntries([]);
      setAttachmentsByEntryId({});
      setOwners([]);
      setCategories([]);
      return;
    }
    void load(includeInactive);
  }, [enabled, includeInactive, load]);

  return {
    busy,
    loaded,
    includeInactive,
    entries,
    attachmentsByEntryId,
    owners,
    categories,
    setIncludeInactive,
    load,
    refreshLookups,
    uploadAttachment,
    deleteAttachment,
    createEntry,
    updateEntry,
    archiveEntry,
    deleteEntry,
    createOwner,
    updateOwner,
    archiveOwner,
    setOwnerArchived,
    deleteOwner,
    createCategory,
    updateCategory,
    archiveCategory,
    setCategoryArchived,
    deleteCategory,
  };
}
