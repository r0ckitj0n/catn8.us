import React from 'react';

import {
  PhotoAlbum,
  PhotoAlbumAiCreateRequest,
  PhotoAlbumFavoriteMutationResponse,
  PhotoAlbumFavoritesPayload,
  PhotoAlbumListResponse,
} from '../types/photoAlbums';
import { IToast } from '../types/common';
import { ApiClient } from '../core/ApiClient';
import { toPhotoAlbumDisplaySummary } from '../utils/photoAlbumText';
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

function normalizeAlbumSummary(album: PhotoAlbum): PhotoAlbum {
  return { ...album, summary: toPhotoAlbumDisplaySummary(album.summary) };
}

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function earliestCapturedAtMs(album: PhotoAlbum): number | null {
  const spreads = Array.isArray(album?.spec?.spreads) ? album.spec.spreads : [];
  let earliest: number | null = null;
  spreads.forEach((spread) => {
    const images = Array.isArray(spread?.images) ? spread.images : [];
    images.forEach((image) => {
      const raw = String(image?.captured_at || '').trim();
      if (!raw) {
        return;
      }
      const ms = Date.parse(raw);
      if (!Number.isFinite(ms)) {
        return;
      }
      if (earliest === null || ms < earliest) {
        earliest = ms;
      }
    });
  });
  return earliest;
}

function sortAlbumsOldestToNewest(albums: PhotoAlbum[]): PhotoAlbum[] {
  return [...albums].sort((a, b) => {
    const aVirtual = Boolean(a?.is_virtual);
    const bVirtual = Boolean(b?.is_virtual);
    if (aVirtual !== bVirtual) {
      return aVirtual ? -1 : 1;
    }
    if (aVirtual && bVirtual) {
      const aKind = String(a?.virtual_kind || '');
      const bKind = String(b?.virtual_kind || '');
      return aKind.localeCompare(bKind);
    }
    const aCapture = earliestCapturedAtMs(a);
    const bCapture = earliestCapturedAtMs(b);
    if (aCapture !== null && bCapture !== null && aCapture !== bCapture) {
      return aCapture - bCapture;
    }
    if ((aCapture !== null) !== (bCapture !== null)) {
      return aCapture !== null ? -1 : 1;
    }

    const aTime = Date.parse(a?.created_at || '');
    const bTime = Date.parse(b?.created_at || '');
    const aValid = Number.isFinite(aTime);
    const bValid = Number.isFinite(bTime);
    if (aValid && bValid && aTime !== bTime) {
      return aTime - bTime;
    }
    if (aValid !== bValid) {
      return aValid ? -1 : 1;
    }

    return Number(a?.id || 0) - Number(b?.id || 0);
  });
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
  const [viewerOverrideAlbum, setViewerOverrideAlbum] = React.useState<PhotoAlbum | null>(null);
  const [createForm, setCreateForm] = React.useState<PhotoAlbumAiCreateRequest>(DEFAULT_CREATE_FORM);
  const [adminDraft, setAdminDraft] = React.useState<PhotoAlbum | null>(null);
  const [favoritePageKeys, setFavoritePageKeys] = React.useState<Set<string>>(new Set());
  const [favoriteMediaKeys, setFavoriteMediaKeys] = React.useState<Set<string>>(new Set());
  const [favoriteTextKeys, setFavoriteTextKeys] = React.useState<Set<string>>(new Set());

  const isAdmin = React.useMemo(
    () => Number(viewer?.is_admin || 0) === 1 || Number(viewer?.is_administrator || 0) === 1,
    [viewer],
  );

  const toast = React.useCallback((tone: IToast['tone'], message: string) => {
    if (typeof onToast === 'function') {
      onToast({ tone, message });
    }
  }, [onToast]);

  const loadAlbums = React.useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setLoading(true);
    }
    try {
      const res = await ApiClient.get<PhotoAlbumListResponse>('/api/photo_albums.php?action=list');
      const rawAlbums = Array.isArray(res?.albums) ? res.albums : [];
      const normalizedAlbums = rawAlbums.map(normalizeAlbumSummary);
      const nextAlbums = sortAlbumsOldestToNewest(normalizedAlbums);
      setAlbums(nextAlbums);
      const nextFavorites = res?.favorites;
      if (nextFavorites) {
        const pageKeys = new Set<string>(
          (Array.isArray(nextFavorites.pages) ? nextFavorites.pages : [])
            .map((item) => `${Number(item.album_id)}:${Number(item.spread_index)}`),
        );
        const mediaKeys = new Set<string>(
          (Array.isArray(nextFavorites.media) ? nextFavorites.media : [])
            .map((item) => `${Number(item.album_id)}:${Number(item.spread_index)}:${Number(item.media_source_index)}`),
        );
        const textKeys = new Set<string>(
          (Array.isArray(nextFavorites.text) ? nextFavorites.text : [])
            .map((item) => `${Number(item.album_id)}:${Number(item.spread_index)}:${String(item.text_item_id || '')}`),
        );
        setFavoritePageKeys(pageKeys);
        setFavoriteMediaKeys(mediaKeys);
        setFavoriteTextKeys(textKeys);
      } else {
        setFavoritePageKeys(new Set());
        setFavoriteMediaKeys(new Set());
        setFavoriteTextKeys(new Set());
      }

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
      if (!silent) {
        setLoading(false);
      }
    }
  }, [toast]);

  React.useEffect(() => {
    void loadAlbums();
  }, [loadAlbums]);

  const selectedAlbum = React.useMemo(() => albums.find((album) => album.id === selectedId) || null, [albums, selectedId]);
  const selectedAlbumIndex = React.useMemo(() => albums.findIndex((album) => album.id === selectedId), [albums, selectedId]);
  const hasUnsavedAdminChanges = React.useMemo(() => {
    if (!showAdminModal || !adminDraft || !selectedAlbum || adminDraft.id !== selectedAlbum.id) {
      return false;
    }
    return stableStringify(adminDraft) !== stableStringify(selectedAlbum);
  }, [adminDraft, selectedAlbum, showAdminModal]);
  const workingAlbum = showAdminModal ? adminDraft : selectedAlbum;
  const spreads = workingAlbum?.spec?.spreads || [];
  const selectedSpread = spreads[pageIndex] || null;
  const pendingPageIndexRef = React.useRef<number | null>(null);
  const selectedAlbumIsVirtual = Boolean(selectedAlbum?.is_virtual);

  const applyFavorites = React.useCallback((favorites: PhotoAlbumFavoritesPayload) => {
    const pageKeys = new Set<string>(
      (Array.isArray(favorites.pages) ? favorites.pages : [])
        .map((item) => `${Number(item.album_id)}:${Number(item.spread_index)}`),
    );
    const mediaKeys = new Set<string>(
      (Array.isArray(favorites.media) ? favorites.media : [])
        .map((item) => `${Number(item.album_id)}:${Number(item.spread_index)}:${Number(item.media_source_index)}`),
    );
    const textKeys = new Set<string>(
      (Array.isArray(favorites.text) ? favorites.text : [])
        .map((item) => `${Number(item.album_id)}:${Number(item.spread_index)}:${String(item.text_item_id || '')}`),
    );
    setFavoritePageKeys(pageKeys);
    setFavoriteMediaKeys(mediaKeys);
    setFavoriteTextKeys(textKeys);
  }, []);

  React.useEffect(() => {
    const initialZoom = Number(selectedAlbum?.spec?.controls?.zoom?.initial || 1);
    setZoom(Number.isFinite(initialZoom) ? initialZoom : 1);
    const spreadCount = Array.isArray(selectedAlbum?.spec?.spreads) ? selectedAlbum.spec.spreads.length : 0;
    const pendingPageIndex = pendingPageIndexRef.current;
    if (pendingPageIndex !== null) {
      const clamped = spreadCount > 0 ? Math.max(0, Math.min(spreadCount - 1, pendingPageIndex)) : 0;
      setPageIndex(clamped);
      pendingPageIndexRef.current = null;
      return;
    }
    setPageIndex(0);
  }, [selectedAlbum?.id]);

  const totalSpreads = spreads.length;
  const canPrevSpread = pageIndex > 0;
  const canNextSpread = pageIndex < Math.max(0, totalSpreads - 1);
  const canPrevAlbum = showAlbumViewer && !showAdminModal && !canPrevSpread && selectedAlbumIndex > 0;
  const canNextAlbum = showAlbumViewer && !showAdminModal && !canNextSpread && selectedAlbumIndex >= 0 && selectedAlbumIndex < (albums.length - 1);
  const canPrev = canPrevSpread || canPrevAlbum;
  const canNext = canNextSpread || canNextAlbum;

  const prevPage = React.useCallback(() => {
    if (pageIndex > 0) {
      setPageIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (!showAlbumViewer || showAdminModal || selectedAlbumIndex <= 0) {
      return;
    }
    const prevAlbum = albums[selectedAlbumIndex - 1];
    if (!prevAlbum) {
      return;
    }
    const prevSpreadCount = Array.isArray(prevAlbum?.spec?.spreads) ? prevAlbum.spec.spreads.length : 0;
    pendingPageIndexRef.current = Math.max(0, prevSpreadCount - 1);
    setSelectedId(prevAlbum.id);
  }, [albums, pageIndex, selectedAlbumIndex, showAdminModal, showAlbumViewer]);

  const nextPage = React.useCallback(() => {
    if (pageIndex < Math.max(0, totalSpreads - 1)) {
      setPageIndex((prev) => Math.min(Math.max(0, totalSpreads - 1), prev + 1));
      return;
    }
    if (!showAlbumViewer || showAdminModal || selectedAlbumIndex < 0 || selectedAlbumIndex >= (albums.length - 1)) {
      return;
    }
    const nextAlbum = albums[selectedAlbumIndex + 1];
    if (!nextAlbum) {
      return;
    }
    pendingPageIndexRef.current = 0;
    setSelectedId(nextAlbum.id);
  }, [albums, pageIndex, selectedAlbumIndex, showAdminModal, showAlbumViewer, totalSpreads]);

  const adjustZoom = React.useCallback((delta: number) => {
    const minZoom = Number(workingAlbum?.spec?.controls?.zoom?.min || 0.75);
    const maxZoom = Number(workingAlbum?.spec?.controls?.zoom?.max || 2.5);
    const step = Number(workingAlbum?.spec?.controls?.zoom?.step || 0.25);
    const next = zoom + (step * delta);
    setZoom(Math.max(minZoom, Math.min(maxZoom, Number(next.toFixed(2)))));
  }, [workingAlbum, zoom]);

  const openAlbum = React.useCallback((albumId: number, mode: 'view' | 'edit' = 'view', initialPageIndex?: number) => {
    pendingPageIndexRef.current = null;
    setViewerOverrideAlbum(null);
    setSelectedId(albumId);
    const requestedPage = Number(initialPageIndex);
    setPageIndex(Number.isFinite(requestedPage) && requestedPage >= 0 ? requestedPage : 0);
    if (isAdmin && mode === 'edit') {
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
    setViewerOverrideAlbum(null);
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
    setViewerOverrideAlbum(null);
  }, [hasUnsavedAdminChanges]);

  const openSelectedInViewer = React.useCallback(() => {
    if (!selectedAlbum && !adminDraft) {
      return;
    }
    if (adminDraft?.id) {
      setSelectedId(adminDraft.id);
      setViewerOverrideAlbum(normalizeAlbumSummary(cloneAlbum(adminDraft)));
    } else {
      setViewerOverrideAlbum(null);
    }
    setShowAdminModal(false);
    setShowAlbumViewer(true);
  }, [adminDraft, selectedAlbum]);

  const {
    createWithAi,
    saveAdminEdits,
    autoLayoutAlbum,
    autoLayoutCurrentSpread,
    autoLayoutAllUnlocked,
    toggleAlbumLock,
    toggleSpreadLock,
    generateBackground,
    generateClipart,
    generateAccentImage,
    generateCoverFromFavorites,
    redesignSpread,
    deleteSelectedAlbum,
    deleteAlbumById,
  } = usePhotoAlbumsMutations({
    isAdmin,
    albums,
    createForm,
    defaultCreateForm: DEFAULT_CREATE_FORM,
    adminDraft,
    selectedAlbum,
    pageIndex,
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

  const isPageFavorite = React.useCallback((albumId: number, spreadIdx: number) => (
    favoritePageKeys.has(`${albumId}:${spreadIdx}`)
  ), [favoritePageKeys]);

  const isMediaFavorite = React.useCallback((albumId: number, spreadIdx: number, mediaSourceIdx: number) => (
    favoriteMediaKeys.has(`${albumId}:${spreadIdx}:${mediaSourceIdx}`)
  ), [favoriteMediaKeys]);

  const isTextFavorite = React.useCallback((albumId: number, spreadIdx: number, textItemId: string) => (
    favoriteTextKeys.has(`${albumId}:${spreadIdx}:${textItemId}`)
  ), [favoriteTextKeys]);

  const togglePageFavorite = React.useCallback(async (albumId: number, spreadIdx: number) => {
    if (albumId <= 0 || spreadIdx < 0) {
      return;
    }
    try {
      const currentlyFavorite = isPageFavorite(albumId, spreadIdx);
      const res = await ApiClient.post<PhotoAlbumFavoriteMutationResponse>('/api/photo_albums.php?action=toggle_page_favorite', {
        album_id: albumId,
        spread_index: spreadIdx,
        is_favorite: currentlyFavorite ? 0 : 1,
      });
      if (res?.favorites) {
        applyFavorites(res.favorites);
      }
    } catch (error: any) {
      toast('error', error?.message || 'Failed to update page favorite');
    }
  }, [applyFavorites, isPageFavorite, toast]);

  const toggleMediaFavorite = React.useCallback(async (albumId: number, spreadIdx: number, mediaSourceIdx: number) => {
    if (albumId <= 0 || spreadIdx < 0 || mediaSourceIdx < 0) {
      return;
    }
    try {
      const currentlyFavorite = isMediaFavorite(albumId, spreadIdx, mediaSourceIdx);
      const res = await ApiClient.post<PhotoAlbumFavoriteMutationResponse>('/api/photo_albums.php?action=toggle_media_favorite', {
        album_id: albumId,
        spread_index: spreadIdx,
        media_source_index: mediaSourceIdx,
        is_favorite: currentlyFavorite ? 0 : 1,
      });
      if (res?.favorites) {
        applyFavorites(res.favorites);
      }
    } catch (error: any) {
      toast('error', error?.message || 'Failed to update media favorite');
    }
  }, [applyFavorites, isMediaFavorite, toast]);

  const toggleTextFavorite = React.useCallback(async (albumId: number, spreadIdx: number, textItemId: string) => {
    const trimmedId = String(textItemId || '').trim();
    if (albumId <= 0 || spreadIdx < 0 || trimmedId === '') {
      return;
    }
    try {
      const currentlyFavorite = isTextFavorite(albumId, spreadIdx, trimmedId);
      const res = await ApiClient.post<PhotoAlbumFavoriteMutationResponse>('/api/photo_albums.php?action=toggle_text_favorite', {
        album_id: albumId,
        spread_index: spreadIdx,
        text_item_id: trimmedId,
        is_favorite: currentlyFavorite ? 0 : 1,
      });
      if (res?.favorites) {
        applyFavorites(res.favorites);
      }
    } catch (error: any) {
      toast('error', error?.message || 'Failed to update text favorite');
    }
  }, [applyFavorites, isTextFavorite, toast]);

  const generateAiBackground = React.useCallback(async (scope: 'page' | 'album', prompt?: string) => {
    const album = adminDraft || selectedAlbum;
    if (!isAdmin || !album || !album.id || album.is_virtual) {
      return;
    }
    await generateBackground({
      id: album.id,
      spread_index: pageIndex,
      scope,
      prompt: String(prompt || '').trim(),
    });
  }, [adminDraft, generateBackground, isAdmin, pageIndex, selectedAlbum]);

  const generateAiClipart = React.useCallback(async (prompt?: string) => {
    const album = adminDraft || selectedAlbum;
    if (!isAdmin || !album || !album.id || album.is_virtual) {
      return;
    }
    await generateClipart({
      id: album.id,
      spread_index: pageIndex,
      prompt: String(prompt || '').trim(),
    });
  }, [adminDraft, generateClipart, isAdmin, pageIndex, selectedAlbum]);

  const generateAiAccentImage = React.useCallback(async (prompt?: string) => {
    const album = adminDraft || selectedAlbum;
    if (!isAdmin || !album || !album.id || album.is_virtual) {
      return;
    }
    await generateAccentImage({
      id: album.id,
      spread_index: pageIndex,
      prompt: String(prompt || '').trim(),
    });
  }, [adminDraft, generateAccentImage, isAdmin, pageIndex, selectedAlbum]);

  const generateAiCoverFromFavorites = React.useCallback(async () => {
    const album = adminDraft || selectedAlbum;
    if (!isAdmin || !album || !album.id || album.is_virtual) {
      return;
    }
    await generateCoverFromFavorites({ id: album.id });
  }, [adminDraft, generateCoverFromFavorites, isAdmin, selectedAlbum]);

  const redesignAiSpread = React.useCallback(async () => {
    const album = adminDraft || selectedAlbum;
    if (!isAdmin || !album || !album.id || album.is_virtual) {
      return;
    }
    await redesignSpread({
      id: album.id,
      spread_index: pageIndex,
    });
  }, [adminDraft, isAdmin, pageIndex, redesignSpread, selectedAlbum]);

  return {
    loading,
    busy,
    albums,
    selectedId,
    selectedAlbum,
    selectedAlbumIsVirtual,
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
    viewerAlbum: viewerOverrideAlbum || selectedAlbum,
    showAdminModal,
    hasUnsavedAdminChanges,
    adminDraft,
    openAlbum,
    openSelectedInViewer,
    closeAlbumViewer,
    closeAdminModal,
    saveAdminEdits,
    autoLayoutAlbum,
    autoLayoutCurrentSpread,
    autoLayoutAllUnlocked,
    toggleAlbumLock,
    toggleSpreadLock,
    deleteSelectedAlbum,
    deleteAlbumById,
    updateAdminDraft,
    isPageFavorite,
    isMediaFavorite,
    isTextFavorite,
    togglePageFavorite,
    toggleMediaFavorite,
    toggleTextFavorite,
    generateAiBackground,
    generateAiClipart,
    generateAiAccentImage,
    generateAiCoverFromFavorites,
    redesignAiSpread,
  };
}
