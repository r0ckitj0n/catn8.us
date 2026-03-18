import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';
import { toAlbumDisplayName, toPhotoAlbumDisplaySummary, toPhotoAlbumDisplayTitle } from '../../utils/photoAlbumText';
import { AlbumViewMode } from '../../hooks/photo-albums/usePhotoAlbumsPageChrome';
import { PhotoAlbumChronologicalList } from './PhotoAlbumChronologicalList';
import { PhotoAlbumStage } from './PhotoAlbumStage';

interface PhotoAlbumViewerShellProps {
  album: PhotoAlbum;
  isAdmin: boolean;
  isFullscreen: boolean;
  viewMode: AlbumViewMode;
  pageIndex: number;
  zoom: number;
  canPrev: boolean;
  canNext: boolean;
  pageFavorite: boolean;
  albumLocked: boolean;
  pageLocked: boolean;
  isMediaFavorite: (spreadIndex: number, mediaSourceIndex: number) => boolean;
  isTextFavorite: (spreadIndex: number, textItemId: string) => boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onSetViewMode: (nextMode: AlbumViewMode) => void;
  onEditAlbum: () => void;
  onToggleAlbumLock: () => void;
  onEnterFullscreen: () => void;
  onClose: () => void;
  onTogglePageFavorite: (spreadIndex: number) => void;
  onToggleMediaFavorite: (spreadIndex: number, mediaSourceIndex: number) => void;
  onToggleTextFavorite: (spreadIndex: number, textItemId: string) => void;
  onTogglePageLock?: (spreadIndex: number) => void;
}

export function PhotoAlbumViewerShell({
  album,
  isAdmin,
  isFullscreen,
  viewMode,
  pageIndex,
  zoom,
  canPrev,
  canNext,
  pageFavorite,
  albumLocked,
  pageLocked,
  isMediaFavorite,
  isTextFavorite,
  onPrevPage,
  onNextPage,
  onSetViewMode,
  onEditAlbum,
  onToggleAlbumLock,
  onEnterFullscreen,
  onClose,
  onTogglePageFavorite,
  onToggleMediaFavorite,
  onToggleTextFavorite,
  onTogglePageLock,
}: PhotoAlbumViewerShellProps) {
  const viewerAlbumSummary = toPhotoAlbumDisplaySummary(album.summary || '');
  const contactDisplayName = toAlbumDisplayName(album.created_by_username || '');
  const shellClassName = isFullscreen
    ? 'catn8-photo-albums-main catn8-photo-albums-main--viewer is-fullscreen'
    : viewMode === 'list'
      ? 'catn8-photo-albums-main catn8-photo-albums-main--viewer catn8-photo-albums-main--list'
      : 'catn8-photo-albums-main catn8-photo-albums-main--viewer';

  return (
    <div className={shellClassName}>
      {!isFullscreen ? (
        <div className="catn8-album-toolbar catn8-card">
          <div className="catn8-album-toolbar-title-row">
            <h2 className="h4 mb-0">{toPhotoAlbumDisplayTitle(album.title)}</h2>
            {viewerAlbumSummary ? <div className="small text-muted">{viewerAlbumSummary}</div> : null}
          </div>
          <div className="catn8-album-controls">
            <div className="catn8-photo-albums-view-toggle" role="group" aria-label="View mode">
              <span className="catn8-photo-albums-view-toggle-label">View</span>
              <button
                type="button"
                className={viewMode === 'album' ? 'btn btn-sm btn-outline-secondary is-active' : 'btn btn-sm btn-outline-secondary'}
                onClick={() => onSetViewMode('album')}
                aria-pressed={viewMode === 'album'}
              >
                Album
              </button>
              <button
                type="button"
                className={viewMode === 'list' ? 'btn btn-sm btn-outline-secondary is-active' : 'btn btn-sm btn-outline-secondary'}
                onClick={() => onSetViewMode('list')}
                aria-pressed={viewMode === 'list'}
              >
                List
              </button>
            </div>
            {isAdmin ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={onEditAlbum}
              >
                Edit Album
              </button>
            ) : null}
            {isAdmin ? (
              <button
                type="button"
                className={albumLocked ? 'btn btn-sm catn8-lock-text-toggle is-active' : 'btn btn-sm catn8-lock-text-toggle'}
                onClick={onToggleAlbumLock}
              >
                {albumLocked ? 'Unlock Album' : 'Lock Album'}
              </button>
            ) : null}
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={onEnterFullscreen}>
              Full Screen
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary catn8-close-viewer-btn"
              aria-label="Close album viewer"
              title="Close"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      {viewMode === 'album' ? (
        <PhotoAlbumStage
          album={album}
          spreadIndex={pageIndex}
          zoom={zoom}
          contactDisplayName={contactDisplayName}
          respectSavedPositions
          canPrev={canPrev}
          canNext={canNext}
          onPrev={onPrevPage}
          onNext={onNextPage}
          pageFavorite={pageFavorite}
          isMediaFavorite={isMediaFavorite}
          isTextFavorite={isTextFavorite}
          onTogglePageFavorite={onTogglePageFavorite}
          onToggleMediaFavorite={onToggleMediaFavorite}
          onToggleTextFavorite={onToggleTextFavorite}
          pageLocked={pageLocked}
          albumLocked={albumLocked}
          onTogglePageLock={onTogglePageLock}
          onBackToAlbums={onClose}
        />
      ) : (
        <PhotoAlbumChronologicalList
          album={album}
          contactDisplayName={contactDisplayName}
          isMediaFavorite={isMediaFavorite}
          isTextFavorite={isTextFavorite}
          onToggleMediaFavorite={onToggleMediaFavorite}
          onToggleTextFavorite={onToggleTextFavorite}
        />
      )}
    </div>
  );
}
