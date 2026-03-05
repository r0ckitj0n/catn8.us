import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import { PhotoAlbum, PhotoAlbumListResponse } from '../../types/photoAlbums';
import {
  normalizeAlbumSummary,
  sortAlbumsOldestToNewest,
} from './usePhotoAlbumsPageHelpers';

export function usePhotoAlbumsLoader({
  applyFavorites,
  toast,
  setPhotoAlbumsIsAdmin,
  setAlbums,
  setSelectedId,
  setLoading,
}: {
  applyFavorites: (favorites?: any) => void;
  toast: (tone: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  setPhotoAlbumsIsAdmin: React.Dispatch<React.SetStateAction<boolean>>;
  setAlbums: React.Dispatch<React.SetStateAction<PhotoAlbum[]>>;
  setSelectedId: React.Dispatch<React.SetStateAction<number>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const loadAlbums = React.useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setLoading(true);
    }
    try {
      const res = await ApiClient.get<PhotoAlbumListResponse>('/api/photo_albums.php?action=list');
      setPhotoAlbumsIsAdmin(
        Number(res?.viewer?.is_admin || 0) === 1
        || Number(res?.viewer?.is_photo_albums_admin || 0) === 1,
      );
      const rawAlbums = Array.isArray(res?.albums) ? res.albums : [];
      const normalizedAlbums = rawAlbums.map(normalizeAlbumSummary);
      const nextAlbums = sortAlbumsOldestToNewest(normalizedAlbums);
      setAlbums(nextAlbums);
      applyFavorites(res?.favorites || null);

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
  }, [applyFavorites, setAlbums, setLoading, setPhotoAlbumsIsAdmin, setSelectedId, toast]);

  return { loadAlbums };
}
