import { useCallback, useState } from 'react';

import { ApiClient } from '../core/ApiClient';
import type {
  Medic8BootstrapResponse,
  Medic8Dashboard,
  Medic8DashboardResponse,
  Medic8EmergencySummary,
  Medic8Entity,
  Medic8Person,
  Medic8Record,
} from '../types/medic8';

export function useMedic8() {
  const [people, setPeople] = useState<Medic8Person[]>([]);
  const [personId, setPersonId] = useState<number | null>(null);
  const [dashboard, setDashboard] = useState<Medic8Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ApiClient.get<Medic8BootstrapResponse>('/api/medic8.php?action=bootstrap');
      if (!res.success) {
        throw new Error(res.error || 'Failed to load Medic8');
      }
      setPeople(res.people || []);
      setIsAdmin(Number(res.is_admin || 0) === 1);
      const preferred = res.people?.[0]?.id ?? null;
      setPersonId((current) => current ?? preferred);
      return res;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load Medic8';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await ApiClient.get<Medic8DashboardResponse>(`/api/medic8.php?action=dashboard&person_id=${id}`);
      if (!res.success) {
        throw new Error(res.error || 'Failed to load dashboard');
      }
      setDashboard(res.dashboard);
      setPersonId(id);
      return res.dashboard;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const upsert = useCallback(async (entity: Medic8Entity, record: Medic8Record) => {
    const res = await ApiClient.post<{ success: boolean; error?: string }>('/api/medic8.php?action=upsert', { entity, record });
    if (!res.success) {
      throw new Error(res.error || 'Save failed');
    }
    if (personId) {
      await loadDashboard(personId);
    }
  }, [loadDashboard, personId]);

  const remove = useCallback(async (entity: Medic8Entity, id: number) => {
    const res = await ApiClient.post<{ success: boolean; error?: string }>('/api/medic8.php?action=delete', { entity, id });
    if (!res.success) {
      throw new Error(res.error || 'Delete failed');
    }
    if (personId) {
      await loadDashboard(personId);
    }
  }, [loadDashboard, personId]);

  const revealSensitive = useCallback(async (entity: Medic8Entity, id: number) => {
    const res = await ApiClient.post<{ success: boolean; record?: Medic8Record; error?: string }>('/api/medic8.php?action=reveal_sensitive', { entity, id });
    if (!res.success || !res.record) {
      throw new Error(res.error || 'Reveal failed');
    }
    return res.record;
  }, []);

  const loadEmergencySummary = useCallback(async (id: number) => {
    const res = await ApiClient.get<{ success: boolean; summary?: Medic8EmergencySummary; error?: string }>(
      `/api/medic8.php?action=emergency_summary&person_id=${id}`,
    );
    if (!res.success || !res.summary) {
      throw new Error(res.error || 'Failed to load emergency summary');
    }
    return res.summary;
  }, []);

  const uploadDocument = useCallback(async (id: number, file: File, title: string, docType = '') => {
    const fd = new FormData();
    fd.append('person_id', String(id));
    fd.append('title', title || file.name);
    fd.append('doc_type', docType);
    fd.append('file', file);
    const res = await ApiClient.postFormData<{ success: boolean; error?: string }>('/api/medic8.php?action=upload_document', fd);
    if (!res.success) {
      throw new Error(res.error || 'Upload failed');
    }
    await loadDashboard(id);
  }, [loadDashboard]);

  return {
    people,
    personId,
    setPersonId,
    dashboard,
    loading,
    error,
    isAdmin,
    bootstrap,
    loadDashboard,
    upsert,
    remove,
    revealSensitive,
    loadEmergencySummary,
    uploadDocument,
  };
}
