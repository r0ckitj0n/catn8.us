import React from 'react';

import {
  PhotoAlbum,
  PhotoAlbumAiCreateRequest,
} from '../types/photoAlbums';
import { IToast } from '../types/common';
import { usePhotoAlbumsMutations } from './usePhotoAlbumsMutations';
import {
  DEFAULT_CREATE_FORM,
} from './photo-albums/usePhotoAlbumsPageHelpers';
import { usePhotoAlbumsFavorites } from './photo-albums/usePhotoAlbumsFavorites';
import { usePhotoAlbumsViewerState } from './photo-albums/usePhotoAlbumsViewerState';
import { usePhotoAlbumsAiActions } from './photo-albums/usePhotoAlbumsAiActions';
import { usePhotoAlbumsLoader } from './photo-albums/usePhotoAlbumsLoader';

export function usePhotoAlbumsPageController(
  viewer: any,
  onToast?: (toast: IToast) => void,
) {
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [albums, setAlbums] = React.useState<PhotoAlbum[]>([]);
  const [selectedId, setSelectedId] = React.useState<number>(0);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<PhotoAlbumAiCreateRequest>(DEFAULT_CREATE_FORM);
  const [photoAlbumsIsAdmin, setPhotoAlbumsIsAdmin] = React.useState(false);

  const isAdmin = React.useMemo(
    () => (
      Number(viewer?.is_admin || 0) === 1
      || Number(viewer?.is_administrator || 0) === 1
      || Number(viewer?.is_photo_albums_admin || 0) === 1
      || photoAlbumsIsAdmin
    ),
    [photoAlbumsIsAdmin, viewer],
  );

  const toast = React.useCallback((tone: IToast['tone'], message: string) => {
    if (typeof onToast === 'function') {
      onToast({ tone, message });
    }
  }, [onToast]);

  const {
    applyFavorites,
    isPageFavorite,
    isMediaFavorite,
    isTextFavorite,
    togglePageFavorite,
    toggleMediaFavorite,
    toggleTextFavorite,
  } = usePhotoAlbumsFavorites({ toast });

  const { loadAlbums } = usePhotoAlbumsLoader({
    applyFavorites,
    toast,
    setPhotoAlbumsIsAdmin,
    setAlbums,
    setSelectedId,
    setLoading,
  });

  React.useEffect(() => {
    void loadAlbums();
  }, [loadAlbums]);

  const selectedAlbum = React.useMemo(() => albums.find((album) => album.id === selectedId) || null, [albums, selectedId]);
  const selectedAlbumIndex = React.useMemo(() => albums.findIndex((album) => album.id === selectedId), [albums, selectedId]);
  const selectedAlbumIsVirtual = Boolean(selectedAlbum?.is_virtual);

  const {
    pageIndex,
    setPageIndex,
    zoom,
    showAdminModal,
    setShowAdminModal,
    showAlbumViewer,
    setShowAlbumViewer,
    viewerOverrideAlbum,
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
  } = usePhotoAlbumsViewerState({
    albums,
    selectedAlbum,
    selectedAlbumIndex,
    isAdmin,
    setSelectedId,
  });

  const {
    createWithAi,
    saveAdminEdits,
    autoLayoutAlbum,
    autoLayoutCurrentSpread,
    autoLayoutAllUnlocked,
    captureNewMessages,
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

  const {
    generateAiBackground,
    generateAiClipart,
    generateAiAccentImage,
    generateAiCoverFromFavorites,
    redesignAiSpread,
  } = usePhotoAlbumsAiActions({
    isAdmin,
    adminDraft,
    selectedAlbum,
    pageIndex,
    generateBackground,
    generateClipart,
    generateAccentImage,
    generateCoverFromFavorites,
    redesignSpread,
  });

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
    captureNewMessages,
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
