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
  setBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCreateModal: React.Dispatch<React.SetStateAction<boolean>>;
  setCreateForm: React.Dispatch<React.SetStateAction<PhotoAlbumAiCreateRequest>>;
  setSelectedId: React.Dispatch<React.SetStateAction<number>>;
  setShowAdminModal: React.Dispatch<React.SetStateAction<boolean>>;
  setAdminDraft: React.Dispatch<React.SetStateAction<PhotoAlbum | null>>;
  setShowAlbumViewer: React.Dispatch<React.SetStateAction<boolean>>;
  loadAlbums: () => Promise<void>;
  toast: (tone: IToast['tone'], message: string) => void;
}

export function usePhotoAlbumsMutations(args: PhotoAlbumsMutationsArgs) {
  const {
    isAdmin,
    createForm,
    defaultCreateForm,
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

  const deleteSelectedAlbum = React.useCallback(async () => {
    const album = adminDraft || selectedAlbum;
    if (!isAdmin || !album) {
      return;
    }

    const proceed = window.confirm(`Delete album "${album.title}"?`);
    if (!proceed) {
      return;
    }

    setBusy(true);
    try {
      await ApiClient.post('/api/photo_albums.php?action=delete', { id: album.id });
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
  }, [adminDraft, isAdmin, loadAlbums, selectedAlbum, setAdminDraft, setBusy, setShowAdminModal, setShowAlbumViewer, toast]);

  return {
    createWithAi,
    saveAdminEdits,
    deleteSelectedAlbum,
  };
}
