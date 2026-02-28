import React from 'react';

import {
  PhotoAlbum,
  PhotoAlbumAiCreateRequest,
  PhotoAlbumListResponse,
} from '../types/photoAlbums';
import { IToast } from '../types/common';
import { ApiClient } from '../core/ApiClient';
import { usePhotoAlbumsMutations } from './usePhotoAlbumsMutations';

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

function cloneAlbum(album: PhotoAlbum): PhotoAlbum {
  return JSON.parse(JSON.stringify(album)) as PhotoAlbum;
}

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

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
  const [showAdminModal, setShowAdminModal] = React.useState(false);
  const [showAlbumViewer, setShowAlbumViewer] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<PhotoAlbumAiCreateRequest>(DEFAULT_CREATE_FORM);
  const [adminDraft, setAdminDraft] = React.useState<PhotoAlbum | null>(null);

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
  const hasUnsavedAdminChanges = React.useMemo(() => {
    if (!showAdminModal || !adminDraft || !selectedAlbum || adminDraft.id !== selectedAlbum.id) {
      return false;
    }
    return stableStringify(adminDraft) !== stableStringify(selectedAlbum);
  }, [adminDraft, selectedAlbum, showAdminModal]);
  const workingAlbum = showAdminModal ? adminDraft : selectedAlbum;
  const spreads = workingAlbum?.spec?.spreads || [];
  const selectedSpread = spreads[pageIndex] || null;

  React.useEffect(() => {
    const initialZoom = Number(selectedAlbum?.spec?.controls?.zoom?.initial || 1);
    setZoom(Number.isFinite(initialZoom) ? initialZoom : 1);
    setPageIndex(0);
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
    const minZoom = Number(workingAlbum?.spec?.controls?.zoom?.min || 0.75);
    const maxZoom = Number(workingAlbum?.spec?.controls?.zoom?.max || 2.5);
    const step = Number(workingAlbum?.spec?.controls?.zoom?.step || 0.25);
    const next = zoom + (step * delta);
    setZoom(Math.max(minZoom, Math.min(maxZoom, Number(next.toFixed(2)))));
  }, [workingAlbum, zoom]);

  const openAlbum = React.useCallback((albumId: number) => {
    setSelectedId(albumId);
    setPageIndex(0);
    if (isAdmin) {
      const album = albums.find((candidate) => candidate.id === albumId);
      setAdminDraft(album ? cloneAlbum(album) : null);
      setShowAdminModal(true);
      setShowAlbumViewer(false);
      return;
    }
    setShowAlbumViewer(true);
    setShowAdminModal(false);
  }, [albums, isAdmin]);

  const closeAlbumViewer = React.useCallback(() => {
    setShowAlbumViewer(false);
  }, []);

  const closeAdminModal = React.useCallback(() => {
    if (hasUnsavedAdminChanges) {
      const discard = window.confirm('You have unsaved album changes. Discard them?');
      if (!discard) {
        return;
      }
    }
    setShowAdminModal(false);
    setAdminDraft(null);
  }, [hasUnsavedAdminChanges]);

  const openSelectedInViewer = React.useCallback(() => {
    if (!selectedAlbum && !adminDraft) {
      return;
    }
    if (hasUnsavedAdminChanges) {
      const discard = window.confirm('You have unsaved album changes. Save Album first to keep them. Continue and discard changes?');
      if (!discard) {
        return;
      }
    }
    setShowAdminModal(false);
    setShowAlbumViewer(true);
  }, [adminDraft, selectedAlbum, hasUnsavedAdminChanges]);

  const { createWithAi, saveAdminEdits, deleteSelectedAlbum } = usePhotoAlbumsMutations({
    isAdmin,
    createForm,
    defaultCreateForm: DEFAULT_CREATE_FORM,
    adminDraft,
    selectedAlbum,
    setBusy,
    setShowCreateModal,
    setCreateForm,
    setSelectedId,
    setShowAdminModal,
    setAdminDraft,
    setShowAlbumViewer,
    loadAlbums,
    toast,
  });

  const updateAdminDraft = React.useCallback((updater: (prev: PhotoAlbum) => PhotoAlbum) => {
    setAdminDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return updater(prev);
    });
  }, []);

  return {
    loading,
    busy,
    albums,
    selectedId,
    selectedAlbum,
    selectedSpread,
    showCreateModal,
    setShowCreateModal,
    createForm,
    setCreateForm,
    createWithAi,
    isAdmin,
    pageIndex,
    totalSpreads,
    canPrev,
    canNext,
    prevPage,
    nextPage,
    zoom,
    adjustZoom,
    showAlbumViewer,
    showAdminModal,
    adminDraft,
    openAlbum,
    openSelectedInViewer,
    closeAlbumViewer,
    closeAdminModal,
    saveAdminEdits,
    deleteSelectedAlbum,
    updateAdminDraft,
  };
}
