import React from 'react';

import { ApiClient } from '../core/ApiClient';
import type {
  Litig8BootstrapResponse,
  Litig8Dashboard,
  Litig8DashboardResponse,
  Litig8Entity,
  Litig8Record,
} from '../types/litig8';

export function useLitig8() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [categories, setCategories] = React.useState<Litig8Record[]>([]);
  const [dashboard, setDashboard] = React.useState<Litig8Dashboard | null>(null);
  const [matters, setMatters] = React.useState<Litig8Record[]>([]);
  const [contacts, setContacts] = React.useState<Litig8Record[]>([]);
  const [documents, setDocuments] = React.useState<Litig8Record[]>([]);
  const [selectedMatterId, setSelectedMatterId] = React.useState<number | null>(null);
  const [matterEvents, setMatterEvents] = React.useState<Litig8Record[]>([]);
  const [matterDeadlines, setMatterDeadlines] = React.useState<Litig8Record[]>([]);

  const bootstrap = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ApiClient.get<Litig8BootstrapResponse>('/api/litig8.php?action=bootstrap');
      if (!res?.success) {
        throw new Error(res?.error || 'Bootstrap failed');
      }
      setIsAdmin(Number(res.is_admin || 0) === 1);
      setCategories(Array.isArray(res.categories) ? res.categories : []);
      return res;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bootstrap failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDashboard = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ApiClient.get<Litig8DashboardResponse>('/api/litig8.php?action=dashboard');
      if (!res?.success || !res.dashboard) {
        throw new Error(res?.error || 'Dashboard failed');
      }
      setDashboard(res.dashboard);
      return res.dashboard;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Dashboard failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadList = React.useCallback(async (entity: Litig8Entity, matterId?: number | null) => {
    const params = new URLSearchParams({ action: 'list', entity, limit: '200' });
    if (matterId && matterId > 0) {
      params.set('matter_id', String(matterId));
    }
    const res = await ApiClient.get<{ success: boolean; records?: Litig8Record[]; error?: string }>(
      `/api/litig8.php?${params.toString()}`,
    );
    if (!res?.success) {
      throw new Error(res?.error || 'List failed');
    }
    return Array.isArray(res.records) ? res.records : [];
  }, []);

  const refreshLists = React.useCallback(async () => {
    const [m, c, d] = await Promise.all([
      loadList('matters'),
      loadList('contacts'),
      loadList('documents'),
    ]);
    setMatters(m);
    setContacts(c);
    setDocuments(d);
  }, [loadList]);

  const loadMatterDetail = React.useCallback(async (matterId: number) => {
    setSelectedMatterId(matterId);
    const [events, deadlines] = await Promise.all([
      loadList('events', matterId),
      loadList('deadlines', matterId),
    ]);
    setMatterEvents(events);
    setMatterDeadlines(deadlines);
  }, [loadList]);

  const upsert = React.useCallback(async (entity: Litig8Entity, record: Record<string, unknown>) => {
    const res = await ApiClient.post<{ success: boolean; error?: string }>('/api/litig8.php?action=upsert', { entity, record });
    if (!res?.success) {
      throw new Error(res?.error || 'Save failed');
    }
    await Promise.all([loadDashboard(), refreshLists()]);
    if (selectedMatterId) {
      await loadMatterDetail(selectedMatterId);
    }
  }, [loadDashboard, loadMatterDetail, refreshLists, selectedMatterId]);

  const remove = React.useCallback(async (entity: Litig8Entity, id: number) => {
    const res = await ApiClient.post<{ success: boolean; error?: string }>('/api/litig8.php?action=delete', { entity, id });
    if (!res?.success) {
      throw new Error(res?.error || 'Delete failed');
    }
    await Promise.all([loadDashboard(), refreshLists()]);
    if (selectedMatterId) {
      await loadMatterDetail(selectedMatterId);
    }
  }, [loadDashboard, loadMatterDetail, refreshLists, selectedMatterId]);

  const revealSensitive = React.useCallback(async (entity: Litig8Entity, id: number) => {
    const res = await ApiClient.post<{ success: boolean; record?: Litig8Record; error?: string }>(
      '/api/litig8.php?action=reveal_sensitive',
      { entity, id },
    );
    if (!res?.success || !res.record) {
      throw new Error(res?.error || 'Reveal failed');
    }
    return res.record;
  }, []);

  const uploadDocument = React.useCallback(async (file: File, title: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title);
    const res = await ApiClient.postFormData<{ success: boolean; error?: string }>('/api/litig8.php?action=upload_document', fd);
    if (!res?.success) {
      throw new Error(res?.error || 'Upload failed');
    }
    await Promise.all([loadDashboard(), refreshLists()]);
  }, [loadDashboard, refreshLists]);

  return {
    loading,
    error,
    isAdmin,
    categories,
    dashboard,
    matters,
    contacts,
    documents,
    selectedMatterId,
    matterEvents,
    matterDeadlines,
    setSelectedMatterId,
    bootstrap,
    loadDashboard,
    refreshLists,
    loadMatterDetail,
    upsert,
    remove,
    revealSensitive,
    uploadDocument,
  };
}
