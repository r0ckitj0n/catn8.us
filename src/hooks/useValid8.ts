import React from 'react';
import { ApiClient } from '../core/ApiClient';
import { IToast } from '../types/common';
import {
  Valid8VaultAttachment,
  Valid8VaultAttachmentListResponse,
  Valid8VaultAttachmentUploadResponse,
  Valid8CategoriesListResponse,
  Valid8CategoryMutationResponse,
  Valid8VaultEntryWithSecrets,
  Valid8VaultEntryMutationResponse,
  Valid8VaultEntryUpdateRequest,
  Valid8VaultListResponse,
  Valid8LookupItem,
  Valid8OwnerMutationResponse,
  Valid8OwnersListResponse,
} from '../types/valid8';

export function useValid8(enabled: boolean, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [includeInactive, setIncludeInactive] = React.useState(false);
  const [entries, setEntries] = React.useState<Valid8VaultEntryWithSecrets[]>([]);
  const [attachmentsByEntryId, setAttachmentsByEntryId] = React.useState<Record<string, Valid8VaultAttachment[]>>({});
  const [owners, setOwners] = React.useState<Valid8LookupItem[]>([]);
  const [categories, setCategories] = React.useState<Valid8LookupItem[]>([]);

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

  const loadOwners = React.useCallback(async () => {
    const res = await ApiClient.get<Valid8OwnersListResponse>('/api/valid8.php?action=list_owners&include_archived=1');
    setOwners(Array.isArray(res?.owners) ? res.owners : []);
  }, []);

  const loadCategories = React.useCallback(async () => {
    const res = await ApiClient.get<Valid8CategoriesListResponse>('/api/valid8.php?action=list_categories&include_archived=1');
    setCategories(Array.isArray(res?.categories) ? res.categories : []);
  }, []);

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

  const refreshLookups = React.useCallback(async () => {
    try {
      await Promise.all([loadOwners(), loadCategories()]);
    } catch (error: any) {
      if (onToast) {
        onToast({ tone: 'error', message: String(error?.message || 'Failed to refresh owners/categories') });
      }
    }
  }, [loadCategories, loadOwners, onToast]);

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

  const createOwner = React.useCallback(async (name: string) => {
    await ApiClient.post<Valid8OwnerMutationResponse>('/api/valid8.php?action=create_owner', { name });
    await loadOwners();
  }, [loadOwners]);

  const updateOwner = React.useCallback(async (ownerId: string, name: string) => {
    await ApiClient.post<Valid8OwnerMutationResponse>('/api/valid8.php?action=update_owner', { owner_id: ownerId, name });
    await load(includeInactive);
  }, [includeInactive, load]);

  const archiveOwner = React.useCallback(async (ownerId: string) => {
    await ApiClient.post<Valid8OwnerMutationResponse>('/api/valid8.php?action=archive_owner', { owner_id: ownerId });
    await load(includeInactive);
  }, [includeInactive, load]);

  const setOwnerArchived = React.useCallback(async (ownerId: string, isArchived: number) => {
    await ApiClient.post<Valid8OwnerMutationResponse>('/api/valid8.php?action=set_owner_archived', { owner_id: ownerId, is_archived: isArchived ? 1 : 0 });
    await load(includeInactive);
  }, [includeInactive, load]);

  const deleteOwner = React.useCallback(async (ownerId: string) => {
    await ApiClient.post<Valid8OwnerMutationResponse>('/api/valid8.php?action=delete_owner', { owner_id: ownerId });
    await load(includeInactive);
  }, [includeInactive, load]);

  const createCategory = React.useCallback(async (name: string) => {
    await ApiClient.post<Valid8CategoryMutationResponse>('/api/valid8.php?action=create_category', { name });
    await loadCategories();
  }, [loadCategories]);

  const updateCategory = React.useCallback(async (categoryId: string, name: string) => {
    await ApiClient.post<Valid8CategoryMutationResponse>('/api/valid8.php?action=update_category', { category_id: categoryId, name });
    await load(includeInactive);
  }, [includeInactive, load]);

  const archiveCategory = React.useCallback(async (categoryId: string) => {
    await ApiClient.post<Valid8CategoryMutationResponse>('/api/valid8.php?action=archive_category', { category_id: categoryId });
    await load(includeInactive);
  }, [includeInactive, load]);

  const setCategoryArchived = React.useCallback(async (categoryId: string, isArchived: number) => {
    await ApiClient.post<Valid8CategoryMutationResponse>('/api/valid8.php?action=set_category_archived', { category_id: categoryId, is_archived: isArchived ? 1 : 0 });
    await load(includeInactive);
  }, [includeInactive, load]);

  const deleteCategory = React.useCallback(async (categoryId: string) => {
    await ApiClient.post<Valid8CategoryMutationResponse>('/api/valid8.php?action=delete_category', { category_id: categoryId });
    await load(includeInactive);
  }, [includeInactive, load]);

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
