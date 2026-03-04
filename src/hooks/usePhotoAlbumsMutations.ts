import React from 'react';

import { ApiClient } from '../core/ApiClient';
import { IToast } from '../types/common';
import {
  PhotoAlbum,
  PhotoAlbumAiBackgroundRequest,
  PhotoAlbumAiCoverFromFavoritesRequest,
  PhotoAlbumAiCreateRequest,
  PhotoAlbumAiSpreadRequest,
  PhotoAlbumCaptureMessagesResponse,
  PhotoAlbumMutationResponse,
} from '../types/photoAlbums';

interface PhotoAlbumsMutationsArgs {
  isAdmin: boolean;
  albums: PhotoAlbum[];
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
    albums,
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
    const proceed = window.confirm(
      'Warning: This will reorganize any/all text and media on all pages in every album that is not locked. Continue?',
    );
    if (!proceed) {
      return;
    }
    setBusy(true);
    try {
      const unlockedAlbums = albums.filter((album) => Number(album?.id || 0) > 0 && Number(album?.is_locked || 0) !== 1 && !album?.is_virtual);
      let updated = 0;
      let failed = 0;

      for (const album of unlockedAlbums) {
        try {
          const res = await ApiClient.post<PhotoAlbumMutationResponse>('/api/photo_albums.php?action=auto_layout', {
            id: Number(album.id),
          });
          if (res?.album?.id) {
            updated += 1;
          } else {
            failed += 1;
          }
        } catch {
          failed += 1;
        }
      }

      if (failed > 0) {
        toast('warning', `Auto layout updated ${updated} album${updated === 1 ? '' : 's'}; ${failed} failed. Check server logs for details.`);
      } else {
        toast('success', `Auto layout complete for ${updated} album${updated === 1 ? '' : 's'}`);
      }
      await loadAlbums();
    } catch (error: any) {
      toast('error', error?.message || 'Failed to auto layout all albums');
    } finally {
      setBusy(false);
    }
  }, [albums, isAdmin, loadAlbums, setBusy, toast]);

  const captureNewMessages = React.useCallback(async () => {
    if (!isAdmin) {
      return;
    }
    const isLocalHost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );
    if (!isLocalHost) {
      const localCommand = 'cd ~/Documents/Websites/catn8.us && bash scripts/import_photos.sh';
      window.prompt('Run this command on your local machine:', localCommand);
      toast('info', 'Run the command in your local terminal to capture new messages.');
      return;
    }
    setBusy(true);
    try {
      const res = await ApiClient.post<PhotoAlbumCaptureMessagesResponse>('/api/photo_albums.php?action=capture_new_messages', {});
      const pid = Number(res?.pid || 0);
      if (pid > 0) {
        toast('success', `Capture started (PID ${pid}).`);
      } else {
        toast('success', 'Capture started.');
      }
    } catch (error: any) {
      const status = Number(error?.status || 0);
      if (status === 409) {
        toast('info', error?.message || 'Capture process is already running');
      } else {
        toast('error', error?.message || 'Failed to start message capture');
      }
    } finally {
      setBusy(false);
    }
  }, [isAdmin, setBusy, toast]);

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

  const generateBackground = React.useCallback(async (payload: PhotoAlbumAiBackgroundRequest) => {
    if (!isAdmin) {
      return;
    }
    setBusy(true);
    try {
      const res = await ApiClient.post<PhotoAlbumMutationResponse>('/api/photo_albums.php?action=ai_generate_background', payload);
      if (res?.album) {
        setAdminDraft(res.album);
      }
      toast('success', payload.scope === 'album' ? 'Generated a new album background' : 'Generated a new page background');
      await loadAlbums({ silent: true });
    } catch (error: any) {
      toast('error', error?.message || 'Failed to generate background');
    } finally {
      setBusy(false);
    }
  }, [isAdmin, loadAlbums, setAdminDraft, setBusy, toast]);

  const generateClipart = React.useCallback(async (payload: PhotoAlbumAiSpreadRequest) => {
    if (!isAdmin) {
      return;
    }
    setBusy(true);
    try {
      const res = await ApiClient.post<PhotoAlbumMutationResponse>('/api/photo_albums.php?action=ai_generate_clipart', payload);
      if (res?.album) {
        setAdminDraft(res.album);
      }
      toast('success', 'Generated clipart');
      await loadAlbums({ silent: true });
    } catch (error: any) {
      toast('error', error?.message || 'Failed to generate clipart');
    } finally {
      setBusy(false);
    }
  }, [isAdmin, loadAlbums, setAdminDraft, setBusy, toast]);

  const generateAccentImage = React.useCallback(async (payload: PhotoAlbumAiSpreadRequest) => {
    if (!isAdmin) {
      return;
    }
    setBusy(true);
    try {
      const res = await ApiClient.post<PhotoAlbumMutationResponse>('/api/photo_albums.php?action=ai_generate_accent_image', payload);
      if (res?.album) {
        setAdminDraft(res.album);
      }
      toast('success', 'Generated accent image');
      await loadAlbums({ silent: true });
    } catch (error: any) {
      toast('error', error?.message || 'Failed to generate accent image');
    } finally {
      setBusy(false);
    }
  }, [isAdmin, loadAlbums, setAdminDraft, setBusy, toast]);

  const generateCoverFromFavorites = React.useCallback(async (payload: PhotoAlbumAiCoverFromFavoritesRequest) => {
    if (!isAdmin) {
      return;
    }
    setBusy(true);
    try {
      const res = await ApiClient.post<PhotoAlbumMutationResponse>('/api/photo_albums.php?action=ai_generate_cover_from_favorites', payload);
      if (res?.album) {
        setAdminDraft(res.album);
      }
      toast('success', 'Generated cover page from favorited media');
      await loadAlbums({ silent: true });
    } catch (error: any) {
      toast('error', error?.message || 'Failed to generate cover page');
    } finally {
      setBusy(false);
    }
  }, [isAdmin, loadAlbums, setAdminDraft, setBusy, toast]);

  const redesignSpread = React.useCallback(async (payload: PhotoAlbumAiSpreadRequest) => {
    if (!isAdmin) {
      return;
    }
    setBusy(true);
    try {
      const res = await ApiClient.post<PhotoAlbumMutationResponse>('/api/photo_albums.php?action=ai_redesign_spread', payload);
      if (res?.album) {
        setAdminDraft(res.album);
      }
      toast('success', 'Redesigned page');
      await loadAlbums({ silent: true });
    } catch (error: any) {
      toast('error', error?.message || 'Failed to redesign page');
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
  };
}
