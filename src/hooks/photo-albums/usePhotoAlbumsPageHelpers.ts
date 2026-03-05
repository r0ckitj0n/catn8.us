import {
  PhotoAlbum,
  PhotoAlbumAiCreateRequest,
} from '../../types/photoAlbums';
import { toPhotoAlbumDisplaySummary } from '../../utils/photoAlbumText';

export const DEFAULT_CREATE_FORM: PhotoAlbumAiCreateRequest = {
  title: '',
  summary: '',
  memory_era: '',
  mood: '',
  dominant_palette: '',
  scrapbook_materials: '',
  motif_keywords: '',
  camera_style: '35mm candid',
  aspect_ratio: '4:3',
  spread_count: 12,
  page_turn_style: 'ribbon-tabs',
  texture_intensity: 'balanced',
};

export function cloneAlbum(album: PhotoAlbum): PhotoAlbum {
  return JSON.parse(JSON.stringify(album)) as PhotoAlbum;
}

export function normalizeAlbumSummary(album: PhotoAlbum): PhotoAlbum {
  return { ...album, summary: toPhotoAlbumDisplaySummary(album.summary) };
}

export function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function earliestCapturedAtMs(album: PhotoAlbum): number | null {
  const spreads = Array.isArray(album?.spec?.spreads) ? album.spec.spreads : [];
  let earliest: number | null = null;
  spreads.forEach((spread) => {
    const images = Array.isArray(spread?.images) ? spread.images : [];
    images.forEach((image) => {
      const raw = String(image?.captured_at || '').trim();
      if (!raw) {
        return;
      }
      const ms = Date.parse(raw);
      if (!Number.isFinite(ms)) {
        return;
      }
      if (earliest === null || ms < earliest) {
        earliest = ms;
      }
    });
  });
  return earliest;
}

export function sortAlbumsOldestToNewest(albums: PhotoAlbum[]): PhotoAlbum[] {
  return [...albums].sort((a, b) => {
    const aVirtual = Boolean(a?.is_virtual);
    const bVirtual = Boolean(b?.is_virtual);
    if (aVirtual !== bVirtual) {
      return aVirtual ? -1 : 1;
    }
    if (aVirtual && bVirtual) {
      const aKind = String(a?.virtual_kind || '');
      const bKind = String(b?.virtual_kind || '');
      return aKind.localeCompare(bKind);
    }
    const aCapture = earliestCapturedAtMs(a);
    const bCapture = earliestCapturedAtMs(b);
    if (aCapture !== null && bCapture !== null && aCapture !== bCapture) {
      return aCapture - bCapture;
    }
    if ((aCapture !== null) !== (bCapture !== null)) {
      return aCapture !== null ? -1 : 1;
    }

    const aTime = Date.parse(a?.created_at || '');
    const bTime = Date.parse(b?.created_at || '');
    const aValid = Number.isFinite(aTime);
    const bValid = Number.isFinite(bTime);
    if (aValid && bValid && aTime !== bTime) {
      return aTime - bTime;
    }
    if (aValid !== bValid) {
      return aValid ? -1 : 1;
    }

    return Number(a?.id || 0) - Number(b?.id || 0);
  });
}
