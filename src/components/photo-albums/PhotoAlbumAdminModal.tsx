import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';
import { auditPhotoAlbum } from '../../utils/photoAlbumAudit';
import { sanitizeAlbumMessageText, splitAlbumMessages } from '../../utils/photoAlbumText';
import { PhotoAlbumStage } from './PhotoAlbumStage';

interface PhotoAlbumAdminModalProps {
  open: boolean;
  busy: boolean;
  hasUnsavedChanges: boolean;
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
    hasUnsavedChanges,
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

  const spread = album?.spec.spreads[pageIndex] || null;
  const images = Array.isArray(spread?.images) ? spread.images : [];
  const audit = React.useMemo(() => {
    if (!album) {
      return {
        totalSpreads: 0,
        spreadsMissingMedia: [] as number[],
        spreadsMissingText: [] as number[],
        spreadsMissingBoth: [] as number[],
        mediaEntriesMissingSource: 0,
        mediaEntriesQuestionableSource: 0,
      };
    }
    return auditPhotoAlbum(album);
  }, [album]);
  const textItems = Array.isArray(spread?.text_items) ? spread.text_items : [];
  const decorItems = (Array.isArray(spread?.decor_items) ? spread.decor_items : [])
    .map((item, index) => ({ item, index }))
    .filter((entry) => Boolean(entry.item && typeof entry.item === 'object'));

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.classList.add('catn8-admin-modal-open');
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.classList.remove('catn8-admin-modal-open');
    };
  }, [open]);

  const ensureTextItems = React.useCallback(() => {
    if (!album) {
      return;
    }
    onAlbumChange((prev) => {
      const next = structuredClone(prev);
      const target = next.spec.spreads[pageIndex];
      if (!target) {
        return prev;
      }
      if (Array.isArray(target.text_items) && target.text_items.length > 0) {
        return next;
      }
      const lines = sanitizeAlbumMessageText(target.caption || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      target.text_items = lines.map((line, index) => ({
        id: `note-${Date.now()}-${index}`,
        text: line,
      }));
      return next;
    });
  }, [album, onAlbumChange, pageIndex]);

  const hydrateTextItems = React.useCallback((targetSpread: NonNullable<PhotoAlbum['spec']['spreads'][number]>) => {
    if (Array.isArray(targetSpread.text_items) && targetSpread.text_items.length > 0) {
      return;
    }
    const lines = splitAlbumMessages(targetSpread.caption || '').map((line) => line.trim()).filter(Boolean);
    targetSpread.text_items = lines.map((line, index) => ({
      id: `note-${Date.now()}-${index}`,
      text: line,
    }));
  }, []);

  if (!open || !album) {
    return null;
  }

  return (
    <div className="catn8-admin-modal-overlay" role="dialog" aria-modal="true">
      <div className="catn8-admin-modal-shell">
        <div className="catn8-admin-modal-header">
          <h2 className="h4 m-0">Edit Photo Album</h2>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-sm btn-dark" onClick={onFullscreenPreview}>Full Screen</button>
            {hasUnsavedChanges ? (
              <button type="button" className="btn btn-sm btn-primary" onClick={onSave} disabled={busy}>Save Album</button>
            ) : null}
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDelete} disabled={busy}>Delete Album</button>
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
              <div className="d-flex gap-2 mb-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={ensureTextItems}
                  disabled={busy}
                >
                  Init Text Items
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => onAlbumChange((prev) => {
                    const next = structuredClone(prev);
                    const target = next.spec.spreads[pageIndex];
                    if (!target) {
                      return prev;
                    }
                    if (!Array.isArray(target.decor_items)) {
                      target.decor_items = [];
                    }
                    target.decor_items.push({ id: `decor-${Date.now()}`, emoji: '✨', x: 20, y: 20, size: 1 });
                    return next;
                  })}
                  disabled={busy}
                >
                  Add Clipart
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => onAlbumChange((prev) => {
                    const next = structuredClone(prev);
                    const target = next.spec.spreads[pageIndex];
                    if (!target) {
                      return prev;
                    }
                    if (!Array.isArray(target.images)) {
                      target.images = [];
                    }
                    target.images.push({ src: '', media_type: 'image', caption: '', memory_text: '', x: 12, y: 12, w: 18 });
                    return next;
                  })}
                  disabled={busy}
                >
                  Add Media
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => onAlbumChange((prev) => {
                    const next = structuredClone(prev);
                    const target = next.spec.spreads[pageIndex];
                    if (!target) {
                      return prev;
                    }
                    if (!Array.isArray(target.text_items)) {
                      target.text_items = [];
                    }
                    target.text_items.push({ id: `note-${Date.now()}`, text: 'Jon: New note', x: 10, y: 10, w: 20 });
                    return next;
                  })}
                  disabled={busy}
                >
                  Add Text
                </button>
              </div>
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
                  <div className="row g-2 mt-1">
                    <div className="col-4">
                      <label className="form-label">X%</label>
                      <input
                        className="form-control"
                        type="number"
                        value={Number(image.x ?? 10)}
                        disabled={busy}
                        onChange={(event) => onAlbumChange((prev) => {
                          const next = structuredClone(prev);
                          const target = next.spec.spreads[pageIndex]?.images?.[index];
                          if (target) {
                            target.x = Number(event.target.value);
                          }
                          return next;
                        })}
                      />
                    </div>
                    <div className="col-4">
                      <label className="form-label">Y%</label>
                      <input
                        className="form-control"
                        type="number"
                        value={Number(image.y ?? 10)}
                        disabled={busy}
                        onChange={(event) => onAlbumChange((prev) => {
                          const next = structuredClone(prev);
                          const target = next.spec.spreads[pageIndex]?.images?.[index];
                          if (target) {
                            target.y = Number(event.target.value);
                          }
                          return next;
                        })}
                      />
                    </div>
                    <div className="col-4">
                      <label className="form-label">W%</label>
                      <input
                        className="form-control"
                        type="number"
                        value={Number(image.w ?? 18)}
                        disabled={busy}
                        onChange={(event) => onAlbumChange((prev) => {
                          const next = structuredClone(prev);
                          const target = next.spec.spreads[pageIndex]?.images?.[index];
                          if (target) {
                            target.w = Number(event.target.value);
                          }
                          return next;
                        })}
                      />
                    </div>
                  </div>
                  <div className="d-flex justify-content-end mt-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={busy}
                      onClick={() => onAlbumChange((prev) => {
                        const next = structuredClone(prev);
                        const target = next.spec.spreads[pageIndex];
                        if (target?.images) {
                          target.images.splice(index, 1);
                        }
                        return next;
                      })}
                    >
                      Delete Media
                    </button>
                  </div>
                </div>
              ))}

              {textItems.map((item, index) => (
                <div className="catn8-admin-image-editor" key={item.id || `text-item-${index}`}>
                  <label className="form-label">Text {index + 1}</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={item.text || ''}
                    disabled={busy}
                    onChange={(event) => onAlbumChange((prev) => {
                      const next = structuredClone(prev);
                      const target = next.spec.spreads[pageIndex]?.text_items?.[index];
                      if (target) {
                        target.text = event.target.value;
                      }
                      return next;
                    })}
                  />
                  <div className="row g-2 mt-1">
                    <div className="col-4">
                      <label className="form-label">X%</label>
                      <input
                        className="form-control"
                        type="number"
                        value={Number(item.x ?? 10)}
                        disabled={busy}
                        onChange={(event) => onAlbumChange((prev) => {
                          const next = structuredClone(prev);
                          const target = next.spec.spreads[pageIndex]?.text_items?.[index];
                          if (target) {
                            target.x = Number(event.target.value);
                          }
                          return next;
                        })}
                      />
                    </div>
                    <div className="col-4">
                      <label className="form-label">Y%</label>
                      <input
                        className="form-control"
                        type="number"
                        value={Number(item.y ?? 10)}
                        disabled={busy}
                        onChange={(event) => onAlbumChange((prev) => {
                          const next = structuredClone(prev);
                          const target = next.spec.spreads[pageIndex]?.text_items?.[index];
                          if (target) {
                            target.y = Number(event.target.value);
                          }
                          return next;
                        })}
                      />
                    </div>
                    <div className="col-4">
                      <label className="form-label">W%</label>
                      <input
                        className="form-control"
                        type="number"
                        value={Number(item.w ?? 20)}
                        disabled={busy}
                        onChange={(event) => onAlbumChange((prev) => {
                          const next = structuredClone(prev);
                          const target = next.spec.spreads[pageIndex]?.text_items?.[index];
                          if (target) {
                            target.w = Number(event.target.value);
                          }
                          return next;
                        })}
                      />
                    </div>
                  </div>
                  <div className="d-flex justify-content-end mt-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={busy}
                      onClick={() => onAlbumChange((prev) => {
                        const next = structuredClone(prev);
                        const target = next.spec.spreads[pageIndex];
                        if (target?.text_items) {
                          target.text_items.splice(index, 1);
                        }
                        return next;
                      })}
                    >
                      Delete Text
                    </button>
                  </div>
                </div>
              ))}

              {decorItems.map(({ item, index: sourceIndex }, index) => (
                <div className="catn8-admin-image-editor" key={item.id || `decor-${sourceIndex}`}>
                  <label className="form-label">Clipart Emoji</label>
                  <input
                    className="form-control"
                    value={item.emoji || '✨'}
                    disabled={busy}
                    onChange={(event) => onAlbumChange((prev) => {
                      const next = structuredClone(prev);
                      const target = next.spec.spreads[pageIndex]?.decor_items?.[sourceIndex];
                      if (target) {
                        target.emoji = event.target.value || '✨';
                      }
                      return next;
                    })}
                  />
                  <div className="d-flex justify-content-end mt-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={busy}
                      onClick={() => onAlbumChange((prev) => {
                        const next = structuredClone(prev);
                        const target = next.spec.spreads[pageIndex];
                        if (target?.decor_items) {
                          target.decor_items.splice(sourceIndex, 1);
                        }
                        return next;
                      })}
                    >
                      Delete Clipart
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>

          <div className="catn8-admin-preview-panel">
            <PhotoAlbumStage
              album={album}
              spreadIndex={pageIndex}
              zoom={zoom}
              contactDisplayName={album.created_by_username || ''}
              canPrev={canPrev}
              canNext={canNext}
              onPrev={onPrevPage}
              onNext={onNextPage}
              onBackToAlbums={onClose}
              editable
              onMoveMedia={(index, patch) => onAlbumChange((prev) => {
                const next = structuredClone(prev);
                const target = next.spec.spreads[pageIndex]?.images?.[index];
                if (target) {
                  target.x = patch.x;
                  target.y = patch.y;
                }
                return next;
              })}
              onMoveNote={(index, patch) => onAlbumChange((prev) => {
                const next = structuredClone(prev);
                const targetSpread = next.spec.spreads[pageIndex];
                if (!targetSpread) {
                  return prev;
                }
                hydrateTextItems(targetSpread);
                if (!Array.isArray(targetSpread.text_items)) {
                  return next;
                }
                if (!targetSpread.text_items[index]) {
                  targetSpread.text_items[index] = { id: `note-${Date.now()}-${index}`, text: 'Jon: New note' };
                }
                targetSpread.text_items[index].x = patch.x;
                targetSpread.text_items[index].y = patch.y;
                return next;
              })}
              onMoveDecor={(index, patch) => onAlbumChange((prev) => {
                const next = structuredClone(prev);
                const targetSpread = next.spec.spreads[pageIndex];
                if (!targetSpread) {
                  return prev;
                }
                if (!Array.isArray(targetSpread.decor_items)) {
                  targetSpread.decor_items = [];
                }
                if (!targetSpread.decor_items[index]) {
                  targetSpread.decor_items[index] = {
                    id: `decor-${Date.now()}-${index}`,
                    emoji: patch.emoji || '✨',
                    size: typeof patch.size === 'number' ? patch.size : 1,
                    rotation: typeof patch.rotation === 'number' ? patch.rotation : 0,
                    x: patch.x,
                    y: patch.y,
                  };
                  return next;
                }
                const target = targetSpread.decor_items[index];
                target.x = patch.x;
                target.y = patch.y;
                if (typeof patch.emoji === 'string' && patch.emoji.trim()) {
                  target.emoji = patch.emoji;
                }
                if (typeof patch.size === 'number') {
                  target.size = patch.size;
                }
                if (typeof patch.rotation === 'number') {
                  target.rotation = patch.rotation;
                }
                return next;
              })}
              onEditNoteText={(index, nextText) => onAlbumChange((prev) => {
                const next = structuredClone(prev);
                const targetSpread = next.spec.spreads[pageIndex];
                if (!targetSpread) {
                  return prev;
                }
                hydrateTextItems(targetSpread);
                if (!Array.isArray(targetSpread.text_items)) {
                  return next;
                }
                if (!targetSpread.text_items[index]) {
                  targetSpread.text_items[index] = { id: `note-${Date.now()}-${index}`, text: nextText };
                } else {
                  targetSpread.text_items[index].text = nextText;
                }
                return next;
              })}
              onEditMediaCaption={(index, nextCaption) => onAlbumChange((prev) => {
                const next = structuredClone(prev);
                const target = next.spec.spreads[pageIndex]?.images?.[index];
                if (target) {
                  target.caption = nextCaption;
                }
                return next;
              })}
              onEditDecor={(index, patch) => onAlbumChange((prev) => {
                const next = structuredClone(prev);
                const target = next.spec.spreads[pageIndex]?.decor_items?.[index];
                if (target) {
                  if (typeof patch.emoji === 'string') {
                    target.emoji = patch.emoji;
                  }
                  if (typeof patch.size === 'number') {
                    target.size = patch.size;
                  }
                }
                return next;
              })}
              onDuplicateMedia={(index) => onAlbumChange((prev) => {
                const next = structuredClone(prev);
                const targetSpread = next.spec.spreads[pageIndex];
                if (!targetSpread || !Array.isArray(targetSpread.images) || !targetSpread.images[index]) {
                  return prev;
                }
                const source = targetSpread.images[index];
                targetSpread.images.splice(index + 1, 0, {
                  ...source,
                  x: Math.min(92, Number(source.x ?? 10) + 4),
                  y: Math.min(90, Number(source.y ?? 10) + 4),
                });
                return next;
              })}
              onDuplicateNote={(index) => onAlbumChange((prev) => {
                const next = structuredClone(prev);
                const targetSpread = next.spec.spreads[pageIndex];
                if (!targetSpread) {
                  return prev;
                }
                hydrateTextItems(targetSpread);
                if (!Array.isArray(targetSpread.text_items) || !targetSpread.text_items[index]) {
                  return prev;
                }
                const source = targetSpread.text_items[index];
                targetSpread.text_items.splice(index + 1, 0, {
                  ...source,
                  id: `${source.id || 'note'}-copy-${Date.now()}`,
                  x: Math.min(92, Number(source.x ?? 10) + 3),
                  y: Math.min(90, Number(source.y ?? 10) + 3),
                });
                return next;
              })}
              onDuplicateDecor={(index) => onAlbumChange((prev) => {
                const next = structuredClone(prev);
                const targetSpread = next.spec.spreads[pageIndex];
                if (!targetSpread || !Array.isArray(targetSpread.decor_items) || !targetSpread.decor_items[index]) {
                  return prev;
                }
                const source = targetSpread.decor_items[index];
                targetSpread.decor_items.splice(index + 1, 0, {
                  ...source,
                  id: `${source.id || 'decor'}-copy-${Date.now()}`,
                  x: Math.min(94, Number(source.x ?? 20) + 4),
                  y: Math.min(92, Number(source.y ?? 20) + 4),
                });
                return next;
              })}
              onDeleteMedia={(index) => onAlbumChange((prev) => {
                const next = structuredClone(prev);
                const targetSpread = next.spec.spreads[pageIndex];
                if (!targetSpread || !Array.isArray(targetSpread.images)) {
                  return prev;
                }
                targetSpread.images.splice(index, 1);
                return next;
              })}
              onDeleteNote={(index) => onAlbumChange((prev) => {
                const next = structuredClone(prev);
                const targetSpread = next.spec.spreads[pageIndex];
                if (!targetSpread) {
                  return prev;
                }
                hydrateTextItems(targetSpread);
                if (!Array.isArray(targetSpread.text_items)) {
                  return prev;
                }
                targetSpread.text_items.splice(index, 1);
                return next;
              })}
              onDeleteDecor={(index) => onAlbumChange((prev) => {
                const next = structuredClone(prev);
                const targetSpread = next.spec.spreads[pageIndex];
                if (!targetSpread || !Array.isArray(targetSpread.decor_items)) {
                  return prev;
                }
                targetSpread.decor_items.splice(index, 1);
                return next;
              })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
