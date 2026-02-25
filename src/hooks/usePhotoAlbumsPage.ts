import React from 'react';

import { ApiClient } from '../core/ApiClient';
import {
  PhotoAlbum,
  PhotoAlbumAiCreateRequest,
  PhotoAlbumListResponse,
  PhotoAlbumMutationResponse,
} from '../types/photoAlbums';
import { IToast } from '../types/common';

const DEFAULT_CREATE_FORM: PhotoAlbumAiCreateRequest = {
  title: '',
  summary: '',
  memory_era: '',
  mood: '',
  dominant_palette: '',
  scrapbook_materials: '',
  motif_keywords: '',
  camera_style: '35mm candid',
  aspect_ratio: '4:3',
  spread_count: 12,
  page_turn_style: 'ribbon-tabs',
  texture_intensity: 'balanced',
};

export function usePhotoAlbumsPage(
  viewer: any,
  onToast?: (toast: IToast) => void,
) {
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [albums, setAlbums] = React.useState<PhotoAlbum[]>([]);
  const [selectedId, setSelectedId] = React.useState<number>(0);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<PhotoAlbumAiCreateRequest>(DEFAULT_CREATE_FORM);
  const [adminTitle, setAdminTitle] = React.useState('');
  const [adminSummary, setAdminSummary] = React.useState('');

  const isAdmin = React.useMemo(
    () => Number(viewer?.is_admin || 0) === 1 || Number(viewer?.is_administrator || 0) === 1,
    [viewer],
  );

  const toast = React.useCallback((tone: IToast['tone'], message: string) => {
    if (typeof onToast === 'function') {
      onToast({ tone, message });
    }
  }, [onToast]);

  const loadAlbums = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await ApiClient.get<PhotoAlbumListResponse>('/api/photo_albums.php?action=list');
      const nextAlbums = Array.isArray(res?.albums) ? res.albums : [];
      setAlbums(nextAlbums);

      if (nextAlbums.length === 0) {
        setSelectedId(0);
        return;
      }

      setSelectedId((prev) => {
        if (prev > 0 && nextAlbums.some((album) => album.id === prev)) {
          return prev;
        }
        return nextAlbums[0].id;
      });
    } catch (error: any) {
      toast('error', error?.message || 'Failed to load photo albums');
      setAlbums([]);
      setSelectedId(0);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadAlbums();
  }, [loadAlbums]);

  const selectedAlbum = React.useMemo(() => albums.find((album) => album.id === selectedId) || null, [albums, selectedId]);

  const spreads = selectedAlbum?.spec?.spreads || [];
  const selectedSpread = spreads[pageIndex] || null;

  React.useEffect(() => {
    const initialZoom = Number(selectedAlbum?.spec?.controls?.zoom?.initial || 1);
    setZoom(Number.isFinite(initialZoom) ? initialZoom : 1);
    setPageIndex(0);
    setAdminTitle(selectedAlbum?.title || '');
    setAdminSummary(selectedAlbum?.summary || '');
  }, [selectedAlbum?.id]);

  const totalSpreads = spreads.length;
  const canPrev = pageIndex > 0;
  const canNext = pageIndex < Math.max(0, totalSpreads - 1);

  const prevPage = React.useCallback(() => {
    setPageIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const nextPage = React.useCallback(() => {
    setPageIndex((prev) => Math.min(Math.max(0, totalSpreads - 1), prev + 1));
  }, [totalSpreads]);

  const adjustZoom = React.useCallback((delta: number) => {
    const minZoom = Number(selectedAlbum?.spec?.controls?.zoom?.min || 0.75);
    const maxZoom = Number(selectedAlbum?.spec?.controls?.zoom?.max || 2.5);
    const step = Number(selectedAlbum?.spec?.controls?.zoom?.step || 0.25);
    const next = zoom + (step * delta);
    setZoom(Math.max(minZoom, Math.min(maxZoom, Number(next.toFixed(2)))));
  }, [selectedAlbum, zoom]);

  const createWithAi = React.useCallback(async () => {
    if (!isAdmin) {
      return;
    }

    setBusy(true);
    try {
      const res = await ApiClient.post<PhotoAlbumMutationResponse>('/api/photo_albums.php?action=create_with_ai', createForm);
      const created = res?.album;
      if (created?.id) {
        toast('success', 'Photo album created with AI design');
      }
      setShowCreateModal(false);
      setCreateForm(DEFAULT_CREATE_FORM);
      await loadAlbums();
      if (created?.id) {
        setSelectedId(created.id);
      }
    } catch (error: any) {
      toast('error', error?.message || 'Failed to create album');
    } finally {
      setBusy(false);
    }
  }, [createForm, isAdmin, loadAlbums, toast]);

  const saveAdminEdits = React.useCallback(async () => {
    if (!isAdmin || !selectedAlbum) {
      return;
    }

    setBusy(true);
    try {
      await ApiClient.post<PhotoAlbumMutationResponse>('/api/photo_albums.php?action=update', {
        id: selectedAlbum.id,
        title: adminTitle,
        summary: adminSummary,
        cover_image_url: selectedAlbum.cover_image_url,
        cover_prompt: selectedAlbum.cover_prompt,
        is_active: selectedAlbum.is_active,
        spec: selectedAlbum.spec,
      });
      toast('success', 'Photo album updated');
      await loadAlbums();
    } catch (error: any) {
      toast('error', error?.message || 'Failed to update album');
    } finally {
      setBusy(false);
    }
  }, [adminSummary, adminTitle, isAdmin, loadAlbums, selectedAlbum, toast]);

  const deleteSelectedAlbum = React.useCallback(async () => {
    if (!isAdmin || !selectedAlbum) {
      return;
    }

    const proceed = window.confirm(`Delete album "${selectedAlbum.title}"?`);
    if (!proceed) {
      return;
    }

    setBusy(true);
    try {
      await ApiClient.post('/api/photo_albums.php?action=delete', { id: selectedAlbum.id });
      toast('success', 'Photo album deleted');
      await loadAlbums();
    } catch (error: any) {
      toast('error', error?.message || 'Failed to delete album');
    } finally {
      setBusy(false);
    }
  }, [isAdmin, loadAlbums, selectedAlbum, toast]);

  return {
    loading,
    busy,
    albums,
    selectedId,
    setSelectedId,
    selectedAlbum,
    pageIndex,
    selectedSpread,
    totalSpreads,
    canPrev,
    canNext,
    prevPage,
    nextPage,
    zoom,
    adjustZoom,
    isAdmin,
    showCreateModal,
    setShowCreateModal,
    createForm,
    setCreateForm,
    createWithAi,
    adminTitle,
    setAdminTitle,
    adminSummary,
    setAdminSummary,
    saveAdminEdits,
    deleteSelectedAlbum,
  };
}
