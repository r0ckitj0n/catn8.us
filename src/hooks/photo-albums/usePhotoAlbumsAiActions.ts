import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';

export function usePhotoAlbumsAiActions({
  isAdmin,
  adminDraft,
  selectedAlbum,
  pageIndex,
  generateBackground,
  generateClipart,
  generateAccentImage,
  generateCoverFromFavorites,
  redesignSpread,
}: {
  isAdmin: boolean;
  adminDraft: PhotoAlbum | null;
  selectedAlbum: PhotoAlbum | null;
  pageIndex: number;
  generateBackground: (payload: { id: number; spread_index: number; scope: 'page' | 'album'; prompt: string }) => Promise<void>;
  generateClipart: (payload: { id: number; spread_index: number; prompt: string }) => Promise<void>;
  generateAccentImage: (payload: { id: number; spread_index: number; prompt: string }) => Promise<void>;
  generateCoverFromFavorites: (payload: { id: number }) => Promise<void>;
  redesignSpread: (payload: { id: number; spread_index: number }) => Promise<void>;
}) {
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
    generateAiBackground,
    generateAiClipart,
    generateAiAccentImage,
    generateAiCoverFromFavorites,
    redesignAiSpread,
  };
}
