import React from 'react';

import { PhotoAlbum } from '../../../types/photoAlbums';
import { inferAlbumTheme, sanitizeAlbumMessageText } from '../../../utils/photoAlbumText';
import { DecorItem, NoteItem, spreadDecor, spreadMedia, spreadNotes } from '../photoAlbumStageEngine';
import { PreparedMediaItem } from '../types';

export function usePhotoAlbumStagePrepared({
  album,
  spreadIndex,
  contactDisplayName,
}: {
  album: PhotoAlbum;
  spreadIndex: number;
  contactDisplayName?: string;
}) {
  const spread = album.spec?.spreads?.[spreadIndex] || null;

  const mediaItems = React.useMemo(() => {
    try {
      return spreadMedia(album, spreadIndex);
    } catch {
      return [] as PreparedMediaItem[];
    }
  }, [album, spreadIndex]);

  const notes = React.useMemo(() => {
    try {
      return spreadNotes(album, spreadIndex, mediaItems, contactDisplayName);
    } catch {
      return [] as NoteItem[];
    }
  }, [album, spreadIndex, mediaItems, contactDisplayName]);

  const theme = inferAlbumTheme([spread?.title || '', spread?.caption || '', ...notes.map((n) => n.text)].join(' '));

  const decorItems = React.useMemo(() => {
    try {
      return spreadDecor(album, spreadIndex, theme.emojis);
    } catch {
      return [] as DecorItem[];
    }
  }, [album, spreadIndex, theme.emojis]);

  const spreadBackgroundImageUrl = String((spread as { background_image_url?: string } | null)?.background_image_url || '').trim();
  const canvasWidthPx = Math.max(1, Number(album.spec?.dimensions?.width_px || 1400));
  const canvasHeightPx = Math.max(1, Number(album.spec?.dimensions?.height_px || 1050));

  const spreadHeaderLabel = React.useMemo(() => {
    const captured = mediaItems
      .map((item) => item.capturedAtMs)
      .filter((value): value is number => Number.isFinite(value));
    if (captured.length > 0) {
      const date = new Date(Math.min(...captured));
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    return sanitizeAlbumMessageText(spread?.title || 'Untitled Spread');
  }, [mediaItems, spread?.title]);

  const densityCount = notes.length + mediaItems.length;
  const mediaWidthPct = densityCount <= 2
    ? 44
    : densityCount <= 4
      ? 30
      : densityCount <= 8
        ? 22
        : densityCount >= 16
          ? 11
          : densityCount >= 10
            ? 13
            : 16;
  const noteWidthPct = densityCount <= 2
    ? 40
    : densityCount <= 4
      ? 28
      : densityCount <= 8
        ? 20
        : densityCount >= 16
          ? 12
          : densityCount >= 10
            ? 14
            : 17;

  return {
    spread,
    mediaItems,
    notes,
    decorItems,
    theme,
    spreadBackgroundImageUrl,
    canvasWidthPx,
    canvasHeightPx,
    spreadHeaderLabel,
    densityCount,
    mediaWidthPct,
    noteWidthPct,
  };
}
