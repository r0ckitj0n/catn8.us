import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';
import { auditPhotoAlbum } from '../../utils/photoAlbumAudit';
import { sanitizeAlbumMessageText, splitAlbumMessages, toAlbumDisplayName } from '../../utils/photoAlbumText';
import { LockIcon } from './LockIcon';
import { PhotoAlbumChronologicalList } from './PhotoAlbumChronologicalList';
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
  pageFavorite?: boolean;
  isMediaFavorite?: (spreadIndex: number, mediaSourceIndex: number) => boolean;
  isTextFavorite?: (spreadIndex: number, textItemId: string) => boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onTogglePageFavorite?: (spreadIndex: number) => void;
  onToggleMediaFavorite?: (spreadIndex: number, mediaSourceIndex: number) => void;
  onToggleTextFavorite?: (spreadIndex: number, textItemId: string) => void;
  onFullscreenPreview: () => void;
  onClose: () => void;
  onSave: () => void;
  onAutoLayout: () => void;
  onAutoLayoutAllUnlocked: () => void;
  onAutoLayoutSpread: () => void;
  onToggleAlbumLock: (isLocked: boolean) => void;
  onToggleSpreadLock: (isLocked: boolean) => void;
  onDelete: () => void;
  onGenerateBackground: (scope: 'page' | 'album', prompt?: string) => void;
  onGenerateClipart: (prompt?: string) => void;
  onGenerateAccentImage: (prompt?: string) => void;
  onGenerateCoverFromFavorites: () => void;
  onRedesignPage: () => void;
  onAlbumChange: (updater: (prev: PhotoAlbum) => PhotoAlbum) => void;
  viewMode?: 'album' | 'list';
}

const saveSvg = (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4.5a1 1 0 0 0-.293-.707l-2.5-2.5A1 1 0 0 0 11.5 1H2zm1 1h8v4H3V2zm0 6h10v6H3V8zm2 1v4h6V9H5z"
    />
  </svg>
);

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
    pageFavorite = false,
    isMediaFavorite,
    isTextFavorite,
    onPrevPage,
    onNextPage,
    onTogglePageFavorite,
    onToggleMediaFavorite,
    onToggleTextFavorite,
    onFullscreenPreview,
    onClose,
    onSave,
    onAutoLayout,
    onAutoLayoutAllUnlocked,
    onAutoLayoutSpread,
    onToggleAlbumLock,
    onToggleSpreadLock,
    onDelete,
    onGenerateBackground,
    onGenerateClipart,
    onGenerateAccentImage,
    onGenerateCoverFromFavorites,
    onRedesignPage,
    onAlbumChange,
    viewMode = 'album',
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
  const albumLocked = Number(album?.is_locked || 0) === 1;
  const spreadLocked = Number(spread?.is_locked || 0) === 1;
  const decorItems = (Array.isArray(spread?.decor_items) ? spread.decor_items : [])
    .map((item, index) => ({ item, index }))
    .filter((entry) => Boolean(entry.item && typeof entry.item === 'object'));
  const [backgroundTarget, setBackgroundTarget] = React.useState<'page' | 'album'>('page');
  const [aiAssetPrompt, setAiAssetPrompt] = React.useState('');

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
      targetSpread.text_items = targetSpread.text_items.map((item, index) => {
        if (!item || typeof item !== 'object') {
          return {
            id: `text-${index}`,
            text: '',
          };
        }
        const stableId = String(item.id || '').trim() || `text-${index}`;
        return {
          ...item,
          id: stableId,
        };
      });
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
          <div className="catn8-admin-modal-header-actions">
            <div className="catn8-admin-modal-header-tools">
              <button type="button" className="btn btn-sm btn-dark" onClick={onFullscreenPreview}>Full Screen</button>
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={onAutoLayout} disabled={busy}>Auto Layout Album</button>
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={onAutoLayoutAllUnlocked} disabled={busy}>Auto Layout All Unlocked</button>
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={onAutoLayoutSpread} disabled={busy || albumLocked || spreadLocked}>Auto Layout This Spread</button>
              <button
                type="button"
                className={spreadLocked ? 'btn btn-sm catn8-lock-text-toggle is-active' : 'btn btn-sm catn8-lock-text-toggle'}
                onClick={() => onToggleSpreadLock(!spreadLocked)}
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
                onClick={() => {
                  void onSave();
                }}
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
              <div className="catn8-admin-label-with-control">
                <label className="form-label m-0">Album Title</label>
                <button
                  type="button"
                  className={albumLocked ? 'catn8-admin-inline-lock is-active' : 'catn8-admin-inline-lock'}
                  onClick={() => onToggleAlbumLock(!albumLocked)}
                  disabled={busy}
                  aria-label={albumLocked ? 'Unlock album' : 'Lock album'}
                  title={albumLocked ? 'Album locked' : 'Lock album'}
                >
                  <LockIcon locked={albumLocked} />
                </button>
              </div>
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

            </div>

            <div className="catn8-card p-3 mb-3">
              <h3 className="h6">AI Tools</h3>
              <label className="form-label">Background Prompt</label>
              <textarea
                className="form-control"
                rows={3}
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
              <div className="row g-2 mt-2">
                <div className="col-md-6">
                  <label className="form-label">Background Target</label>
                  <select
                    className="form-select"
                    value={backgroundTarget}
                    disabled={busy}
                    onChange={(event) => setBackgroundTarget(event.target.value === 'album' ? 'album' : 'page')}
                  >
                    <option value="page">This Page</option>
                    <option value="album">Whole Album</option>
                  </select>
                </div>
                <div className="col-md-6 d-flex align-items-end">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary w-100"
                    disabled={busy || albumLocked || (backgroundTarget === 'page' && spreadLocked)}
                    onClick={() => onGenerateBackground(backgroundTarget, spread?.background_prompt || '')}
                  >
                    Generate Background
                  </button>
                </div>
              </div>

              <label className="form-label mt-3">AI Asset Prompt (Optional)</label>
              <input
                className="form-control"
                value={aiAssetPrompt}
                disabled={busy}
                onChange={(event) => setAiAssetPrompt(event.target.value)}
                placeholder="Example: pressed flowers and vintage tape accents"
              />

              <div className="d-flex gap-2 flex-wrap mt-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={busy || albumLocked || spreadLocked}
                  onClick={() => onGenerateClipart(aiAssetPrompt)}
                >
                  Generate Clipart
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={busy || albumLocked || spreadLocked}
                  onClick={() => onGenerateAccentImage(aiAssetPrompt)}
                >
                  Generate Accent Image
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={busy || albumLocked}
                  onClick={onGenerateCoverFromFavorites}
                >
                  Generate Cover Page
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={busy || albumLocked || spreadLocked}
                  onClick={onRedesignPage}
                >
                  Redesign Page
                </button>
              </div>
              <div className="form-text mt-2">
                Redesign Page adjusts decorative/layout accents only and preserves existing text/media content.
              </div>
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

          <div className={viewMode === 'list' ? 'catn8-admin-preview-panel catn8-admin-preview-panel--list' : 'catn8-admin-preview-panel'}>
            {viewMode === 'list' ? (
              <PhotoAlbumChronologicalList
                album={album}
                contactDisplayName={toAlbumDisplayName(album.created_by_username || '')}
                isMediaFavorite={isMediaFavorite}
                isTextFavorite={isTextFavorite}
                onToggleMediaFavorite={onToggleMediaFavorite}
                onToggleTextFavorite={onToggleTextFavorite}
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
                onTogglePageLock={() => onToggleSpreadLock(!spreadLocked)}
                onBackToAlbums={onClose}
                editable
                onMoveMedia={(index, patch) => onAlbumChange((prev) => {
                const next = structuredClone(prev);
                const target = next.spec.spreads[pageIndex]?.images?.[index];
                if (target) {
                  target.x = patch.x;
                  target.y = patch.y;
                  if (typeof patch.w === 'number') {
                    target.w = patch.w;
                  }
                  if (typeof patch.h === 'number') {
                    (target as any).h = patch.h;
                  }
                }
                return next;
                })}
                onMoveNote={(noteId, index, patch) => onAlbumChange((prev) => {
                const next = structuredClone(prev);
                const targetSpread = next.spec.spreads[pageIndex];
                if (!targetSpread) {
                  return prev;
                }
                hydrateTextItems(targetSpread);
                if (!Array.isArray(targetSpread.text_items)) {
                  targetSpread.text_items = [];
                }
                const stableNoteId = String(noteId || `spread-note-${index}`).trim();
                let targetIndex = targetSpread.text_items.findIndex((item) => String(item?.id || '') === stableNoteId);
                if (targetIndex < 0 && index >= 0 && index < targetSpread.text_items.length) {
                  // Notes are rendered text_items-first; when legacy items lack ids, recover by index.
                  const candidate = targetSpread.text_items[index];
                  if (candidate && typeof candidate === 'object') {
                    candidate.id = String(candidate.id || '').trim() || stableNoteId;
                    targetIndex = index;
                  }
                }
                if (targetIndex >= 0) {
                  targetSpread.text_items[targetIndex].x = patch.x;
                  targetSpread.text_items[targetIndex].y = patch.y;
                  if (typeof patch.w === 'number') {
                    targetSpread.text_items[targetIndex].w = patch.w;
                  }
                  if (typeof patch.h === 'number') {
                    (targetSpread.text_items[targetIndex] as any).h = patch.h;
                  }
                  return next;
                }

                if (!targetSpread.note_layout || typeof targetSpread.note_layout !== 'object') {
                  targetSpread.note_layout = {};
                }
                const existing = targetSpread.note_layout[stableNoteId] || {};
                targetSpread.note_layout[stableNoteId] = {
                  ...existing,
                  x: patch.x,
                  y: patch.y,
                  ...(typeof patch.w === 'number' ? { w: patch.w } : {}),
                  ...(typeof patch.h === 'number' ? { h: patch.h } : {}),
                  ...(typeof (existing as any).rotation === 'number' ? { rotation: (existing as any).rotation } : {}),
                };
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
