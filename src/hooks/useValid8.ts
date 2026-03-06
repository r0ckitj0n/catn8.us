import React from 'react';
import { ApiClient } from '../core/ApiClient';
import { IToast } from '../types/common';
import {
  Valid8VaultAttachment,
  Valid8VaultAttachmentListResponse,
  Valid8VaultAttachmentUploadResponse,
  Valid8VaultEntryWithSecrets,
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

  const load = React.useCallback(async (nextIncludeInactive: boolean = includeInactive) => {
    setBusy(true);
    try {
      const includeInactiveValue = nextIncludeInactive ? 1 : 0;
      const res = await ApiClient.get<Valid8VaultListResponse>(`/api/valid8.php?action=list&include_inactive=${includeInactiveValue}`);
      setEntries(Array.isArray(res?.entries) ? res.entries : []);
      try {
        await loadAttachments();
      } catch (_error: any) {
        setAttachmentsByEntryId({});
      }
      setLoaded(true);
    } catch (error: any) {
      const message = String(error?.message || 'Failed to load VALID8 entries');
      if (onToast) {
        onToast({ tone: 'error', message });
      }
    } finally {
      setBusy(false);
    }
  }, [includeInactive, loadAttachments, onToast]);

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

  React.useEffect(() => {
    if (!enabled) {
      setLoaded(false);
      setEntries([]);
      setAttachmentsByEntryId({});
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
    setIncludeInactive,
    load,
    uploadAttachment,
    deleteAttachment,
  };
}
