import React from 'react';

import { PreparedMediaItem, ViewerTarget } from './types';

interface PhotoAlbumElementViewerProps {
  target: ViewerTarget;
  activeMedia: PreparedMediaItem | null;
  activeNote: string;
  prevTarget: ViewerTarget | null;
  nextTarget: ViewerTarget | null;
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
  const { target, activeMedia, activeNote, prevTarget, nextTarget, onClose, onNavigate } = props;

  return (
    <div className="catn8-element-viewer-overlay" role="dialog" aria-modal="true">
      <div className="catn8-element-viewer-shell">
        <div className="catn8-element-viewer-header">
          <strong>
            {target.type === 'media' ? 'Media' : 'Text'} · Spread {target.spreadIndex + 1}
          </strong>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>Close</button>
        </div>
        <div className="catn8-element-viewer-body">
          {target.type === 'media' && activeMedia ? (
            isVideoMedia(activeMedia.src, activeMedia.mediaType) ? (
              <video className="catn8-element-viewer-media" src={activeMedia.src} controls autoPlay preload="metadata" />
            ) : (
              <img className="catn8-element-viewer-media" src={activeMedia.src} alt={activeMedia.caption || 'Media'} />
            )
          ) : null}
          {target.type === 'note' ? (
            <div className="catn8-element-viewer-note">{activeNote || 'No text available'}</div>
          ) : null}
        </div>
        <div className="catn8-element-viewer-footer">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={!prevTarget} onClick={() => onNavigate(prevTarget)}>← Back</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={!nextTarget} onClick={() => onNavigate(nextTarget)}>Next →</button>
        </div>
      </div>
    </div>
  );
}
