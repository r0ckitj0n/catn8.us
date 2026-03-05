import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';
import { formatNoteText, isTranscriptCaption, isVideoMedia } from './photoAlbumStageEngine';
import { PhotoAlbumStageCanvas } from './PhotoAlbumStageCanvas';
import { PhotoAlbumElementViewer } from './PhotoAlbumElementViewer';
import { usePhotoAlbumStageInteractions } from './hooks/usePhotoAlbumStageInteractions';
import { usePhotoAlbumStageLayout } from './hooks/usePhotoAlbumStageLayout';
import { usePhotoAlbumStagePrepared } from './hooks/usePhotoAlbumStagePrepared';
import { usePhotoAlbumStageViewer } from './hooks/usePhotoAlbumStageViewer';

export interface PhotoAlbumStageProps {
  album: PhotoAlbum;
  spreadIndex: number;
  zoom: number;
  contactDisplayName?: string;
  respectSavedPositions?: boolean;
  pageFavorite?: boolean;
  isMediaFavorite?: (spreadIndex: number, mediaSourceIndex: number) => boolean;
  isTextFavorite?: (spreadIndex: number, textItemId: string) => boolean;
  canPrev?: boolean;
  canNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onTogglePageFavorite?: (spreadIndex: number) => void;
  onToggleMediaFavorite?: (spreadIndex: number, mediaSourceIndex: number) => void;
  onToggleTextFavorite?: (spreadIndex: number, textItemId: string) => void;
  pageLocked?: boolean;
  albumLocked?: boolean;
  onTogglePageLock?: (spreadIndex: number) => void;
  onToggleAlbumLock?: () => void;
  editable?: boolean;
  onMoveMedia?: (index: number, patch: { x: number; y: number; w?: number; h?: number }) => void;
  onMoveNote?: (noteId: string, index: number, patch: { x: number; y: number; w?: number; h?: number }) => void;
  onMoveDecor?: (index: number, patch: { x: number; y: number; emoji?: string; size?: number; rotation?: number }) => void;
  onEditNoteText?: (index: number, nextText: string) => void;
  onEditMediaCaption?: (index: number, nextCaption: string) => void;
  onEditDecor?: (index: number, patch: { emoji?: string; size?: number }) => void;
  onDuplicateMedia?: (index: number) => void;
  onDuplicateNote?: (index: number) => void;
  onDuplicateDecor?: (index: number) => void;
  onDeleteMedia?: (index: number) => void;
  onDeleteNote?: (index: number) => void;
  onDeleteDecor?: (index: number) => void;
  onBackToAlbums?: () => void;
}

export function PhotoAlbumStageImpl({
  album,
  spreadIndex,
  zoom,
  contactDisplayName,
  respectSavedPositions = false,
  pageFavorite = false,
  isMediaFavorite,
  isTextFavorite,
  canPrev = false,
  canNext = false,
  onPrev,
  onNext,
  onTogglePageFavorite,
  onToggleMediaFavorite,
  onToggleTextFavorite,
  pageLocked = false,
  albumLocked = false,
  onTogglePageLock,
  onToggleAlbumLock,
  editable = false,
  onMoveMedia,
  onMoveNote,
  onMoveDecor,
  onEditNoteText,
  onEditMediaCaption,
  onEditDecor,
  onDuplicateMedia,
  onDuplicateNote,
  onDuplicateDecor,
  onDeleteMedia,
  onDeleteNote,
  onDeleteDecor,
  onBackToAlbums,
}: PhotoAlbumStageProps) {
  const isLayoutLocked = albumLocked || pageLocked;

  const prepared = usePhotoAlbumStagePrepared({ album, spreadIndex, contactDisplayName });

  const layout = usePhotoAlbumStageLayout({
    albumId: album.id,
    spreadIndex,
    spreadTitle: prepared.spread?.title || '',
    canvasWidthPx: prepared.canvasWidthPx,
    canvasHeightPx: prepared.canvasHeightPx,
    spreadBackgroundImageUrl: prepared.spreadBackgroundImageUrl,
    mediaItems: prepared.mediaItems,
    notes: prepared.notes,
    decorItems: prepared.decorItems,
    mediaWidthPct: prepared.mediaWidthPct,
    noteWidthPct: prepared.noteWidthPct,
    densityCount: prepared.densityCount,
    respectSavedPositions,
    editable,
    isLayoutLocked,
    zoom,
  });

  const viewer = usePhotoAlbumStageViewer({
    album,
    spreadIndex,
    contactDisplayName,
    canPrev,
    canNext,
    onPrev,
    onNext,
  });

  const interactions = usePhotoAlbumStageInteractions({
    editable,
    isLayoutLocked,
    spreadIndex,
    layoutConstraints: layout.layoutConstraints,
    layoutByType: layout.layoutByType,
    notes: prepared.notes,
    decorItems: prepared.decorItems,
    mediaItems: prepared.mediaItems,
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
    setViewerTarget: viewer.setViewerTarget,
  });

  React.useEffect(() => {
    viewer.setViewerTarget(null);
    interactions.setDragging(null);
    interactions.setResizing(null);
    interactions.setSelectedItem(null);
  }, [album.id, spreadIndex]);

  React.useEffect(() => interactions.bindWindowDragHandlers(layout.canvasRef), [interactions, layout.canvasRef]);

  const canFavoriteCurrentPage = album.id > 0 && !album.is_virtual && typeof onTogglePageFavorite === 'function';
  const canFavoriteCurrentMedia = album.id > 0 && !album.is_virtual && typeof onToggleMediaFavorite === 'function' && viewer.viewerTarget?.type === 'media' && Boolean(viewer.activeMedia);
  const canFavoriteCurrentText = album.id > 0 && !album.is_virtual && typeof onToggleTextFavorite === 'function' && viewer.viewerTarget?.type === 'note';
  const activeMediaFavorited = (canFavoriteCurrentMedia && viewer.activeMedia && typeof isMediaFavorite === 'function') ? isMediaFavorite(viewer.viewerTarget?.spreadIndex ?? spreadIndex, viewer.activeMedia.sourceIndex) : false;
  const activeNoteFavorited = (canFavoriteCurrentText && viewer.activeViewerNote && typeof isTextFavorite === 'function' && viewer.viewerTarget) ? isTextFavorite(viewer.viewerTarget.spreadIndex, viewer.activeViewerNote.id) : false;

  return (
    <>
      <PhotoAlbumStageCanvas
        scatterRef={layout.scatterRef}
        canvasRef={layout.canvasRef}
        headerRef={layout.headerRef}
        scatterStyle={layout.scatterStyle}
        canvasStyle={layout.canvasStyle}
        themeName={prepared.theme.name}
        spreadIndex={spreadIndex}
        spreadHeaderLabel={prepared.spreadHeaderLabel}
        themeBorderColor={prepared.theme.borderColor}
        themeAccentColor={prepared.theme.accentColor}
        themeEmojis={prepared.theme.emojis}
        canPrev={canPrev}
        canNext={canNext}
        onPrev={onPrev}
        onNext={onNext}
        canFavoriteCurrentPage={canFavoriteCurrentPage}
        pageFavorite={pageFavorite}
        onTogglePageFavorite={onTogglePageFavorite}
        pageLocked={pageLocked}
        albumLocked={albumLocked}
        onTogglePageLock={onTogglePageLock}
        onToggleAlbumLock={onToggleAlbumLock}
        onBackToAlbums={onBackToAlbums}
        editable={editable}
        isLayoutLocked={isLayoutLocked}
        dragging={interactions.dragging}
        resizing={interactions.resizing}
        endDragging={interactions.endDragging}
        decorItems={prepared.decorItems}
        mediaItems={prepared.mediaItems}
        notes={prepared.notes}
        selectedItem={interactions.selectedItem}
        isMediaFavorite={isMediaFavorite}
        isTextFavorite={isTextFavorite}
        albumId={album.id}
        albumIsVirtual={Boolean(album.is_virtual)}
        onToggleMediaFavorite={onToggleMediaFavorite}
        onToggleTextFavorite={onToggleTextFavorite}
        onEditNoteText={onEditNoteText}
        onDecorPointerDown={interactions.onDecorPointerDown}
        onMediaPointerDown={interactions.onMediaPointerDown}
        onNotePointerDown={interactions.onNotePointerDown}
        onItemClick={interactions.onItemClick}
        renderDecorStyle={layout.renderDecorStyle}
        renderMediaStyle={layout.renderMediaStyle}
        renderNoteStyle={layout.renderNoteStyle}
        formatNoteText={formatNoteText}
        isTranscriptCaption={isTranscriptCaption}
        isVideoMedia={isVideoMedia}
        selectedItemActionsStyle={interactions.selectedItemActionsStyle}
        onViewSelected={interactions.onViewSelected}
        onEditSelected={interactions.onEditSelected}
        onDuplicateSelected={interactions.onDuplicateSelected}
        onDeleteSelected={interactions.onDeleteSelected}
        onClearSelected={() => interactions.setSelectedItem(null)}
      />

      {viewer.viewerTarget ? (
        <PhotoAlbumElementViewer
          target={viewer.viewerTarget}
          activeMedia={viewer.activeMedia}
          activeNote={viewer.activeNote}
          dateLabel={viewer.viewerDateLabel}
          activeMediaFavorite={activeMediaFavorited}
          activeNoteFavorite={activeNoteFavorited}
          prevTarget={viewer.prevTarget}
          nextTarget={viewer.nextTarget}
          onToggleActiveMediaFavorite={canFavoriteCurrentMedia && viewer.activeMedia ? () => {
            onToggleMediaFavorite?.(viewer.viewerTarget!.spreadIndex, viewer.activeMedia!.sourceIndex);
          } : undefined}
          onToggleActiveNoteFavorite={canFavoriteCurrentText && viewer.activeViewerNote && viewer.viewerTarget ? () => {
            onToggleTextFavorite?.(viewer.viewerTarget!.spreadIndex, viewer.activeViewerNote!.id);
          } : undefined}
          onClose={() => viewer.setViewerTarget(null)}
          onNavigate={viewer.setViewerTarget}
        />
      ) : null}
    </>
  );
}
