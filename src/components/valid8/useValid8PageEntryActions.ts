import React from 'react';

import { Valid8VaultEntryCreateRequest, Valid8VaultEntryWithSecrets } from '../../types/valid8';

interface UseValid8PageEntryActionsParams {
  archiveEntry: (entryId: string) => Promise<unknown>;
  confirm: (options: {
    title: string;
    message: string;
    confirmLabel: string;
    tone: 'primary' | 'danger';
  }) => Promise<boolean>;
  createEntry: (payload: Valid8VaultEntryCreateRequest) => Promise<unknown>;
  deleteEntry: (entryId: string) => Promise<unknown>;
  includeInactive: boolean;
  load: (includeInactive: boolean) => Promise<unknown>;
  onToast?: (toast: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
  setCreatingEntry: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingEntryId: React.Dispatch<React.SetStateAction<string>>;
  setSavingEdit: React.Dispatch<React.SetStateAction<boolean>>;
  updateEntry: (payload: {
    entry_id: string;
    title?: string;
    url?: string | null;
    email_address?: string | null;
    notes?: string | null;
    username?: string;
    password?: string;
    owner_name?: string;
    category?: string;
    is_active?: number;
    source_tab?: string | null;
    source_document?: string | null;
  }) => Promise<unknown>;
}

export function useValid8PageEntryActions({
  archiveEntry,
  confirm,
  createEntry,
  deleteEntry,
  includeInactive,
  load,
  onToast,
  setCreatingEntry,
  setEditingEntryId,
  setSavingEdit,
  updateEntry,
}: UseValid8PageEntryActionsParams) {
  const saveEntry = React.useCallback(async (payload: {
    entry_id: string;
    title?: string;
    url?: string | null;
    email_address?: string | null;
    notes?: string | null;
    username?: string;
    password?: string;
    owner_name?: string;
    category?: string;
    is_active?: number;
    source_tab?: string | null;
    source_document?: string | null;
  }) => {
    setSavingEdit(true);
    try {
      await updateEntry(payload);
      setEditingEntryId('');
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Failed to update entry') });
    } finally {
      setSavingEdit(false);
    }
  }, [onToast, setEditingEntryId, setSavingEdit, updateEntry]);

  const addEntry = React.useCallback(async (payload: Valid8VaultEntryCreateRequest) => {
    setSavingEdit(true);
    try {
      await createEntry(payload);
      setCreatingEntry(false);
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Failed to add credentials') });
    } finally {
      setSavingEdit(false);
    }
  }, [createEntry, onToast, setCreatingEntry, setSavingEdit]);

  const confirmArchiveEntry = React.useCallback(async (entry: Valid8VaultEntryWithSecrets) => {
    const ok = await confirm({
      title: 'Archive Entry?',
      message: `Archive "${entry.title || entry.username || 'entry'}"?`,
      confirmLabel: 'Archive',
      tone: 'primary',
    });
    if (!ok) return;
    try {
      await archiveEntry(entry.id);
      await load(includeInactive);
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Failed to archive entry') });
    }
  }, [archiveEntry, confirm, includeInactive, load, onToast]);

  const confirmDeleteEntry = React.useCallback(async (entry: Valid8VaultEntryWithSecrets) => {
    const ok = await confirm({
      title: 'Delete Entry?',
      message: `Delete "${entry.title || entry.username || 'entry'}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteEntry(entry.id);
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Failed to delete entry') });
    }
  }, [confirm, deleteEntry, onToast]);

  return {
    addEntry,
    confirmArchiveEntry,
    confirmDeleteEntry,
    saveEntry,
  };
}
