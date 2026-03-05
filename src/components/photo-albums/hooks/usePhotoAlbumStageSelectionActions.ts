import React from 'react';

import {
  CANVAS_MAX_X,
  CANVAS_MAX_Y,
  CANVAS_MIN_X,
  CANVAS_MIN_Y,
  clamp,
  LayoutItem,
  SelectedItem,
} from '../photoAlbumStageEngine';
import { ViewerType } from '../types';
import { DecorItem, NoteItem } from '../photoAlbumStageEngine';

export function usePhotoAlbumStageSelectionActions({
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
}: {
  editable: boolean;
  isLayoutLocked: boolean;
  spreadIndex: number;
  layoutByType: {
    mediaByIndex: Map<number, LayoutItem>;
    noteByIndex: Map<number, LayoutItem>;
    decorByIndex: Map<number, LayoutItem>;
  };
  notes: NoteItem[];
  decorItems: DecorItem[];
  mediaItems: Array<{ caption: string }>;
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
  suppressClickRef: React.MutableRefObject<boolean>;
}) {
  const [selectedItem, setSelectedItem] = React.useState<SelectedItem | null>(null);

  const onItemClick = React.useCallback((item: SelectedItem, viewerType: ViewerType | null) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (editable) {
      setSelectedItem(item);
      return;
    }
    if (viewerType) {
      setViewerTarget({ type: viewerType, spreadIndex, itemIndex: item.index });
    }
  }, [editable, setViewerTarget, spreadIndex, suppressClickRef]);

  const selectedItemActionsStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    if (!editable || !selectedItem) {
      return undefined;
    }
    const selectedLayout = selectedItem.type === 'media' ? layoutByType.mediaByIndex.get(selectedItem.index)
      : selectedItem.type === 'note' ? layoutByType.noteByIndex.get(selectedItem.index)
      : layoutByType.decorByIndex.get(selectedItem.index);
    if (!selectedLayout) {
      return undefined;
    }
    return {
      left: `${clamp(selectedLayout.x + (selectedLayout.w / 2), CANVAS_MIN_X + 5, CANVAS_MAX_X - 5)}%`,
      top: `${clamp(selectedLayout.y + selectedLayout.h + 1.4, CANVAS_MIN_Y + 1, CANVAS_MAX_Y - 9)}%`,
      right: 'auto',
      bottom: 'auto',
      transform: 'translateX(-50%)',
    };
  }, [editable, layoutByType, selectedItem]);

  const onViewSelected = React.useCallback(() => {
    if (!selectedItem || selectedItem.type === 'decor') return;
    setViewerTarget({ type: selectedItem.type, spreadIndex, itemIndex: selectedItem.index });
  }, [selectedItem, setViewerTarget, spreadIndex]);

  const onEditSelected = React.useCallback(() => {
    if (!selectedItem || isLayoutLocked) return;
    if (selectedItem.type === 'media') {
      const media = mediaItems[selectedItem.index];
      if (!media || !onEditMediaCaption) return;
      const next = window.prompt('Edit media caption', media.caption || '');
      if (typeof next === 'string') onEditMediaCaption(selectedItem.sourceIndex ?? selectedItem.index, next.trim());
      return;
    }
    if (selectedItem.type === 'note') {
      if (!onEditNoteText) return;
      const selectedNote = notes[selectedItem.index];
      const preview = selectedNote ? `${selectedNote.speaker}${selectedNote.time ? ` (${selectedNote.time})` : ''}: ${selectedNote.text}` : '';
      const next = window.prompt('Edit text', preview);
      if (typeof next === 'string' && next.trim()) onEditNoteText(selectedItem.index, next.trim());
      return;
    }
    if (selectedItem.type === 'decor' && onEditDecor) {
      const current = decorItems[selectedItem.index];
      const nextEmoji = window.prompt('Edit emoji', current?.emoji || '✨');
      if (typeof nextEmoji === 'string' && nextEmoji.trim()) onEditDecor(selectedItem.index, { emoji: nextEmoji.trim() });
    }
  }, [decorItems, isLayoutLocked, mediaItems, notes, onEditDecor, onEditMediaCaption, onEditNoteText, selectedItem]);

  const onDuplicateSelected = React.useCallback(() => {
    if (!selectedItem || isLayoutLocked) return;
    if (selectedItem.type === 'media' && onDuplicateMedia) onDuplicateMedia(selectedItem.sourceIndex ?? selectedItem.index);
    if (selectedItem.type === 'note' && onDuplicateNote) onDuplicateNote(selectedItem.index);
    if (selectedItem.type === 'decor' && onDuplicateDecor) onDuplicateDecor(selectedItem.index);
  }, [isLayoutLocked, onDuplicateDecor, onDuplicateMedia, onDuplicateNote, selectedItem]);

  const onDeleteSelected = React.useCallback(() => {
    if (!selectedItem || isLayoutLocked) return;
    if (selectedItem.type === 'media' && onDeleteMedia) onDeleteMedia(selectedItem.sourceIndex ?? selectedItem.index);
    if (selectedItem.type === 'note' && onDeleteNote) onDeleteNote(selectedItem.index);
    if (selectedItem.type === 'decor' && onDeleteDecor) onDeleteDecor(selectedItem.index);
    setSelectedItem(null);
  }, [isLayoutLocked, onDeleteDecor, onDeleteMedia, onDeleteNote, selectedItem]);

  return {
    selectedItem,
    setSelectedItem,
    onItemClick,
    selectedItemActionsStyle,
    onViewSelected,
    onEditSelected,
    onDuplicateSelected,
    onDeleteSelected,
  };
}
