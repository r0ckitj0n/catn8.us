import React from 'react';

import {
  clamp,
  constrainEditableLayout,
  constrainLayout,
  LayoutConstraints,
  LayoutItem,
  ResizeState,
} from '../photoAlbumStageEngine';
import { DecorItem, NoteItem } from '../photoAlbumStageEngine';
import { usePhotoAlbumStageSelectionActions } from './usePhotoAlbumStageSelectionActions';

type DraggingState = null | { type: 'media' | 'note' | 'decor'; index: number; sourceIndex?: number };

export function usePhotoAlbumStageInteractions({
  editable,
  isLayoutLocked,
  spreadIndex,
  layoutConstraints,
  layoutByType,
  notes,
  decorItems,
  mediaItems,
  onMoveMedia,
  onMoveNote,
  onMoveDecor,
  onEditMediaCaption,
  onEditNoteText,
  onEditDecor,
  onDuplicateMedia,
  onDuplicateNote,
  onDuplicateDecor,
  onDeleteMedia,
  onDeleteNote,
  onDeleteDecor,
  setViewerTarget,
}: {
  editable: boolean;
  isLayoutLocked: boolean;
  spreadIndex: number;
  layoutConstraints: LayoutConstraints;
  layoutByType: { mediaByIndex: Map<number, LayoutItem>; noteByIndex: Map<number, LayoutItem>; decorByIndex: Map<number, LayoutItem> };
  notes: NoteItem[];
  decorItems: DecorItem[];
  mediaItems: Array<{ caption: string }>;
  onMoveMedia?: (index: number, patch: { x: number; y: number; w?: number; h?: number }) => void;
  onMoveNote?: (noteId: string, index: number, patch: { x: number; y: number; w?: number; h?: number }) => void;
  onMoveDecor?: (index: number, patch: { x: number; y: number; emoji?: string; size?: number; rotation?: number }) => void;
  onEditMediaCaption?: (index: number, nextCaption: string) => void;
  onEditNoteText?: (index: number, nextText: string) => void;
  onEditDecor?: (index: number, patch: { emoji?: string; size?: number }) => void;
  onDuplicateMedia?: (index: number) => void;
  onDuplicateNote?: (index: number) => void;
  onDuplicateDecor?: (index: number) => void;
  onDeleteMedia?: (index: number) => void;
  onDeleteNote?: (index: number) => void;
  onDeleteDecor?: (index: number) => void;
  setViewerTarget: (target: any) => void;
}) {
  const [dragging, setDragging] = React.useState<DraggingState>(null);
  const [resizing, setResizing] = React.useState<ResizeState | null>(null);
  const dragStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const dragMovedRef = React.useRef(false);
  const suppressClickRef = React.useRef(false);

  const selection = usePhotoAlbumStageSelectionActions({
    editable,
    isLayoutLocked,
    spreadIndex,
    layoutByType,
    notes,
    decorItems,
    mediaItems,
    onEditMediaCaption,
    onEditNoteText,
    onEditDecor,
    onDuplicateMedia,
    onDuplicateNote,
    onDuplicateDecor,
    onDeleteMedia,
    onDeleteNote,
    onDeleteDecor,
    setViewerTarget,
    suppressClickRef,
  });

  const applyDragPosition = React.useCallback((canvasEl: HTMLDivElement | null, clientX: number, clientY: number) => {
    if (!editable || isLayoutLocked || !dragging || resizing || !canvasEl) return;
    if (dragStartRef.current) {
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;
      if ((dx * dx) + (dy * dy) > 16) dragMovedRef.current = true;
    }
    const canvas = canvasEl.getBoundingClientRect();
    const currentLayout = dragging.type === 'media' ? layoutByType.mediaByIndex.get(dragging.index)
      : dragging.type === 'note' ? layoutByType.noteByIndex.get(dragging.index)
      : layoutByType.decorByIndex.get(dragging.index);
    const baseItem = { id: `${dragging.type}-${dragging.index}`, type: dragging.type, index: dragging.index, sourceIndex: dragging.sourceIndex, x: ((clientX - canvas.left) / canvas.width) * 100, y: ((clientY - canvas.top) / canvas.height) * 100, w: currentLayout?.w ?? 8, h: currentLayout?.h ?? 8, rotation: 0 } as LayoutItem;
    const constrained = (editable && !isLayoutLocked) ? constrainEditableLayout(baseItem, layoutConstraints) : constrainLayout(baseItem, layoutConstraints);
    if (dragging.type === 'media' && onMoveMedia) onMoveMedia(dragging.sourceIndex ?? dragging.index, { x: constrained.x, y: constrained.y });
    if (dragging.type === 'note' && onMoveNote) onMoveNote(notes[dragging.index]?.id || `text-${dragging.index}`, dragging.index, { x: constrained.x, y: constrained.y });
    if (dragging.type === 'decor' && onMoveDecor) onMoveDecor(dragging.index, { x: constrained.x, y: constrained.y, emoji: decorItems[dragging.index]?.emoji, size: decorItems[dragging.index]?.size, rotation: decorItems[dragging.index]?.rotation });
  }, [decorItems, dragging, editable, isLayoutLocked, layoutByType, layoutConstraints, notes, onMoveDecor, onMoveMedia, onMoveNote, resizing]);

  const applyResizePosition = React.useCallback((canvasEl: HTMLDivElement | null, clientX: number, clientY: number) => {
    if (!editable || isLayoutLocked || !resizing || !canvasEl) return;
    const canvas = canvasEl.getBoundingClientRect();
    const deltaX = ((clientX - resizing.startClientX) / Math.max(1, canvas.width)) * 100;
    const deltaY = ((clientY - resizing.startClientY) / Math.max(1, canvas.height)) * 100;

    let nextX = resizing.startX;
    let nextY = resizing.startY;
    let nextW = resizing.startW;
    let nextH = resizing.startH;

    if (resizing.direction.includes('e')) nextW = resizing.startW + deltaX;
    if (resizing.direction.includes('w')) { nextW = resizing.startW - deltaX; nextX = resizing.startX + deltaX; }
    if (resizing.direction.includes('s')) nextH = resizing.startH + deltaY;
    if (resizing.direction.includes('n')) { nextH = resizing.startH - deltaY; nextY = resizing.startY + deltaY; }

    const limits = resizing.type === 'media' ? { minW: 9.5, maxW: 62, minH: 9.5, maxH: 74 } : resizing.type === 'note' ? { minW: 10.5, maxW: 58, minH: 8.2, maxH: 72 } : { minW: 3.2, maxW: 10.6, minH: 3.2, maxH: 10.6 };
    nextW = clamp(nextW, limits.minW, limits.maxW);
    nextH = clamp(nextH, limits.minH, limits.maxH);

    const baseItem = { id: `${resizing.type}-${resizing.index}`, type: resizing.type, index: resizing.index, sourceIndex: resizing.sourceIndex, x: nextX, y: nextY, w: nextW, h: nextH, rotation: 0 } as LayoutItem;
    const constrained = (editable && !isLayoutLocked) ? constrainEditableLayout(baseItem, layoutConstraints) : constrainLayout(baseItem, layoutConstraints);
    if (resizing.type === 'media' && onMoveMedia) onMoveMedia(resizing.sourceIndex ?? resizing.index, { x: constrained.x, y: constrained.y, w: constrained.w, h: constrained.h });
    if (resizing.type === 'note' && onMoveNote) onMoveNote(notes[resizing.index]?.id || `text-${resizing.index}`, resizing.index, { x: constrained.x, y: constrained.y, w: constrained.w, h: constrained.h });
    if (resizing.type === 'decor' && onMoveDecor) onMoveDecor(resizing.index, { x: constrained.x, y: constrained.y, size: clamp(constrained.w / 4.6, 0.65, 2.3), emoji: decorItems[resizing.index]?.emoji, rotation: decorItems[resizing.index]?.rotation });
  }, [decorItems, editable, isLayoutLocked, layoutConstraints, notes, onMoveDecor, onMoveMedia, onMoveNote, resizing]);

  const endDragging = React.useCallback(() => {
    if (dragMovedRef.current) {
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 180);
    }
    dragMovedRef.current = false;
    dragStartRef.current = null;
    setDragging(null);
    setResizing(null);
  }, []);

  const bindWindowDragHandlers = React.useCallback((canvasRef: React.RefObject<HTMLDivElement | null>) => {
    if (!editable || isLayoutLocked || (!dragging && !resizing)) return () => {};
    const onWindowMove = (event: PointerEvent) => {
      if (resizing) applyResizePosition(canvasRef.current, event.clientX, event.clientY);
      else applyDragPosition(canvasRef.current, event.clientX, event.clientY);
    };
    const onWindowUp = () => endDragging();
    window.addEventListener('pointermove', onWindowMove);
    window.addEventListener('pointerup', onWindowUp);
    window.addEventListener('pointercancel', onWindowUp);
    return () => {
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowUp);
    };
  }, [applyDragPosition, applyResizePosition, dragging, editable, endDragging, isLayoutLocked, resizing]);

  const onDecorPointerDown = React.useCallback((index: number, event: React.PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;
    event.preventDefault();
    event.stopPropagation();
    selection.setSelectedItem({ type: 'decor', index });
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    dragMovedRef.current = false;
    setDragging({ type: 'decor', index });
  }, [selection]);

  const onMediaPointerDown = React.useCallback((index: number, sourceIndex: number, event: React.PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('video')) return;
    event.preventDefault();
    event.stopPropagation();
    selection.setSelectedItem({ type: 'media', index, sourceIndex });
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    dragMovedRef.current = false;
    setDragging({ type: 'media', index, sourceIndex });
  }, [selection]);

  const onNotePointerDown = React.useCallback((index: number, event: React.PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;
    event.preventDefault();
    event.stopPropagation();
    selection.setSelectedItem({ type: 'note', index });
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    dragMovedRef.current = false;
    setDragging({ type: 'note', index });
  }, [selection]);

  return {
    dragging,
    resizing,
    selectedItem: selection.selectedItem,
    setSelectedItem: selection.setSelectedItem,
    setDragging,
    setResizing,
    endDragging,
    bindWindowDragHandlers,
    onItemClick: selection.onItemClick,
    selectedItemActionsStyle: selection.selectedItemActionsStyle,
    onDecorPointerDown,
    onMediaPointerDown,
    onNotePointerDown,
    onViewSelected: selection.onViewSelected,
    onEditSelected: selection.onEditSelected,
    onDuplicateSelected: selection.onDuplicateSelected,
    onDeleteSelected: selection.onDeleteSelected,
  };
}
