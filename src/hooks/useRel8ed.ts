import React from 'react';

import { ApiClient } from '../core/ApiClient';
import type {
  Rel8edDashboard,
  Rel8edDnaRegion,
  Rel8edImportPreview,
  Rel8edMedia,
  Rel8edNote,
  Rel8edPedigreeNode,
  Rel8edPerson,
  Rel8edPlace,
} from '../types/rel8ed';

export function useRel8ed() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [dashboard, setDashboard] = React.useState<Rel8edDashboard | null>(null);
  const [people, setPeople] = React.useState<Rel8edPerson[]>([]);
  const [peopleTotal, setPeopleTotal] = React.useState(0);
  const [selectedPerson, setSelectedPerson] = React.useState<Rel8edPerson | null>(null);
  const [pedigree, setPedigree] = React.useState<Rel8edPedigreeNode | null>(null);
  const [surnames, setSurnames] = React.useState<Array<{ surname: string; person_count: number }>>([]);
  const [quality, setQuality] = React.useState<Array<Record<string, unknown>>>([]);
  const [places, setPlaces] = React.useState<Rel8edPlace[]>([]);
  const [dna, setDna] = React.useState<{
    regions: Rel8edDnaRegion[];
    communities: Array<{ id?: number; community_name: string }>;
    can_edit?: number;
    profile?: Record<string, unknown> | null;
  } | null>(null);
  const [media, setMedia] = React.useState<Rel8edMedia[]>([]);
  const [stories, setStories] = React.useState<Rel8edNote[]>([]);
  const [importPreview, setImportPreview] = React.useState<Rel8edImportPreview | null>(null);
  const [relationResult, setRelationResult] = React.useState<Record<string, unknown> | null>(null);
  const [audit, setAudit] = React.useState<Array<Record<string, unknown>>>([]);

  const bootstrap = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ApiClient.get<{ success: boolean; is_admin?: number; error?: string } & Rel8edDashboard>(
        '/api/rel8ed.php?action=bootstrap',
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
      const res = await ApiClient.get<{ success: boolean; dashboard?: Rel8edDashboard; error?: string }>(
        '/api/rel8ed.php?action=dashboard',
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
    const res = await ApiClient.get<{ success: boolean; records?: Rel8edPerson[]; total?: number; error?: string }>(
      `/api/rel8ed.php?${params.toString()}`,
    );
    if (!res?.success) {
      throw new Error(res?.error || 'Search failed');
    }
    setPeople(Array.isArray(res.records) ? res.records : []);
    setPeopleTotal(Number(res.total || 0));
    return res.records || [];
  }, []);

  const loadPerson = React.useCallback(async (id: number) => {
    const res = await ApiClient.get<{ success: boolean; record?: Rel8edPerson; error?: string }>(
      `/api/rel8ed.php?action=get_person&id=${id}`,
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
    const res = await ApiClient.get<{ success: boolean; pedigree?: Rel8edPedigreeNode; error?: string }>(
      `/api/rel8ed.php?${params.toString()}`,
    );
    if (!res?.success) {
      throw new Error(res?.error || 'Pedigree failed');
    }
    setPedigree(res.pedigree || null);
    return res.pedigree || null;
  }, []);

  const loadSurnames = React.useCallback(async () => {
    const res = await ApiClient.get<{ success: boolean; records?: Array<{ surname: string; person_count: number }> }>(
      '/api/rel8ed.php?action=surname_index',
    );
    setSurnames(Array.isArray(res.records) ? res.records : []);
  }, []);

  const loadQuality = React.useCallback(async () => {
    const res = await ApiClient.get<{ success: boolean; records?: Array<Record<string, unknown>> }>(
      '/api/rel8ed.php?action=quality_flags',
    );
    setQuality(Array.isArray(res.records) ? res.records : []);
  }, []);

  const loadMap = React.useCallback(async () => {
    const res = await ApiClient.get<{ success: boolean; places?: Rel8edPlace[] }>(
      '/api/rel8ed.php?action=map_places',
    );
    setPlaces(Array.isArray(res.places) ? res.places : []);
  }, []);

  const loadDna = React.useCallback(async () => {
    const res = await ApiClient.get<{
      success: boolean;
      regions?: Rel8edDnaRegion[];
      communities?: Array<{ id?: number; community_name: string }>;
      can_edit?: number;
      profile?: Record<string, unknown> | null;
    }>('/api/rel8ed.php?action=dna');
    setDna({
      regions: Array.isArray(res.regions) ? res.regions : [],
      communities: Array.isArray(res.communities) ? res.communities : [],
      can_edit: res.can_edit,
      profile: res.profile || null,
    });
  }, []);

  const loadMedia = React.useCallback(async () => {
    const res = await ApiClient.get<{ success: boolean; records?: Rel8edMedia[] }>(
      '/api/rel8ed.php?action=list_media',
    );
    setMedia(Array.isArray(res.records) ? res.records : []);
  }, []);

  const loadStories = React.useCallback(async () => {
    const res = await ApiClient.get<{ success: boolean; records?: Rel8edNote[] }>(
      '/api/rel8ed.php?action=list_stories',
    );
    setStories(Array.isArray(res.records) ? res.records : []);
  }, []);

  const loadAudit = React.useCallback(async () => {
    const res = await ApiClient.get<{ success: boolean; records?: Array<Record<string, unknown>>; error?: string }>(
      '/api/rel8ed.php?action=list_audit',
    );
    if (!res?.success) {
      throw new Error(res?.error || 'Audit failed');
    }
    setAudit(Array.isArray(res.records) ? res.records : []);
  }, []);

  const calcRelation = React.useCallback(async (fromId: number, toId: number) => {
    const res = await ApiClient.get<Record<string, unknown> & { success: boolean; error?: string }>(
      `/api/rel8ed.php?action=relationship&from_id=${fromId}&to_id=${toId}`,
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
    const res = await ApiClient.postFormData<{ success: boolean; error?: string } & Rel8edImportPreview>(
      '/api/rel8ed.php?action=import_preview',
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
      '/api/rel8ed.php?action=import_apply',
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
      '/api/rel8ed.php?action=upload_media',
      fd,
    );
    if (!res?.success) {
      throw new Error(res?.error || 'Upload failed');
    }
    await loadMedia();
  }, [loadMedia]);

  const addNote = React.useCallback(async (body: string, personId?: number, isStory = false, title = '') => {
    const res = await ApiClient.post<{ success: boolean; error?: string }>('/api/rel8ed.php?action=add_note', {
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
    const res = await ApiClient.post<{ success: boolean; error?: string }>('/api/rel8ed.php?action=save_dna', payload);
    if (!res?.success) {
      throw new Error(res?.error || 'DNA save failed');
    }
    await loadDna();
  }, [loadDna]);

  const geocode = React.useCallback(async (limit = 10) => {
    const res = await ApiClient.post<{ success: boolean; error?: string }>('/api/rel8ed.php?action=geocode_places', { limit });
    if (!res?.success) {
      throw new Error(res?.error || 'Geocode failed');
    }
    await loadMap();
    return res;
  }, [loadMap]);

  const setRoot = React.useCallback(async (personId: number) => {
    const res = await ApiClient.post<{ success: boolean; error?: string }>('/api/rel8ed.php?action=set_root', {
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
