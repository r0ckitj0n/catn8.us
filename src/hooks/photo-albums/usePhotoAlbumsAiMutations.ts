import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import {
  PhotoAlbumAiBackgroundRequest,
  PhotoAlbumAiCoverFromFavoritesRequest,
  PhotoAlbumAiSpreadRequest,
  PhotoAlbumMutationResponse,
} from '../../types/photoAlbums';
import { PhotoAlbumsMutationsArgs } from './photoAlbumMutationTypes';

function useAlbumAiMutation(
  isAdmin: boolean,
  setBusy: React.Dispatch<React.SetStateAction<boolean>>,
  setAdminDraft: React.Dispatch<React.SetStateAction<any>>,
  loadAlbums: (options?: { silent?: boolean }) => Promise<void>,
  toast: PhotoAlbumsMutationsArgs['toast'],
) {
  return React.useCallback(async <TPayload,>(
    action: string,
    payload: TPayload,
    successMessage: string,
  ) => {
    if (!isAdmin) {
      return;
    }
    setBusy(true);
    try {
      const res = await ApiClient.post<PhotoAlbumMutationResponse>(`/api/photo_albums.php?action=${action}`, payload);
      if (res?.album) {
        setAdminDraft(res.album);
      }
      toast('success', successMessage);
      await loadAlbums({ silent: true });
    } catch (error: any) {
      toast('error', error?.message || `Failed to ${successMessage.toLowerCase()}`);
    } finally {
      setBusy(false);
    }
  }, [isAdmin, loadAlbums, setAdminDraft, setBusy, toast]);
}

export function usePhotoAlbumsAiMutations(args: PhotoAlbumsMutationsArgs) {
  const { isAdmin, setBusy, setAdminDraft, loadAlbums, toast } = args;
  const runAlbumAiMutation = useAlbumAiMutation(isAdmin, setBusy, setAdminDraft, loadAlbums, toast);

  const generateBackground = React.useCallback(async (payload: PhotoAlbumAiBackgroundRequest) => {
    await runAlbumAiMutation(
      'ai_generate_background',
      payload,
      payload.scope === 'album' ? 'Generated a new album background' : 'Generated a new page background',
    );
  }, [runAlbumAiMutation]);

  const generateClipart = React.useCallback(async (payload: PhotoAlbumAiSpreadRequest) => {
    await runAlbumAiMutation('ai_generate_clipart', payload, 'Generated clipart');
  }, [runAlbumAiMutation]);

  const generateAccentImage = React.useCallback(async (payload: PhotoAlbumAiSpreadRequest) => {
    await runAlbumAiMutation('ai_generate_accent_image', payload, 'Generated accent image');
  }, [runAlbumAiMutation]);

  const generateCoverFromFavorites = React.useCallback(async (payload: PhotoAlbumAiCoverFromFavoritesRequest) => {
    await runAlbumAiMutation('ai_generate_cover_from_favorites', payload, 'Generated cover page from favorited media');
  }, [runAlbumAiMutation]);

  const redesignSpread = React.useCallback(async (payload: PhotoAlbumAiSpreadRequest) => {
    await runAlbumAiMutation('ai_redesign_spread', payload, 'Redesigned page');
  }, [runAlbumAiMutation]);

  return {
    generateBackground,
    generateClipart,
    generateAccentImage,
    generateCoverFromFavorites,
    redesignSpread,
  };
}
