import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';
import { LockIcon } from './LockIcon';

interface PhotoAlbumAdminMetadataCardProps {
  busy: boolean;
  album: PhotoAlbum;
  albumLocked: boolean;
  onToggleAlbumLock: () => void;
  onAlbumChange: (updater: (prev: PhotoAlbum) => PhotoAlbum) => void;
}

export function PhotoAlbumAdminMetadataCard({
  busy,
  album,
  albumLocked,
  onToggleAlbumLock,
  onAlbumChange,
}: PhotoAlbumAdminMetadataCardProps) {
  return (
    <div className="catn8-card p-3 mb-3">
      <div className="catn8-admin-label-with-control">
        <label className="form-label m-0">Album Title</label>
        <button
          type="button"
          className={albumLocked ? 'catn8-admin-inline-lock is-active' : 'catn8-admin-inline-lock'}
          onClick={onToggleAlbumLock}
          disabled={busy}
          aria-label={albumLocked ? 'Unlock album' : 'Lock album'}
          title={albumLocked ? 'Album locked' : 'Lock album'}
        >
          <LockIcon locked={albumLocked} />
        </button>
      </div>
      <input className="form-control" value={album.title} disabled={busy} onChange={(event) => onAlbumChange((prev) => ({ ...prev, title: event.target.value }))} />

      <label className="form-label mt-2">Album Summary</label>
      <textarea className="form-control" rows={2} value={album.summary} disabled={busy} onChange={(event) => onAlbumChange((prev) => ({ ...prev, summary: event.target.value }))} />

      <label className="form-label mt-2">Cover Image URL</label>
      <input className="form-control" value={album.cover_image_url || ''} disabled={busy} onChange={(event) => onAlbumChange((prev) => ({ ...prev, cover_image_url: event.target.value }))} />

      <label className="form-label mt-2">Cover Prompt</label>
      <textarea className="form-control" rows={3} value={album.cover_prompt || ''} disabled={busy} onChange={(event) => onAlbumChange((prev) => ({ ...prev, cover_prompt: event.target.value }))} />
    </div>
  );
}
