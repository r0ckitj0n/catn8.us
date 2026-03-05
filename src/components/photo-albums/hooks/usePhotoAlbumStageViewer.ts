import React from 'react';

import { PhotoAlbum } from '../../../types/photoAlbums';
import { sanitizeAlbumMessageText } from '../../../utils/photoAlbumText';
import { findAdjacentItemTarget, formatNoteText, spreadMedia, spreadNotes } from '../photoAlbumStageEngine';
import { ViewerTarget } from '../types';

export function usePhotoAlbumStageViewer({
  album,
  spreadIndex,
  contactDisplayName,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  album: PhotoAlbum;
  spreadIndex: number;
  contactDisplayName?: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const [viewerTarget, setViewerTarget] = React.useState<ViewerTarget | null>(null);

  const activeMedia = React.useMemo(() => {
    if (!viewerTarget || viewerTarget.type !== 'media') {
      return null;
    }
    const list = spreadMedia(album, viewerTarget.spreadIndex);
    return list[viewerTarget.itemIndex] || null;
  }, [album, viewerTarget]);

  const activeNote = React.useMemo(() => {
    if (!viewerTarget || viewerTarget.type !== 'note') {
      return null;
    }
    const list = spreadNotes(album, viewerTarget.spreadIndex, spreadMedia(album, viewerTarget.spreadIndex), contactDisplayName);
    const note = list[viewerTarget.itemIndex];
    return note ? formatNoteText(note) : '';
  }, [album, viewerTarget, contactDisplayName]);

  const prevTarget = viewerTarget ? findAdjacentItemTarget(album, viewerTarget, -1, contactDisplayName) : null;
  const nextTarget = viewerTarget ? findAdjacentItemTarget(album, viewerTarget, 1, contactDisplayName) : null;

  const activeViewerNote = React.useMemo(() => {
    if (!viewerTarget || viewerTarget.type !== 'note') {
      return null;
    }
    const list = spreadNotes(album, viewerTarget.spreadIndex, spreadMedia(album, viewerTarget.spreadIndex), contactDisplayName);
    return list[viewerTarget.itemIndex] || null;
  }, [album, viewerTarget, contactDisplayName]);

  const viewerDateLabel = React.useMemo(() => {
    if (!viewerTarget) {
      return '';
    }
    if (viewerTarget.type === 'media' && activeMedia?.capturedAtMs) {
      return new Date(activeMedia.capturedAtMs).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    const spreadForTarget = album.spec?.spreads?.[viewerTarget.spreadIndex];
    const spreadCaptured = spreadMedia(album, viewerTarget.spreadIndex)
      .map((item) => item.capturedAtMs)
      .filter((value): value is number => Number.isFinite(value));
    if (spreadCaptured.length > 0) {
      return new Date(Math.min(...spreadCaptured)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    return sanitizeAlbumMessageText(spreadForTarget?.title || '');
  }, [activeMedia?.capturedAtMs, album, viewerTarget]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'VIDEO') {
          return;
        }
      }

      if (event.key === 'ArrowLeft') {
        if (viewerTarget) {
          if (prevTarget) {
            event.preventDefault();
            setViewerTarget(prevTarget);
          }
          return;
        }
        if (canPrev && typeof onPrev === 'function') {
          event.preventDefault();
          onPrev();
        }
        return;
      }

      if (event.key === 'ArrowRight') {
        if (viewerTarget) {
          if (nextTarget) {
            event.preventDefault();
            setViewerTarget(nextTarget);
          }
          return;
        }
        if (canNext && typeof onNext === 'function') {
          event.preventDefault();
          onNext();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [canNext, canPrev, nextTarget, onNext, onPrev, prevTarget, viewerTarget]);

  return {
    viewerTarget,
    setViewerTarget,
    activeMedia,
    activeNote,
    activeViewerNote,
    prevTarget,
    nextTarget,
    viewerDateLabel,
  };
}
