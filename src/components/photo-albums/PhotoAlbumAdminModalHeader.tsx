import React from 'react';

import { PhotoAlbumAdminModalHeaderProps } from './photoAlbumAdminModalTypes';

const saveSvg = (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4.5a1 1 0 0 0-.293-.707l-2.5-2.5A1 1 0 0 0 11.5 1H2zm1 1h8v4H3V2zm0 6h10v6H3V8zm2 1v4h6V9H5z"
    />
  </svg>
);

export function PhotoAlbumAdminModalHeader({
  busy,
  hasUnsavedChanges,
  albumLocked,
  spreadLocked,
  viewMode,
  onSetViewMode,
  onFullscreenPreview,
  onAutoLayout,
  onAutoLayoutAllUnlocked,
  onAutoLayoutSpread,
  onToggleSpreadLock,
  onDelete,
  onSave,
  onClose,
}: PhotoAlbumAdminModalHeaderProps) {
  return (
    <div className="catn8-admin-modal-header">
      <h2 className="h4 m-0">Edit Photo Album</h2>
      <div className="catn8-admin-modal-header-actions">
        <div className="catn8-admin-modal-header-tools">
          <div className="catn8-photo-albums-view-toggle" role="group" aria-label="View mode">
            <span className="catn8-photo-albums-view-toggle-label">View</span>
            <button
              type="button"
              className={viewMode === 'album' ? 'btn btn-sm btn-outline-secondary is-active' : 'btn btn-sm btn-outline-secondary'}
              onClick={() => { void onSetViewMode?.('album'); }}
              aria-pressed={viewMode === 'album'}
            >
              Album
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? 'btn btn-sm btn-outline-secondary is-active' : 'btn btn-sm btn-outline-secondary'}
              onClick={() => { void onSetViewMode?.('list'); }}
              aria-pressed={viewMode === 'list'}
            >
              List
            </button>
          </div>
          <button type="button" className="btn btn-sm btn-dark" onClick={onFullscreenPreview}>Full Screen</button>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={onAutoLayout} disabled={busy}>Auto Layout Album</button>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={onAutoLayoutAllUnlocked} disabled={busy}>Auto Layout All Unlocked</button>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={onAutoLayoutSpread} disabled={busy || albumLocked || spreadLocked}>Auto Layout This Spread</button>
          <button
            type="button"
            className={spreadLocked ? 'btn btn-sm catn8-lock-text-toggle is-active' : 'btn btn-sm catn8-lock-text-toggle'}
            onClick={onToggleSpreadLock}
            disabled={busy || albumLocked}
          >
            {spreadLocked ? 'Unlock Page' : 'Lock Page'}
          </button>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDelete} disabled={busy || albumLocked}>Delete Album</button>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className={'btn btn-sm btn-primary catn8-dirty-save' + (hasUnsavedChanges ? ' catn8-dirty-save--visible catn8-admin-save-is-dirty' : '')}
            onClick={() => { void onSave(); }}
            disabled={busy || albumLocked || !hasUnsavedChanges}
            aria-label="Save album"
            title={hasUnsavedChanges ? 'Save changes' : 'No changes to save'}
          >
            {saveSvg}
            <span className="ms-1">Save</span>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary catn8-close-viewer-btn"
            onClick={onClose}
            aria-label="Close edit modal"
            title="Close"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
