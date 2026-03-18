import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';

interface UsePhotoAlbumAdminPreviewActionsArgs {
  onAlbumChange: (updater: (prev: PhotoAlbum) => PhotoAlbum) => void;
  pageIndex: number;
  hydrateTextItems: (targetSpread: NonNullable<PhotoAlbum['spec']['spreads'][number]>) => void;
}

export function usePhotoAlbumAdminPreviewActions({
  onAlbumChange,
  pageIndex,
  hydrateTextItems,
}: UsePhotoAlbumAdminPreviewActionsArgs) {
  const deleteListMedia = React.useCallback((spreadIndex: number, mediaSourceIndex: number) => onAlbumChange((prev) => {
    const next = structuredClone(prev);
    const targetSpread = next.spec.spreads[spreadIndex];
    if (!targetSpread || !Array.isArray(targetSpread.images)) {
      return prev;
    }
    targetSpread.images.splice(mediaSourceIndex, 1);
    return next;
  }), [onAlbumChange]);

  const deleteListText = React.useCallback((spreadIndex: number, textItemId: string) => onAlbumChange((prev) => {
    const next = structuredClone(prev);
    const targetSpread = next.spec.spreads[spreadIndex];
    if (!targetSpread) return prev;
    hydrateTextItems(targetSpread);
    if (!Array.isArray(targetSpread.text_items)) return prev;
    const targetIndex = targetSpread.text_items.findIndex((item) => String(item?.id || '') === String(textItemId || ''));
    if (targetIndex < 0) return prev;
    targetSpread.text_items.splice(targetIndex, 1);
    return next;
  }), [hydrateTextItems, onAlbumChange]);

  const moveMedia = React.useCallback((index: number, patch: { x: number; y: number; w?: number; h?: number }) => onAlbumChange((prev) => {
    const next = structuredClone(prev);
    const target = next.spec.spreads[pageIndex]?.images?.[index];
    if (target) {
      target.x = patch.x;
      target.y = patch.y;
      if (typeof patch.w === 'number') target.w = patch.w;
      if (typeof patch.h === 'number') (target as any).h = patch.h;
    }
    return next;
  }), [onAlbumChange, pageIndex]);

  const moveNote = React.useCallback((noteId: string, index: number, patch: { x: number; y: number; w?: number; h?: number }) => onAlbumChange((prev) => {
    const next = structuredClone(prev);
    const targetSpread = next.spec.spreads[pageIndex];
    if (!targetSpread) return prev;
    hydrateTextItems(targetSpread);
    if (!Array.isArray(targetSpread.text_items)) targetSpread.text_items = [];
    const stableNoteId = String(noteId || `spread-note-${index}`).trim();
    let targetIndex = targetSpread.text_items.findIndex((item) => String(item?.id || '') === stableNoteId);
    if (targetIndex < 0 && index >= 0 && index < targetSpread.text_items.length) {
      const candidate = targetSpread.text_items[index];
      if (candidate && typeof candidate === 'object') {
        candidate.id = String(candidate.id || '').trim() || stableNoteId;
        targetIndex = index;
      }
    }
    if (targetIndex >= 0) {
      targetSpread.text_items[targetIndex].x = patch.x;
      targetSpread.text_items[targetIndex].y = patch.y;
      if (typeof patch.w === 'number') targetSpread.text_items[targetIndex].w = patch.w;
      if (typeof patch.h === 'number') (targetSpread.text_items[targetIndex] as any).h = patch.h;
      return next;
    }
    if (!targetSpread.note_layout || typeof targetSpread.note_layout !== 'object') {
      targetSpread.note_layout = {};
    }
    const existing = targetSpread.note_layout[stableNoteId] || {};
    targetSpread.note_layout[stableNoteId] = {
      ...existing,
      x: patch.x,
      y: patch.y,
      ...(typeof patch.w === 'number' ? { w: patch.w } : {}),
      ...(typeof patch.h === 'number' ? { h: patch.h } : {}),
      ...(typeof (existing as any).rotation === 'number' ? { rotation: (existing as any).rotation } : {}),
    };
    return next;
  }), [hydrateTextItems, onAlbumChange, pageIndex]);

  const moveDecor = React.useCallback((index: number, patch: { x: number; y: number; emoji?: string; size?: number; rotation?: number }) => onAlbumChange((prev) => {
    const next = structuredClone(prev);
    const targetSpread = next.spec.spreads[pageIndex];
    if (!targetSpread) return prev;
    if (!Array.isArray(targetSpread.decor_items)) targetSpread.decor_items = [];
    if (!targetSpread.decor_items[index]) {
      targetSpread.decor_items[index] = {
        id: `decor-${Date.now()}-${index}`,
        emoji: patch.emoji || '✨',
        size: typeof patch.size === 'number' ? patch.size : 1,
        rotation: typeof patch.rotation === 'number' ? patch.rotation : 0,
        x: patch.x,
        y: patch.y,
      };
      return next;
    }
    const target = targetSpread.decor_items[index];
    target.x = patch.x;
    target.y = patch.y;
    if (typeof patch.emoji === 'string' && patch.emoji.trim()) target.emoji = patch.emoji;
    if (typeof patch.size === 'number') target.size = patch.size;
    if (typeof patch.rotation === 'number') target.rotation = patch.rotation;
    return next;
  }), [onAlbumChange, pageIndex]);

  const editNoteText = React.useCallback((index: number, nextText: string) => onAlbumChange((prev) => {
    const next = structuredClone(prev);
    const targetSpread = next.spec.spreads[pageIndex];
    if (!targetSpread) return prev;
    hydrateTextItems(targetSpread);
    if (!Array.isArray(targetSpread.text_items)) return next;
    if (!targetSpread.text_items[index]) {
      targetSpread.text_items[index] = { id: `note-${Date.now()}-${index}`, text: nextText };
    } else {
      targetSpread.text_items[index].text = nextText;
    }
    return next;
  }), [hydrateTextItems, onAlbumChange, pageIndex]);

  const editMediaCaption = React.useCallback((index: number, nextCaption: string) => onAlbumChange((prev) => {
    const next = structuredClone(prev);
    const target = next.spec.spreads[pageIndex]?.images?.[index];
    if (target) target.caption = nextCaption;
    return next;
  }), [onAlbumChange, pageIndex]);

  const editDecor = React.useCallback((index: number, patch: { emoji?: string; size?: number }) => onAlbumChange((prev) => {
    const next = structuredClone(prev);
    const target = next.spec.spreads[pageIndex]?.decor_items?.[index];
    if (target) {
      if (typeof patch.emoji === 'string') target.emoji = patch.emoji;
      if (typeof patch.size === 'number') target.size = patch.size;
    }
    return next;
  }), [onAlbumChange, pageIndex]);

  const duplicateMedia = React.useCallback((index: number) => onAlbumChange((prev) => {
    const next = structuredClone(prev);
    const targetSpread = next.spec.spreads[pageIndex];
    if (!targetSpread || !Array.isArray(targetSpread.images) || !targetSpread.images[index]) return prev;
    const source = targetSpread.images[index];
    targetSpread.images.splice(index + 1, 0, { ...source, x: Math.min(92, Number(source.x ?? 10) + 4), y: Math.min(90, Number(source.y ?? 10) + 4) });
    return next;
  }), [onAlbumChange, pageIndex]);

  const duplicateNote = React.useCallback((index: number) => onAlbumChange((prev) => {
    const next = structuredClone(prev);
    const targetSpread = next.spec.spreads[pageIndex];
    if (!targetSpread) return prev;
    hydrateTextItems(targetSpread);
    if (!Array.isArray(targetSpread.text_items) || !targetSpread.text_items[index]) return prev;
    const source = targetSpread.text_items[index];
    targetSpread.text_items.splice(index + 1, 0, { ...source, id: `${source.id || 'note'}-copy-${Date.now()}`, x: Math.min(92, Number(source.x ?? 10) + 3), y: Math.min(90, Number(source.y ?? 10) + 3) });
    return next;
  }), [hydrateTextItems, onAlbumChange, pageIndex]);

  const duplicateDecor = React.useCallback((index: number) => onAlbumChange((prev) => {
    const next = structuredClone(prev);
    const targetSpread = next.spec.spreads[pageIndex];
    if (!targetSpread || !Array.isArray(targetSpread.decor_items) || !targetSpread.decor_items[index]) return prev;
    const source = targetSpread.decor_items[index];
    targetSpread.decor_items.splice(index + 1, 0, { ...source, id: `${source.id || 'decor'}-copy-${Date.now()}`, x: Math.min(94, Number(source.x ?? 20) + 4), y: Math.min(92, Number(source.y ?? 20) + 4) });
    return next;
  }), [onAlbumChange, pageIndex]);

  const deleteMedia = React.useCallback((index: number) => onAlbumChange((prev) => {
    const next = structuredClone(prev);
    const targetSpread = next.spec.spreads[pageIndex];
    if (!targetSpread || !Array.isArray(targetSpread.images)) return prev;
    targetSpread.images.splice(index, 1);
    return next;
  }), [onAlbumChange, pageIndex]);

  const deleteNote = React.useCallback((index: number) => onAlbumChange((prev) => {
    const next = structuredClone(prev);
    const targetSpread = next.spec.spreads[pageIndex];
    if (!targetSpread) return prev;
    hydrateTextItems(targetSpread);
    if (!Array.isArray(targetSpread.text_items)) return prev;
    targetSpread.text_items.splice(index, 1);
    return next;
  }), [hydrateTextItems, onAlbumChange, pageIndex]);

  const deleteDecor = React.useCallback((index: number) => onAlbumChange((prev) => {
    const next = structuredClone(prev);
    const targetSpread = next.spec.spreads[pageIndex];
    if (!targetSpread || !Array.isArray(targetSpread.decor_items)) return prev;
    targetSpread.decor_items.splice(index, 1);
    return next;
  }), [onAlbumChange, pageIndex]);

  return {
    deleteListMedia,
    deleteListText,
    moveMedia,
    moveNote,
    moveDecor,
    editNoteText,
    editMediaCaption,
    editDecor,
    duplicateMedia,
    duplicateNote,
    duplicateDecor,
    deleteMedia,
    deleteNote,
    deleteDecor,
  };
}
