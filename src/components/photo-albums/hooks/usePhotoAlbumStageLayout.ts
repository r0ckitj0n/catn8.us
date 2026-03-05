import React from 'react';

import {
  CANVAS_MAX_X,
  CANVAS_MAX_Y,
  CANVAS_MIN_X,
  CANVAS_MIN_Y,
  clamp,
  LayoutConstraints,
  LayoutRect,
  RESERVED_PADDING_PCT,
} from '../photoAlbumStageEngine';
import { DecorItem, NoteItem } from '../photoAlbumStageEngine';
import { PreparedMediaItem } from '../types';
import { computePhotoAlbumLayoutByType } from './photoAlbumStageLayoutByType';

export function usePhotoAlbumStageLayout({
  albumId,
  spreadIndex,
  spreadTitle,
  canvasWidthPx,
  canvasHeightPx,
  spreadBackgroundImageUrl,
  mediaItems,
  notes,
  decorItems,
  mediaWidthPct,
  noteWidthPct,
  densityCount,
  respectSavedPositions,
  editable,
  isLayoutLocked,
  zoom,
}: {
  albumId: number;
  spreadIndex: number;
  spreadTitle?: string;
  canvasWidthPx: number;
  canvasHeightPx: number;
  spreadBackgroundImageUrl: string;
  mediaItems: PreparedMediaItem[];
  notes: NoteItem[];
  decorItems: DecorItem[];
  mediaWidthPct: number;
  noteWidthPct: number;
  densityCount: number;
  respectSavedPositions: boolean;
  editable: boolean;
  isLayoutLocked: boolean;
  zoom: number;
}) {
  const scatterRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const headerRef = React.useRef<HTMLDivElement | null>(null);
  const [fittedCanvasSize, setFittedCanvasSize] = React.useState<{ width: number; height: number } | null>(null);
  const [reservedHeaderRect, setReservedHeaderRect] = React.useState<LayoutRect | null>(null);

  React.useLayoutEffect(() => {
    const scatterEl = scatterRef.current;
    if (!scatterEl || canvasWidthPx <= 0 || canvasHeightPx <= 0) {
      return undefined;
    }

    const updateSize = () => {
      const box = scatterEl.getBoundingClientRect();
      const style = window.getComputedStyle(scatterEl);
      const padX = (parseFloat(style.paddingLeft || '0') || 0) + (parseFloat(style.paddingRight || '0') || 0);
      const padY = (parseFloat(style.paddingTop || '0') || 0) + (parseFloat(style.paddingBottom || '0') || 0);
      const availableW = Math.max(80, box.width - padX);
      const availableH = Math.max(80, box.height - padY);
      let nextWidth = Math.max(80, Math.floor(canvasWidthPx));
      let nextHeight = Math.max(80, Math.floor(canvasHeightPx));

      if (editable) {
        const scale = availableW / canvasWidthPx;
        nextWidth = Math.max(80, Math.floor(canvasWidthPx * scale));
        nextHeight = Math.max(80, Math.floor(canvasHeightPx * scale));
      } else {
        nextWidth = Math.max(80, Math.floor(availableW));
        nextHeight = Math.max(80, Math.floor(availableH));
      }
      setFittedCanvasSize((prev) => {
        if (prev && Math.abs(prev.width - nextWidth) < 1 && Math.abs(prev.height - nextHeight) < 1) {
          return prev;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };

    updateSize();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateSize())
      : null;
    observer?.observe(scatterEl);
    window.addEventListener('resize', updateSize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [canvasWidthPx, canvasHeightPx, editable, zoom, spreadIndex, albumId]);

  React.useEffect(() => {
    const measure = () => {
      const headerEl = headerRef.current;
      const canvasEl = canvasRef.current;
      if (!headerEl || !canvasEl) {
        setReservedHeaderRect(null);
        return;
      }
      const headerBox = headerEl.getBoundingClientRect();
      const canvasBox = canvasEl.getBoundingClientRect();
      if (canvasBox.width <= 0 || canvasBox.height <= 0) {
        setReservedHeaderRect(null);
        return;
      }
      const x = ((headerBox.left - canvasBox.left) / canvasBox.width) * 100;
      const y = ((headerBox.top - canvasBox.top) / canvasBox.height) * 100;
      const w = (headerBox.width / canvasBox.width) * 100;
      const h = (headerBox.height / canvasBox.height) * 100;
      const next: LayoutRect = {
        x: clamp(x - RESERVED_PADDING_PCT, CANVAS_MIN_X, CANVAS_MAX_X),
        y: clamp(y - RESERVED_PADDING_PCT, CANVAS_MIN_Y, CANVAS_MAX_Y),
        w: clamp(w + (RESERVED_PADDING_PCT * 2), 0, CANVAS_MAX_X - CANVAS_MIN_X),
        h: clamp(h + (RESERVED_PADDING_PCT * 2), 0, CANVAS_MAX_Y - CANVAS_MIN_Y),
      };
      setReservedHeaderRect(next);
    };

    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    const timer = window.setTimeout(measure, 80);
    return () => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(timer);
    };
  }, [albumId, spreadIndex, zoom, notes.length, mediaItems.length, decorItems.length]);

  const layoutConstraints = React.useMemo<LayoutConstraints>(() => ({
    minX: CANVAS_MIN_X,
    maxX: CANVAS_MAX_X,
    minY: CANVAS_MIN_Y,
    maxY: CANVAS_MAX_Y,
    reserved: reservedHeaderRect ? [reservedHeaderRect] : [],
  }), [reservedHeaderRect]);

  const layoutByType = React.useMemo(() => (
    computePhotoAlbumLayoutByType({
      albumId,
      spreadIndex,
      spreadTitle: spreadTitle || '',
      mediaItems,
      notes,
      decorItems,
      mediaWidthPct,
      noteWidthPct,
      densityCount,
      editable,
      isLayoutLocked,
      respectSavedPositions,
      layoutConstraints,
    })
  ), [albumId, spreadIndex, spreadTitle, mediaItems, notes, decorItems, mediaWidthPct, noteWidthPct, densityCount, editable, isLayoutLocked, respectSavedPositions, layoutConstraints]);

  const renderMediaStyle = React.useCallback((index: number): React.CSSProperties => {
    const placement = layoutByType.mediaByIndex.get(index);
    const widthPct = placement?.w ?? mediaWidthPct;
    const captionFontRem = clamp(0.92 + ((widthPct - 14) * 0.018), 0.92, 1.32);
    return { left: `${placement?.x ?? CANVAS_MIN_X}%`, top: `${placement?.y ?? CANVAS_MIN_Y}%`, width: `${widthPct}%`, ['--catn8-caption-font-size' as string]: `${captionFontRem.toFixed(2)}rem`, transform: `rotate(${placement?.rotation ?? 0}deg) scale(var(--catn8-card-scale, 1))`, zIndex: 8 + (index % 4), cursor: editable && !isLayoutLocked ? 'grab' : 'pointer', touchAction: editable && !isLayoutLocked ? 'none' : 'auto' };
  }, [editable, isLayoutLocked, layoutByType.mediaByIndex, mediaWidthPct]);

  const renderNoteStyle = React.useCallback((_note: NoteItem, index: number): React.CSSProperties => {
    const placement = layoutByType.noteByIndex.get(index);
    const widthPct = placement?.w ?? noteWidthPct;
    const noteFontRem = clamp(0.95 + ((widthPct - 14) * 0.02), 0.95, 1.42);
    return { left: `${placement?.x ?? CANVAS_MIN_X}%`, top: `${placement?.y ?? CANVAS_MIN_Y}%`, width: `${widthPct}%`, ['--catn8-note-font-size' as string]: `${noteFontRem.toFixed(2)}rem`, transform: `rotate(${placement?.rotation ?? 0}deg) scale(var(--catn8-card-scale, 1))`, zIndex: 20 + (index % 4), cursor: editable && !isLayoutLocked ? 'grab' : 'pointer', touchAction: editable && !isLayoutLocked ? 'none' : 'auto' };
  }, [editable, isLayoutLocked, layoutByType.noteByIndex, noteWidthPct]);

  const renderDecorStyle = React.useCallback((_item: DecorItem, index: number): React.CSSProperties => {
    const placement = layoutByType.decorByIndex.get(index);
    return { left: `${placement?.x ?? CANVAS_MIN_X}%`, top: `${placement?.y ?? CANVAS_MIN_Y}%`, transform: `rotate(${placement?.rotation ?? 0}deg) scale(${placement?.size ?? 1})`, zIndex: 2, pointerEvents: editable ? 'auto' : 'none', touchAction: editable ? 'none' : 'auto' };
  }, [editable, layoutByType.decorByIndex]);

  const effectiveZoom = respectSavedPositions ? 1 : (editable ? 1 : zoom);
  const scatterStyle: React.CSSProperties = { transform: `scale(${effectiveZoom})` };
  const canvasStyle: React.CSSProperties = {
    aspectRatio: `${canvasWidthPx} / ${canvasHeightPx}`,
    ...(fittedCanvasSize ? { width: `${fittedCanvasSize.width}px`, height: `${fittedCanvasSize.height}px` } : {}),
    ...(spreadBackgroundImageUrl ? { backgroundImage: `linear-gradient(rgba(255,255,255,0.1), rgba(255,255,255,0.1)), url(${spreadBackgroundImageUrl})`, backgroundSize: '100% 100%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : {}),
  };

  return {
    scatterRef,
    canvasRef,
    headerRef,
    layoutConstraints,
    layoutByType,
    renderMediaStyle,
    renderNoteStyle,
    renderDecorStyle,
    scatterStyle,
    canvasStyle,
  };
}
