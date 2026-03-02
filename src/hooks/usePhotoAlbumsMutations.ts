import React from 'react';

import { ApiClient } from '../core/ApiClient';
import { IToast } from '../types/common';
import { PhotoAlbum, PhotoAlbumAiCreateRequest, PhotoAlbumMutationResponse } from '../types/photoAlbums';

interface PhotoAlbumsMutationsArgs {
  isAdmin: boolean;
  createForm: PhotoAlbumAiCreateRequest;
  defaultCreateForm: PhotoAlbumAiCreateRequest;
  adminDraft: PhotoAlbum | null;
  selectedAlbum: PhotoAlbum | null;
  pageIndex: number;
  setBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCreateModal: React.Dispatch<React.SetStateAction<boolean>>;
  setCreateForm: React.Dispatch<React.SetStateAction<PhotoAlbumAiCreateRequest>>;
  setSelectedId: React.Dispatch<React.SetStateAction<number>>;
  setShowAdminModal: React.Dispatch<React.SetStateAction<boolean>>;
  setAdminDraft: React.Dispatch<React.SetStateAction<PhotoAlbum | null>>;
  setShowAlbumViewer: React.Dispatch<React.SetStateAction<boolean>>;
  loadAlbums: (options?: { silent?: boolean }) => Promise<void>;
  toast: (tone: IToast['tone'], message: string) => void;
}

interface DeleteAlbumArgs {
  id: number;
  title?: string;
}

export function usePhotoAlbumsMutations(args: PhotoAlbumsMutationsArgs) {
  const {
    isAdmin,
    createForm,
    defaultCreateForm,
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
  } = args;

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
      setCreateForm(defaultCreateForm);
      await loadAlbums();
      if (created?.id) {
        setSelectedId(created.id);
      }
    } catch (error: any) {
      toast('error', error?.message || 'Failed to create album');
    } finally {
      setBusy(false);
    }
  }, [createForm, defaultCreateForm, isAdmin, loadAlbums, setBusy, setCreateForm, setSelectedId, setShowCreateModal, toast]);

  const saveAdminEdits = React.useCallback(async () => {
    if (!isAdmin || !adminDraft) {
      return;
    }

    setBusy(true);
    try {
      const res = await ApiClient.post<PhotoAlbumMutationResponse>('/api/photo_albums.php?action=update', {
        id: adminDraft.id,
        title: adminDraft.title,
        summary: adminDraft.summary,
        cover_image_url: adminDraft.cover_image_url,
        cover_prompt: adminDraft.cover_prompt,
        is_active: adminDraft.is_active,
        spec: adminDraft.spec,
      });
      if (res?.album) {
        setAdminDraft(res.album);
      }
      toast('success', 'Photo album updated');
      await loadAlbums();
    } catch (error: any) {
      toast('error', error?.message || 'Failed to update album');
    } finally {
      setBusy(false);
    }
  }, [adminDraft, isAdmin, loadAlbums, setAdminDraft, setBusy, toast]);

  const deleteAlbumById = React.useCallback(async ({ id, title }: DeleteAlbumArgs) => {
    if (!isAdmin || !id) {
      return;
    }

    const label = (title || 'this album').trim();
    const proceed = window.confirm(`Delete album "${label}"?`);
    if (!proceed) {
      return;
    }

    setBusy(true);
    try {
      await ApiClient.post('/api/photo_albums.php?action=delete', { id });
      toast('success', 'Photo album deleted');
      setShowAdminModal(false);
      setAdminDraft(null);
      setShowAlbumViewer(false);
      await loadAlbums();
    } catch (error: any) {
      toast('error', error?.message || 'Failed to delete album');
    } finally {
      setBusy(false);
    }
  }, [isAdmin, loadAlbums, setAdminDraft, setBusy, setShowAdminModal, setShowAlbumViewer, toast]);

  const deleteSelectedAlbum = React.useCallback(async () => {
    const album = adminDraft || selectedAlbum;
    if (!album) {
      return;
    }
    await deleteAlbumById({ id: album.id, title: album.title });
  }, [adminDraft, deleteAlbumById, selectedAlbum]);

  const autoLayoutAlbum = React.useCallback(async () => {
    const album = adminDraft || selectedAlbum;
    if (!isAdmin || !album || !album.id || album.is_virtual) {
      return;
    }

    setBusy(true);
    try {
      const res = await ApiClient.post<PhotoAlbumMutationResponse>('/api/photo_albums.php?action=auto_layout', {
        id: album.id,
      });
      if (res?.album) {
        setAdminDraft(res.album);
      }
      toast('success', 'Auto layout applied and saved');
      await loadAlbums({ silent: true });
    } catch (error: any) {
      toast('error', error?.message || 'Failed to auto layout album');
    } finally {
      setBusy(false);
    }
  }, [adminDraft, selectedAlbum, isAdmin, setBusy, setAdminDraft, toast, loadAlbums]);

  const autoLayoutCurrentSpread = React.useCallback(async () => {
    const album = adminDraft || selectedAlbum;
    if (!isAdmin || !album || !album.id || album.is_virtual) {
      return;
    }
    setBusy(true);
    try {
      const res = await ApiClient.post<PhotoAlbumMutationResponse>('/api/photo_albums.php?action=auto_layout_spread', {
        id: album.id,
        spread_index: pageIndex,
      });
      if (res?.album) {
        setAdminDraft(res.album);
      }
      toast('success', `Auto layout applied to spread ${pageIndex + 1}`);
      await loadAlbums({ silent: true });
    } catch (error: any) {
      toast('error', error?.message || 'Failed to auto layout spread');
    } finally {
      setBusy(false);
    }
  }, [adminDraft, isAdmin, loadAlbums, pageIndex, selectedAlbum, setAdminDraft, setBusy, toast]);

  const autoLayoutAllUnlocked = React.useCallback(async () => {
    if (!isAdmin) {
      return;
    }
    const proceed = window.confirm('Auto layout all unlocked albums?');
    if (!proceed) {
      return;
    }
    setBusy(true);
    try {
      const res = await ApiClient.post<{ success: boolean; updated_albums?: number }>('/api/photo_albums.php?action=auto_layout_all', {});
      const updated = Number(res?.updated_albums || 0);
      toast('success', `Auto layout complete for ${updated} album${updated === 1 ? '' : 's'}`);
      await loadAlbums();
    } catch (error: any) {
      toast('error', error?.message || 'Failed to auto layout all albums');
    } finally {
      setBusy(false);
    }
  }, [isAdmin, loadAlbums, setBusy, toast]);

  const toggleAlbumLock = React.useCallback(async (id: number, isLocked: boolean) => {
    if (!isAdmin || id <= 0) {
      return;
    }
    setBusy(true);
    try {
      const res = await ApiClient.post<PhotoAlbumMutationResponse>('/api/photo_albums.php?action=toggle_album_lock', {
        id,
        is_locked: isLocked ? 1 : 0,
      });
      if (res?.album) {
        setAdminDraft((prev) => {
          if (!prev || prev.id !== id) {
            return prev;
          }
          return res.album;
        });
      }
      toast('success', isLocked ? 'Album locked' : 'Album unlocked');
      await loadAlbums({ silent: true });
    } catch (error: any) {
      toast('error', error?.message || 'Failed to update album lock');
    } finally {
      setBusy(false);
    }
  }, [isAdmin, loadAlbums, setAdminDraft, setBusy, toast]);

  const toggleSpreadLock = React.useCallback(async (id: number, spreadIndex: number, isLocked: boolean) => {
    if (!isAdmin || id <= 0 || spreadIndex < 0) {
      return;
    }
    setBusy(true);
    try {
      const res = await ApiClient.post<PhotoAlbumMutationResponse>('/api/photo_albums.php?action=toggle_spread_lock', {
        id,
        spread_index: spreadIndex,
        is_locked: isLocked ? 1 : 0,
      });
      if (res?.album) {
        setAdminDraft((prev) => {
          if (!prev || prev.id !== id) {
            return prev;
          }
          return res.album;
        });
      }
      toast('success', isLocked ? 'Page locked' : 'Page unlocked');
      await loadAlbums({ silent: true });
    } catch (error: any) {
      toast('error', error?.message || 'Failed to update page lock');
    } finally {
      setBusy(false);
    }
  }, [isAdmin, loadAlbums, setAdminDraft, setBusy, toast]);

  return {
    createWithAi,
    saveAdminEdits,
    autoLayoutAlbum,
    autoLayoutCurrentSpread,
    autoLayoutAllUnlocked,
    toggleAlbumLock,
    toggleSpreadLock,
    deleteSelectedAlbum,
    deleteAlbumById,
  };
}
