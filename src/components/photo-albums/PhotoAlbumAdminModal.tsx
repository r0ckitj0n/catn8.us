import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';
import { auditPhotoAlbum } from '../../utils/photoAlbumAudit';
import { sanitizeAlbumMessageText } from '../../utils/photoAlbumText';
import { PhotoAlbumStage } from './PhotoAlbumStage';

interface PhotoAlbumAdminModalProps {
  open: boolean;
  busy: boolean;
  album: PhotoAlbum | null;
  pageIndex: number;
  zoom: number;
  canPrev: boolean;
  canNext: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onFullscreenPreview: () => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  onAlbumChange: (updater: (prev: PhotoAlbum) => PhotoAlbum) => void;
}

export function PhotoAlbumAdminModal(props: PhotoAlbumAdminModalProps) {
  const {
    open,
    busy,
    album,
    pageIndex,
    zoom,
    canPrev,
    canNext,
    onPrevPage,
    onNextPage,
    onFullscreenPreview,
    onClose,
    onSave,
    onDelete,
    onAlbumChange,
  } = props;

  if (!open || !album) {
    return null;
  }

  const spread = album.spec.spreads[pageIndex] || null;
  const images = Array.isArray(spread?.images) ? spread.images : [];
  const audit = React.useMemo(() => auditPhotoAlbum(album), [album]);

  return (
    <div className="catn8-admin-modal-overlay" role="dialog" aria-modal="true">
      <div className="catn8-admin-modal-shell">
        <div className="catn8-admin-modal-header">
          <h2 className="h4 m-0">Edit Photo Album</h2>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-sm btn-dark" onClick={onFullscreenPreview}>Full Screen</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="catn8-admin-modal-body">
          <div className="catn8-admin-editor-panel">
            <div className="catn8-card p-3 mb-3">
              <h3 className="h6">Album Wiring Audit</h3>
              <div className="small">
                Spreads: {audit.totalSpreads} | Missing media spreads: {audit.spreadsMissingMedia.length} | Missing text spreads: {audit.spreadsMissingText.length} | Missing both: {audit.spreadsMissingBoth.length}
              </div>
              <div className="small text-muted mt-1">
                Empty media refs: {audit.mediaEntriesMissingSource} | Questionable media paths: {audit.mediaEntriesQuestionableSource}
              </div>
              {audit.spreadsMissingBoth.length > 0 ? (
                <div className="form-text">Spreads missing both media and text: {audit.spreadsMissingBoth.slice(0, 20).join(', ')}</div>
              ) : null}
              {audit.spreadsMissingMedia.length > 0 ? (
                <div className="form-text">Spreads missing media: {audit.spreadsMissingMedia.slice(0, 20).join(', ')}</div>
              ) : null}
              {audit.spreadsMissingText.length > 0 ? (
                <div className="form-text">Spreads missing readable text: {audit.spreadsMissingText.slice(0, 20).join(', ')}</div>
              ) : null}
            </div>

            <div className="catn8-card p-3 mb-3">
              <label className="form-label">Album Title</label>
              <input
                className="form-control"
                value={album.title}
                disabled={busy}
                onChange={(event) => onAlbumChange((prev) => ({ ...prev, title: event.target.value }))}
              />

              <label className="form-label mt-2">Album Summary</label>
              <textarea
                className="form-control"
                rows={2}
                value={album.summary}
                disabled={busy}
                onChange={(event) => onAlbumChange((prev) => ({ ...prev, summary: event.target.value }))}
              />

              <label className="form-label mt-2">Cover Image URL</label>
              <input
                className="form-control"
                value={album.cover_image_url || ''}
                disabled={busy}
                onChange={(event) => onAlbumChange((prev) => ({ ...prev, cover_image_url: event.target.value }))}
              />

              <label className="form-label mt-2">Cover Prompt</label>
              <textarea
                className="form-control"
                rows={3}
                value={album.cover_prompt || ''}
                disabled={busy}
                onChange={(event) => onAlbumChange((prev) => ({ ...prev, cover_prompt: event.target.value }))}
              />
            </div>

            <div className="catn8-card p-3 mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h3 className="h6 m-0">Spread Editor</h3>
                <div className="d-flex gap-1">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onPrevPage} disabled={!canPrev}>Prev</button>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onNextPage} disabled={!canNext}>Next</button>
                </div>
              </div>

              <label className="form-label">Spread Title</label>
              <input
                className="form-control"
                value={spread?.title || ''}
                disabled={busy}
                onChange={(event) => onAlbumChange((prev) => {
                  const next = structuredClone(prev);
                  if (next.spec.spreads[pageIndex]) {
                    next.spec.spreads[pageIndex].title = event.target.value;
                  }
                  return next;
                })}
              />

              <label className="form-label mt-2">Spread Caption</label>
              <textarea
                className="form-control"
                rows={3}
                value={spread?.caption || ''}
                disabled={busy}
                onChange={(event) => onAlbumChange((prev) => {
                  const next = structuredClone(prev);
                  if (next.spec.spreads[pageIndex]) {
                    next.spec.spreads[pageIndex].caption = event.target.value;
                  }
                  return next;
                })}
              />

              <label className="form-label mt-2">Background Prompt</label>
              <textarea
                className="form-control"
                rows={2}
                value={spread?.background_prompt || ''}
                disabled={busy}
                onChange={(event) => onAlbumChange((prev) => {
                  const next = structuredClone(prev);
                  if (next.spec.spreads[pageIndex]) {
                    next.spec.spreads[pageIndex].background_prompt = event.target.value;
                  }
                  return next;
                })}
              />
            </div>

            <div className="catn8-card p-3 mb-3">
              <h3 className="h6">Media + Text</h3>
              {images.map((image, index) => (
                <div className="catn8-admin-image-editor" key={`admin-image-${index}`}>
                  <label className="form-label">Media URL {index + 1}</label>
                  <input
                    className="form-control"
                    value={image.src || ''}
                    disabled={busy}
                    onChange={(event) => onAlbumChange((prev) => {
                      const next = structuredClone(prev);
                      const target = next.spec.spreads[pageIndex]?.images?.[index];
                      if (target) {
                        target.src = event.target.value;
                      }
                      return next;
                    })}
                  />

                  <label className="form-label mt-2">Caption</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={sanitizeAlbumMessageText(image.caption || '')}
                    disabled={busy}
                    onChange={(event) => onAlbumChange((prev) => {
                      const next = structuredClone(prev);
                      const target = next.spec.spreads[pageIndex]?.images?.[index];
                      if (target) {
                        target.caption = event.target.value;
                      }
                      return next;
                    })}
                  />

                  <label className="form-label mt-2">Memory Text</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={sanitizeAlbumMessageText(image.memory_text || '')}
                    disabled={busy}
                    onChange={(event) => onAlbumChange((prev) => {
                      const next = structuredClone(prev);
                      const target = next.spec.spreads[pageIndex]?.images?.[index];
                      if (target) {
                        target.memory_text = event.target.value;
                      }
                      return next;
                    })}
                  />
                </div>
              ))}
            </div>

            <div className="d-flex gap-2 pb-4">
              <button type="button" className="btn btn-primary" onClick={onSave} disabled={busy}>Save Album</button>
              <button type="button" className="btn btn-outline-danger" onClick={onDelete} disabled={busy}>Delete Album</button>
            </div>
          </div>

          <div className="catn8-admin-preview-panel">
            <PhotoAlbumStage
              album={album}
              spreadIndex={pageIndex}
              zoom={zoom}
              canPrev={canPrev}
              canNext={canNext}
              onPrev={onPrevPage}
              onNext={onNextPage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
