import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';
import { toPhotoAlbumDisplaySummary, toPhotoAlbumDisplayTitle } from '../../utils/photoAlbumText';
import { WebpImage } from '../common/WebpImage';
import { LockIcon } from './LockIcon';

interface PhotoAlbumsListShellProps {
  albums: PhotoAlbum[];
  busy: boolean;
  isAdmin: boolean;
  onOpenAlbum: (albumId: number) => void;
  onEditAlbum: (albumId: number) => void;
  onToggleAlbumLock: (albumId: number, isLocked: boolean) => void;
  onDeleteAlbum: (albumId: number, title: string) => void;
  onCaptureNewMessages: () => void;
  onCreatePhotoAlbum: () => void;
}

export function PhotoAlbumsListShell({
  albums,
  busy,
  isAdmin,
  onOpenAlbum,
  onEditAlbum,
  onToggleAlbumLock,
  onDeleteAlbum,
  onCaptureNewMessages,
  onCreatePhotoAlbum,
}: PhotoAlbumsListShellProps) {
  return (
    <div className="catn8-card catn8-photo-albums-list-shell">
      <div className="catn8-photo-albums-list-header">
        <div className="catn8-photo-albums-list-header-row">
          <div>
            <h1 className="section-title mb-1">PHOTO M8</h1>
            <p className="mb-0">Choose an album to open it.</p>
          </div>
          <a className="catn8-photo-albums-logo-link" href="https://catn8.us" aria-label="Go to catn8.us">
            <WebpImage className="catn8-photo-albums-logo" src="/images/catn8_logo.png" alt="catn8.us Logo" />
          </a>
          {isAdmin ? (
            <div className="d-flex gap-2 flex-wrap">
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={busy}
                onClick={onCaptureNewMessages}
              >
                Capture New Messages
              </button>
              <button type="button" className="btn btn-primary" onClick={onCreatePhotoAlbum}>
                Create Photo Album
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="catn8-photo-albums-card-grid">
        {albums.map((album) => {
          const displayTitle = toPhotoAlbumDisplayTitle(album.title);
          const displaySummary = toPhotoAlbumDisplaySummary(album.summary);
          const isVirtual = Boolean(album.is_virtual);
          const albumLocked = Number(album.is_locked || 0) === 1;
          return (
            <article key={album.id} className="catn8-photo-album-card">
              <button
                type="button"
                className="catn8-photo-album-card-open"
                onClick={() => onOpenAlbum(album.id)}
                aria-label={`Open album ${displayTitle}`}
              />
              <div className="catn8-photo-album-card-image" style={{ backgroundImage: album.cover_image_url ? `url(${album.cover_image_url})` : undefined }} />
              <div className="catn8-photo-album-card-body">
                <h2>{displayTitle}</h2>
                {isVirtual ? <div className="catn8-photo-album-template-badge">Template</div> : null}
                <p>{displaySummary || 'No summary yet.'}</p>
              </div>
              {isAdmin && !isVirtual ? (
                <div className="catn8-photo-album-card-admin-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary catn8-photo-album-card-edit"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onEditAlbum(album.id);
                    }}
                    aria-label={`Edit album ${displayTitle}`}
                    title="Edit album"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={albumLocked ? 'catn8-photo-album-card-lock is-active' : 'catn8-photo-album-card-lock'}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onToggleAlbumLock(album.id, !albumLocked);
                    }}
                    aria-label={albumLocked ? `Unlock album ${displayTitle}` : `Lock album ${displayTitle}`}
                    title={albumLocked ? 'Unlock album' : 'Lock album'}
                  >
                    <LockIcon locked={albumLocked} />
                  </button>
                  <button
                    type="button"
                    className="catn8-photo-album-card-delete"
                    onClick={() => onDeleteAlbum(album.id, displayTitle)}
                    aria-label={`Delete album ${displayTitle}`}
                    title="Delete album"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      focusable="false"
                    >
                      <path
                        d="M9 3h6l1 2h5v2H3V5h5l1-2Zm-3 6h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9Zm4 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
        {albums.length === 0 ? <div className="catn8-card p-4">No photo albums available yet.</div> : null}
      </div>
    </div>
  );
}
