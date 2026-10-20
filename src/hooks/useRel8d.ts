import React from 'react';

import { ApiClient } from '../core/ApiClient';
import type {
  Rel8dDashboard,
  Rel8dDnaRegion,
  Rel8dImportPreview,
  Rel8dMedia,
  Rel8dNote,
  Rel8dPedigreeNode,
  Rel8dPerson,
  Rel8dPlace,
} from '../types/rel8d';

export function useRel8d() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [dashboard, setDashboard] = React.useState<Rel8dDashboard | null>(null);
  const [people, setPeople] = React.useState<Rel8dPerson[]>([]);
  const [peopleTotal, setPeopleTotal] = React.useState(0);
  const [selectedPerson, setSelectedPerson] = React.useState<Rel8dPerson | null>(null);
  const [pedigree, setPedigree] = React.useState<Rel8dPedigreeNode | null>(null);
  const [surnames, setSurnames] = React.useState<Array<{ surname: string; person_count: number }>>([]);
  const [quality, setQuality] = React.useState<Array<Record<string, unknown>>>([]);
  const [places, setPlaces] = React.useState<Rel8dPlace[]>([]);
  const [dna, setDna] = React.useState<{
    regions: Rel8dDnaRegion[];
    communities: Array<{ id?: number; community_name: string }>;
    can_edit?: number;
    profile?: Record<string, unknown> | null;
  } | null>(null);
  const [media, setMedia] = React.useState<Rel8dMedia[]>([]);
  const [stories, setStories] = React.useState<Rel8dNote[]>([]);
  const [importPreview, setImportPreview] = React.useState<Rel8dImportPreview | null>(null);
  const [relationResult, setRelationResult] = React.useState<Record<string, unknown> | null>(null);
  const [audit, setAudit] = React.useState<Array<Record<string, unknown>>>([]);

  const bootstrap = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ApiClient.get<{ success: boolean; is_admin?: number; error?: string } & Rel8dDashboard>(
        '/api/rel8d.php?action=bootstrap',
      );
      if (!res?.success) {
        throw new Error(res?.error || 'Bootstrap failed');
      }
      setIsAdmin(Number(res.is_admin || 0) === 1);
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
      const res = await ApiClient.get<{ success: boolean; dashboard?: Rel8dDashboard; error?: string }>(
        '/api/rel8d.php?action=dashboard',
      );
      if (!res?.success || !res.dashboard) {
        throw new Error(res?.error || 'Dashboard failed');
      }
      setDashboard(res.dashboard);
      setIsAdmin(Number(res.dashboard.is_admin || 0) === 1);
      return res.dashboard;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Dashboard failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const searchPeople = React.useCallback(async (q = '', surname = '') => {
    const params = new URLSearchParams({ action: 'search', limit: '200' });
    if (q) params.set('q', q);
    if (surname) params.set('surname', surname);
    const res = await ApiClient.get<{ success: boolean; records?: Rel8dPerson[]; total?: number; error?: string }>(
      `/api/rel8d.php?${params.toString()}`,
    );
    if (!res?.success) {
      throw new Error(res?.error || 'Search failed');
    }
    setPeople(Array.isArray(res.records) ? res.records : []);
    setPeopleTotal(Number(res.total || 0));
    return res.records || [];
  }, []);

  const loadPerson = React.useCallback(async (id: number) => {
    const res = await ApiClient.get<{ success: boolean; record?: Rel8dPerson; error?: string }>(
      `/api/rel8d.php?action=get_person&id=${id}`,
    );
    if (!res?.success || !res.record) {
      throw new Error(res?.error || 'Person not found');
    }
    setSelectedPerson(res.record);
    return res.record;
  }, []);

  const loadPedigree = React.useCallback(async (id?: number, generations = 5) => {
    const params = new URLSearchParams({ action: 'pedigree', generations: String(generations) });
    if (id) params.set('id', String(id));
    const res = await ApiClient.get<{ success: boolean; pedigree?: Rel8dPedigreeNode; error?: string }>(
      `/api/rel8d.php?${params.toString()}`,
    );
    if (!res?.success) {
      throw new Error(res?.error || 'Pedigree failed');
    }
    setPedigree(res.pedigree || null);
    return res.pedigree || null;
  }, []);

  const loadSurnames = React.useCallback(async () => {
    const res = await ApiClient.get<{ success: boolean; records?: Array<{ surname: string; person_count: number }> }>(
      '/api/rel8d.php?action=surname_index',
    );
    setSurnames(Array.isArray(res.records) ? res.records : []);
  }, []);

  const loadQuality = React.useCallback(async () => {
    const res = await ApiClient.get<{ success: boolean; records?: Array<Record<string, unknown>> }>(
      '/api/rel8d.php?action=quality_flags',
    );
    setQuality(Array.isArray(res.records) ? res.records : []);
  }, []);

  const loadMap = React.useCallback(async () => {
    const res = await ApiClient.get<{ success: boolean; places?: Rel8dPlace[] }>(
      '/api/rel8d.php?action=map_places',
    );
    setPlaces(Array.isArray(res.places) ? res.places : []);
  }, []);

  const loadDna = React.useCallback(async () => {
    const res = await ApiClient.get<{
      success: boolean;
      regions?: Rel8dDnaRegion[];
      communities?: Array<{ id?: number; community_name: string }>;
      can_edit?: number;
      profile?: Record<string, unknown> | null;
    }>('/api/rel8d.php?action=dna');
    setDna({
      regions: Array.isArray(res.regions) ? res.regions : [],
      communities: Array.isArray(res.communities) ? res.communities : [],
      can_edit: res.can_edit,
      profile: res.profile || null,
    });
  }, []);

  const loadMedia = React.useCallback(async () => {
    const res = await ApiClient.get<{ success: boolean; records?: Rel8dMedia[] }>(
      '/api/rel8d.php?action=list_media',
    );
    setMedia(Array.isArray(res.records) ? res.records : []);
  }, []);

  const loadStories = React.useCallback(async () => {
    const res = await ApiClient.get<{ success: boolean; records?: Rel8dNote[] }>(
      '/api/rel8d.php?action=list_stories',
    );
    setStories(Array.isArray(res.records) ? res.records : []);
  }, []);

  const loadAudit = React.useCallback(async () => {
    const res = await ApiClient.get<{ success: boolean; records?: Array<Record<string, unknown>>; error?: string }>(
      '/api/rel8d.php?action=list_audit',
    );
    if (!res?.success) {
      throw new Error(res?.error || 'Audit failed');
    }
    setAudit(Array.isArray(res.records) ? res.records : []);
  }, []);

  const calcRelation = React.useCallback(async (fromId: number, toId: number) => {
    const res = await ApiClient.get<Record<string, unknown> & { success: boolean; error?: string }>(
      `/api/rel8d.php?action=relationship&from_id=${fromId}&to_id=${toId}`,
    );
    if (!res?.success) {
      throw new Error(res?.error || 'Relationship failed');
    }
    setRelationResult(res);
    return res;
  }, []);

  const previewImport = React.useCallback(async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await ApiClient.postFormData<{ success: boolean; error?: string } & Rel8dImportPreview>(
      '/api/rel8d.php?action=import_preview',
      fd,
    );
    if (!res?.success) {
      throw new Error(res?.error || 'Import preview failed');
    }
    setImportPreview(res);
    return res;
  }, []);

  const applyImport = React.useCallback(async (importId: number) => {
    const res = await ApiClient.post<{ success: boolean; counts?: Record<string, number>; error?: string }>(
      '/api/rel8d.php?action=import_apply',
      { import_id: importId },
    );
    if (!res?.success) {
      throw new Error(res?.error || 'Import apply failed');
    }
    setImportPreview(null);
    await loadDashboard();
    return res;
  }, [loadDashboard]);

  const uploadMedia = React.useCallback(async (file: File, title: string, personId?: number) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title);
    if (personId) fd.append('person_id', String(personId));
    const res = await ApiClient.postFormData<{ success: boolean; error?: string }>(
      '/api/rel8d.php?action=upload_media',
      fd,
    );
    if (!res?.success) {
      throw new Error(res?.error || 'Upload failed');
    }
    await loadMedia();
  }, [loadMedia]);

  const addNote = React.useCallback(async (body: string, personId?: number, isStory = false, title = '') => {
    const res = await ApiClient.post<{ success: boolean; error?: string }>('/api/rel8d.php?action=add_note', {
      body,
      person_id: personId,
      is_story: isStory,
      title,
    });
    if (!res?.success) {
      throw new Error(res?.error || 'Note failed');
    }
    await loadStories();
  }, [loadStories]);

  const saveDna = React.useCallback(async (payload: Record<string, unknown>) => {
    const res = await ApiClient.post<{ success: boolean; error?: string }>('/api/rel8d.php?action=save_dna', payload);
    if (!res?.success) {
      throw new Error(res?.error || 'DNA save failed');
    }
    await loadDna();
  }, [loadDna]);

  const geocode = React.useCallback(async (limit = 10) => {
    const res = await ApiClient.post<{ success: boolean; error?: string }>('/api/rel8d.php?action=geocode_places', { limit });
    if (!res?.success) {
      throw new Error(res?.error || 'Geocode failed');
    }
    await loadMap();
    return res;
  }, [loadMap]);

  const setRoot = React.useCallback(async (personId: number) => {
    const res = await ApiClient.post<{ success: boolean; error?: string }>('/api/rel8d.php?action=set_root', {
      person_id: personId,
    });
    if (!res?.success) {
      throw new Error(res?.error || 'Set root failed');
    }
    await loadDashboard();
    await loadPedigree(personId);
  }, [loadDashboard, loadPedigree]);

  return {
    loading,
    error,
    isAdmin,
    dashboard,
    people,
    peopleTotal,
    selectedPerson,
    pedigree,
    surnames,
    quality,
    places,
    dna,
    media,
    stories,
    importPreview,
    relationResult,
    audit,
    setSelectedPerson,
    setImportPreview,
    bootstrap,
    loadDashboard,
    searchPeople,
    loadPerson,
    loadPedigree,
    loadSurnames,
    loadQuality,
    loadMap,
    loadDna,
    loadMedia,
    loadStories,
    loadAudit,
    calcRelation,
    previewImport,
    applyImport,
    uploadMedia,
    addNote,
    saveDna,
    geocode,
    setRoot,
  };
}
