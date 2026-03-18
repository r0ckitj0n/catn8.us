import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';
import { toAlbumDisplayName } from '../../utils/photoAlbumText';
import { PhotoAlbumChronologicalList } from './PhotoAlbumChronologicalList';
import { PhotoAlbumStage } from './PhotoAlbumStage';

interface PhotoAlbumAdminPreviewPanelProps {
  album: PhotoAlbum;
  viewMode: 'album' | 'list';
  pageIndex: number;
  zoom: number;
  canPrev: boolean;
  canNext: boolean;
  pageFavorite: boolean;
  albumLocked: boolean;
  spreadLocked: boolean;
  isMediaFavorite?: (spreadIndex: number, mediaSourceIndex: number) => boolean;
  isTextFavorite?: (spreadIndex: number, textItemId: string) => boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onTogglePageFavorite?: (spreadIndex: number) => void;
  onToggleMediaFavorite?: (spreadIndex: number, mediaSourceIndex: number) => void;
  onToggleTextFavorite?: (spreadIndex: number, textItemId: string) => void;
  onToggleSpreadLock: () => void;
  onClose: () => void;
  onDeleteListMedia: (spreadIndex: number, mediaSourceIndex: number) => void;
  onDeleteListText: (spreadIndex: number, textItemId: string) => void;
  onMoveMedia: (index: number, patch: { x: number; y: number; w?: number; h?: number }) => void;
  onMoveNote: (noteId: string, index: number, patch: { x: number; y: number; w?: number; h?: number }) => void;
  onMoveDecor: (index: number, patch: { x: number; y: number; emoji?: string; size?: number; rotation?: number }) => void;
  onEditNoteText: (index: number, nextText: string) => void;
  onEditMediaCaption: (index: number, nextCaption: string) => void;
  onEditDecor: (index: number, patch: { emoji?: string; size?: number }) => void;
  onDuplicateMedia: (index: number) => void;
  onDuplicateNote: (index: number) => void;
  onDuplicateDecor: (index: number) => void;
  onDeleteMedia: (index: number) => void;
  onDeleteNote: (index: number) => void;
  onDeleteDecor: (index: number) => void;
}

export function PhotoAlbumAdminPreviewPanel(props: PhotoAlbumAdminPreviewPanelProps) {
  const {
    album,
    viewMode,
    pageIndex,
    zoom,
    canPrev,
    canNext,
    pageFavorite,
    albumLocked,
    spreadLocked,
    isMediaFavorite,
    isTextFavorite,
    onPrevPage,
    onNextPage,
    onTogglePageFavorite,
    onToggleMediaFavorite,
    onToggleTextFavorite,
    onToggleSpreadLock,
    onClose,
    onDeleteListMedia,
    onDeleteListText,
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
  } = props;

  return (
    <div className={viewMode === 'list' ? 'catn8-admin-preview-panel catn8-admin-preview-panel--list' : 'catn8-admin-preview-panel'}>
      {viewMode === 'list' ? (
        <PhotoAlbumChronologicalList
          album={album}
          contactDisplayName={toAlbumDisplayName(album.created_by_username || '')}
          editable
          isMediaFavorite={isMediaFavorite}
          isTextFavorite={isTextFavorite}
          onToggleMediaFavorite={onToggleMediaFavorite}
          onToggleTextFavorite={onToggleTextFavorite}
          onDeleteMedia={onDeleteListMedia}
          onDeleteText={onDeleteListText}
        />
      ) : (
        <PhotoAlbumStage
          album={album}
          spreadIndex={pageIndex}
          zoom={zoom}
          contactDisplayName={toAlbumDisplayName(album.created_by_username || '')}
          respectSavedPositions
          canPrev={canPrev}
          canNext={canNext}
          pageFavorite={pageFavorite}
          isMediaFavorite={isMediaFavorite}
          isTextFavorite={isTextFavorite}
          onPrev={onPrevPage}
          onNext={onNextPage}
          onTogglePageFavorite={onTogglePageFavorite}
          onToggleMediaFavorite={onToggleMediaFavorite}
          onToggleTextFavorite={onToggleTextFavorite}
          pageLocked={spreadLocked}
          albumLocked={albumLocked}
          onTogglePageLock={onToggleSpreadLock}
          onBackToAlbums={onClose}
          editable
          onMoveMedia={onMoveMedia}
          onMoveNote={onMoveNote}
          onMoveDecor={onMoveDecor}
          onEditNoteText={onEditNoteText}
          onEditMediaCaption={onEditMediaCaption}
          onEditDecor={onEditDecor}
          onDuplicateMedia={onDuplicateMedia}
          onDuplicateNote={onDuplicateNote}
          onDuplicateDecor={onDuplicateDecor}
          onDeleteMedia={onDeleteMedia}
          onDeleteNote={onDeleteNote}
          onDeleteDecor={onDeleteDecor}
        />
      )}
    </div>
  );
}
