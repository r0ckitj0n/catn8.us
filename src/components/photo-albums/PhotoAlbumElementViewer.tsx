import React from 'react';

import { PreparedMediaItem, ViewerTarget } from './types';

interface PhotoAlbumElementViewerProps {
  target: ViewerTarget;
  activeMedia: PreparedMediaItem | null;
  activeNote: string;
  dateLabel?: string;
  activeMediaFavorite?: boolean;
  activeNoteFavorite?: boolean;
  prevTarget: ViewerTarget | null;
  nextTarget: ViewerTarget | null;
  onToggleActiveMediaFavorite?: () => void;
  onToggleActiveNoteFavorite?: () => void;
  onClose: () => void;
  onNavigate: (target: ViewerTarget | null) => void;
}

function isVideoMedia(src: string, mediaType?: string): boolean {
  if (mediaType === 'video') {
    return true;
  }
  return /\.(mov|mp4|m4v|3gp|avi|mkv|webm)(\?.*)?$/i.test(src || '');
}

export function PhotoAlbumElementViewer(props: PhotoAlbumElementViewerProps) {
  const {
    target,
    activeMedia,
    activeNote,
    dateLabel,
    activeMediaFavorite = false,
    activeNoteFavorite = false,
    prevTarget,
    nextTarget,
    onToggleActiveMediaFavorite,
    onToggleActiveNoteFavorite,
    onClose,
    onNavigate,
  } = props;
  const isMediaTarget = target.type === 'media';

  return (
    <div className="catn8-element-viewer-overlay" role="dialog" aria-modal="true">
      <div className={isMediaTarget ? 'catn8-element-viewer-shell catn8-element-viewer-shell--media' : 'catn8-element-viewer-shell'}>
        <div className="catn8-element-viewer-header">
          <strong>{target.type === 'media' ? 'Media' : 'Text'}</strong>
          <div className="catn8-element-viewer-header-right">
            {dateLabel ? <span className="catn8-element-viewer-date">{dateLabel}</span> : null}
            {target.type === 'media' && typeof onToggleActiveMediaFavorite === 'function' ? (
              <button
                type="button"
                className={activeMediaFavorite ? 'catn8-viewer-favorite-toggle is-active' : 'catn8-viewer-favorite-toggle'}
                onClick={onToggleActiveMediaFavorite}
                aria-label={activeMediaFavorite ? 'Remove media from favorites' : 'Add media to favorites'}
                title={activeMediaFavorite ? 'Favorited media' : 'Favorite this media'}
              >
                ♥
              </button>
            ) : null}
            {target.type === 'note' && typeof onToggleActiveNoteFavorite === 'function' ? (
              <button
                type="button"
                className={activeNoteFavorite ? 'catn8-viewer-favorite-toggle is-active' : 'catn8-viewer-favorite-toggle'}
                onClick={onToggleActiveNoteFavorite}
                aria-label={activeNoteFavorite ? 'Remove text from favorites' : 'Add text to favorites'}
                title={activeNoteFavorite ? 'Favorited text' : 'Favorite this text'}
              >
                ♥
              </button>
            ) : null}
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
        <div className={isMediaTarget ? 'catn8-element-viewer-body catn8-element-viewer-body-media' : 'catn8-element-viewer-body'}>
          {target.type === 'media' && activeMedia ? (
            <div className="catn8-element-viewer-media-wrap">
              {isVideoMedia(activeMedia.src, activeMedia.mediaType) ? (
                <video className="catn8-element-viewer-media" src={activeMedia.src} controls autoPlay preload="metadata" />
              ) : (
                <img className="catn8-element-viewer-media" src={activeMedia.src} alt={activeMedia.caption || 'Media'} />
              )}
            </div>
          ) : null}
          {target.type === 'note' ? (
            <div className="catn8-element-viewer-note">{activeNote || 'No text available'}</div>
          ) : null}
        </div>
        {isMediaTarget ? (
          <>
            <button
              type="button"
              className="catn8-element-viewer-nav catn8-element-viewer-nav-prev"
              disabled={!prevTarget}
              onClick={() => onNavigate(prevTarget)}
              aria-label="Previous media"
              title="Previous"
            >
              ‹
            </button>
            <button
              type="button"
              className="catn8-element-viewer-nav catn8-element-viewer-nav-next"
              disabled={!nextTarget}
              onClick={() => onNavigate(nextTarget)}
              aria-label="Next media"
              title="Next"
            >
              ›
            </button>
          </>
        ) : null}
        {!isMediaTarget ? (
          <div className="catn8-element-viewer-footer">
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={!prevTarget} onClick={() => onNavigate(prevTarget)}>← Previous</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={!nextTarget} onClick={() => onNavigate(nextTarget)}>Next →</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
