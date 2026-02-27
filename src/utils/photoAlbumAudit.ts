import { PhotoAlbum } from '../types/photoAlbums';
import { sanitizeAlbumMessageText, splitAlbumMessages } from './photoAlbumText';

export interface PhotoAlbumAudit {
  totalSpreads: number;
  spreadsMissingMedia: number[];
  spreadsMissingText: number[];
  spreadsMissingBoth: number[];
  mediaEntriesMissingSource: number;
  mediaEntriesQuestionableSource: number;
}

function hasQuestionableSource(src: string): boolean {
  const value = src.trim();
  if (!value) {
    return false;
  }
  return !/^https?:\/\//i.test(value) && !value.startsWith('/') && !value.startsWith('data:');
}

export function auditPhotoAlbum(album: PhotoAlbum): PhotoAlbumAudit {
  const spreads = Array.isArray(album.spec?.spreads) ? album.spec.spreads : [];
  const spreadsMissingMedia: number[] = [];
  const spreadsMissingText: number[] = [];
  const spreadsMissingBoth: number[] = [];
  let mediaEntriesMissingSource = 0;
  let mediaEntriesQuestionableSource = 0;

  spreads.forEach((spread, index) => {
    const spreadNum = index + 1;
    const images = Array.isArray(spread?.images) ? spread.images : [];

    const validMedia = images.filter((item) => {
      const src = String(item?.display_src || item?.src || '').trim();
      if (!src) {
        mediaEntriesMissingSource += 1;
        return false;
      }
      if (hasQuestionableSource(src)) {
        mediaEntriesQuestionableSource += 1;
      }
      return true;
    });

    const spreadMessages = [
      ...splitAlbumMessages(spread?.caption || ''),
      ...images.map((item) => splitAlbumMessages(item?.memory_text || item?.caption || '')).flat(),
    ].map((text) => sanitizeAlbumMessageText(text)).filter(Boolean);

    const hasMedia = validMedia.length > 0;
    const hasText = spreadMessages.length > 0;

    if (!hasMedia) {
      spreadsMissingMedia.push(spreadNum);
    }
    if (!hasText) {
      spreadsMissingText.push(spreadNum);
    }
    if (!hasMedia && !hasText) {
      spreadsMissingBoth.push(spreadNum);
    }
  });

  return {
    totalSpreads: spreads.length,
    spreadsMissingMedia,
    spreadsMissingText,
    spreadsMissingBoth,
    mediaEntriesMissingSource,
    mediaEntriesQuestionableSource,
  };
}
