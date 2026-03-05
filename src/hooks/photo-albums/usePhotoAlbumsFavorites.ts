import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import {
  PhotoAlbumFavoriteMutationResponse,
  PhotoAlbumFavoritesPayload,
} from '../../types/photoAlbums';
import { IToast } from '../../types/common';

type ToastFn = (tone: IToast['tone'], message: string) => void;

export function usePhotoAlbumsFavorites({ toast }: { toast: ToastFn }) {
  const [favoritePageKeys, setFavoritePageKeys] = React.useState<Set<string>>(new Set());
  const [favoriteMediaKeys, setFavoriteMediaKeys] = React.useState<Set<string>>(new Set());
  const [favoriteTextKeys, setFavoriteTextKeys] = React.useState<Set<string>>(new Set());

  const applyFavorites = React.useCallback((favorites?: PhotoAlbumFavoritesPayload | null) => {
    if (!favorites) {
      setFavoritePageKeys(new Set());
      setFavoriteMediaKeys(new Set());
      setFavoriteTextKeys(new Set());
      return;
    }

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

  return {
    applyFavorites,
    isPageFavorite,
    isMediaFavorite,
    isTextFavorite,
    togglePageFavorite,
    toggleMediaFavorite,
    toggleTextFavorite,
  };
}
