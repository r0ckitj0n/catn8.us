import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';
import {
  cloneAlbum,
  normalizeAlbumSummary,
  stableStringify,
} from './usePhotoAlbumsPageHelpers';

export function usePhotoAlbumsViewerState({
  albums,
  selectedAlbum,
  selectedAlbumIndex,
  isAdmin,
  setSelectedId,
}: {
  albums: PhotoAlbum[];
  selectedAlbum: PhotoAlbum | null;
  selectedAlbumIndex: number;
  isAdmin: boolean;
  setSelectedId: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [pageIndex, setPageIndex] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const [showAdminModal, setShowAdminModal] = React.useState(false);
  const [showAlbumViewer, setShowAlbumViewer] = React.useState(false);
  const [viewerOverrideAlbum, setViewerOverrideAlbum] = React.useState<PhotoAlbum | null>(null);
  const [adminDraft, setAdminDraft] = React.useState<PhotoAlbum | null>(null);
  const pendingPageIndexRef = React.useRef<number | null>(null);

  const hasUnsavedAdminChanges = React.useMemo(() => {
    if (!showAdminModal || !adminDraft || !selectedAlbum || adminDraft.id !== selectedAlbum.id) {
      return false;
    }
    return stableStringify(adminDraft) !== stableStringify(selectedAlbum);
  }, [adminDraft, selectedAlbum, showAdminModal]);

  const workingAlbum = showAdminModal ? adminDraft : selectedAlbum;
  const spreads = workingAlbum?.spec?.spreads || [];
  const selectedSpread = spreads[pageIndex] || null;
  const totalSpreads = spreads.length;

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
  }, [albums, pageIndex, selectedAlbumIndex, setSelectedId, showAdminModal, showAlbumViewer]);

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
  }, [albums, pageIndex, selectedAlbumIndex, setSelectedId, showAdminModal, showAlbumViewer, totalSpreads]);

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
  }, [albums, isAdmin, setSelectedId]);

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
  }, [adminDraft, selectedAlbum, setSelectedId]);

  const updateAdminDraft = React.useCallback((updater: (prev: PhotoAlbum) => PhotoAlbum) => {
    setAdminDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return updater(prev);
    });
  }, []);

  return {
    pageIndex,
    setPageIndex,
    zoom,
    showAdminModal,
    setShowAdminModal,
    showAlbumViewer,
    setShowAlbumViewer,
    viewerOverrideAlbum,
    setViewerOverrideAlbum,
    adminDraft,
    setAdminDraft,
    hasUnsavedAdminChanges,
    selectedSpread,
    totalSpreads,
    canPrev,
    canNext,
    prevPage,
    nextPage,
    adjustZoom,
    openAlbum,
    closeAlbumViewer,
    closeAdminModal,
    openSelectedInViewer,
    updateAdminDraft,
  };
}
