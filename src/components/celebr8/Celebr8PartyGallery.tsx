import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import { Celebr8Album, Celebr8Event, Celebr8Photo } from '../../types/celebr8';
import { IToast } from '../../types/common';

type Props = {
  isAdmin: boolean;
  partyId: number;
  onToast?: (toast: IToast) => void;
  onCoverChange?: (coverUrl: string | null) => void;
};

function formatPhotoDate(photo: Celebr8Photo): string {
  const raw = photo.capture_time || photo.uploaded_at;
  if (!raw) return '';
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function Celebr8PartyGallery({ isAdmin, partyId, onToast, onCoverChange }: Props) {
  const [busy, setBusy] = React.useState(false);
  const [album, setAlbum] = React.useState<Celebr8Album | null>(null);
  const [photos, setPhotos] = React.useState<Celebr8Photo[]>([]);
  const [parties, setParties] = React.useState<Celebr8Event[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [lightbox, setLightbox] = React.useState<Celebr8Photo | null>(null);
  const [captionDraft, setCaptionDraft] = React.useState('');
  const [selectMode, setSelectMode] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [moveTarget, setMoveTarget] = React.useState<number | ''>('');
  const [dragId, setDragId] = React.useState<number | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    const res = await ApiClient.get<{
      success: boolean;
      album: Celebr8Album | null;
      photos: Celebr8Photo[];
    }>(`/api/celebr8.php?action=list_photos&party_id=${partyId}&limit=200`);
    setAlbum(res.album || null);
    setPhotos(res.photos || []);
    setLoaded(true);
  }, [partyId]);

  React.useEffect(() => {
    void load().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to load photos';
      onToast?.({ tone: 'error', message });
      setLoaded(true);
    });
  }, [load, onToast]);

  React.useEffect(() => {
    if (!isAdmin) return;
    void ApiClient.get<{ success: boolean; events: Celebr8Event[] }>('/api/celebr8.php?action=list_events')
      .then((res) => setParties((res.events || []).filter((e) => e.id !== partyId)))
      .catch(() => setParties([]));
  }, [isAdmin, partyId]);

  React.useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const openLightbox = (photo: Celebr8Photo) => {
    if (selectMode) {
      toggleSelected(photo.id);
      return;
    }
    setLightbox(photo);
    setCaptionDraft(photo.caption || '');
  };

  const toggleSelected = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !isAdmin) return;
    setBusy(true);
    try {
      let uploaded = 0;
      let lastError = '';
      for (const file of Array.from(files)) {
        if (file.type && !file.type.startsWith('image/')) {
          lastError = 'Only image uploads are allowed';
          continue;
        }
        const fd = new FormData();
        fd.append('party_id', String(partyId));
        fd.append('file', file, file.name);
        if (album?.id) fd.append('album_id', String(album.id));
        const res = await ApiClient.postFormData<{
          success: boolean;
          photo: Celebr8Photo;
          album: Celebr8Album;
        }>('/api/celebr8.php?action=upload_photo', fd);
        if (res.album) setAlbum(res.album);
        uploaded += 1;
      }
      await load();
      if (lastError && uploaded === 0) {
        onToast?.({ tone: 'error', message: lastError });
      } else {
        onToast?.({
          tone: 'success',
          message: uploaded === 1 ? 'Photo uploaded' : `${uploaded} photos uploaded`,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      onToast?.({ tone: 'error', message });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const persistOrder = async (next: Celebr8Photo[]) => {
    setPhotos(next);
    setBusy(true);
    try {
      const res = await ApiClient.post<{ success: boolean; photos: Celebr8Photo[]; album: Celebr8Album }>(
        '/api/celebr8.php?action=reorder_photos',
        { party_id: partyId, photo_ids: next.map((p) => p.id) },
      );
      if (res.photos) setPhotos(res.photos);
      if (res.album) setAlbum(res.album);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to reorder';
      onToast?.({ tone: 'error', message });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const movePhotoAt = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    await persistOrder(next);
  };

  const onDropReorder = async (targetId: number) => {
    if (dragId === null || dragId === targetId) {
      setDragId(null);
      return;
    }
    const from = photos.findIndex((p) => p.id === dragId);
    const to = photos.findIndex((p) => p.id === targetId);
    setDragId(null);
    if (from < 0 || to < 0) return;
    const next = [...photos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    await persistOrder(next);
  };

  const saveCaption = async () => {
    if (!lightbox || !isAdmin) return;
    setBusy(true);
    try {
      const res = await ApiClient.post<{ success: boolean; photo: Celebr8Photo }>(
        '/api/celebr8.php?action=update_photo',
        { photo_id: lightbox.id, caption: captionDraft },
      );
      setLightbox(res.photo);
      setPhotos((prev) => prev.map((p) => (p.id === res.photo.id ? res.photo : p)));
      onToast?.({ tone: 'success', message: 'Caption saved' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update photo';
      onToast?.({ tone: 'error', message });
    } finally {
      setBusy(false);
    }
  };

  const setCover = async (photo: Celebr8Photo) => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const res = await ApiClient.post<{
        success: boolean;
        album: Celebr8Album;
        cover_url?: string;
      }>('/api/celebr8.php?action=set_cover_photo', { photo_id: photo.id });
      setAlbum(res.album);
      setPhotos((prev) => prev.map((p) => ({ ...p, is_cover: p.id === photo.id })));
      if (lightbox) setLightbox({ ...photo, is_cover: true });
      onCoverChange?.(res.cover_url || res.album?.cover_url || null);
      onToast?.({ tone: 'success', message: 'Cover photo set' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to set cover';
      onToast?.({ tone: 'error', message });
    } finally {
      setBusy(false);
    }
  };

  const moveSelectedOrOne = async (photoIds: number[], toPartyId: number) => {
    if (!isAdmin || photoIds.length === 0 || toPartyId <= 0) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/celebr8.php?action=move_photo', {
        photo_ids: photoIds,
        to_party_id: toPartyId,
      });
      if (lightbox && photoIds.includes(lightbox.id)) setLightbox(null);
      setSelected(new Set());
      setMoveTarget('');
      await load();
      onToast?.({
        tone: 'success',
        message: photoIds.length === 1 ? 'Photo moved' : `${photoIds.length} photos moved`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to move photo';
      onToast?.({ tone: 'error', message });
    } finally {
      setBusy(false);
    }
  };

  const deletePhotos = async (photoIds: number[]) => {
    if (!isAdmin || photoIds.length === 0) return;
    const label = photoIds.length === 1 ? 'Delete this photo?' : `Delete ${photoIds.length} photos?`;
    if (!window.confirm(label)) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/celebr8.php?action=delete_photo', { photo_ids: photoIds });
      setPhotos((prev) => prev.filter((p) => !photoIds.includes(p.id)));
      if (lightbox && photoIds.includes(lightbox.id)) setLightbox(null);
      setSelected(new Set());
      if (album?.cover_photo_id && photoIds.includes(album.cover_photo_id)) {
        onCoverChange?.(null);
      }
      onToast?.({ tone: 'success', message: photoIds.length === 1 ? 'Photo deleted' : 'Photos deleted' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete';
      onToast?.({ tone: 'error', message });
    } finally {
      setBusy(false);
    }
  };

  const otherParties = parties;

  return (
    <div className="celebr8-panel celebr8-album-panel">
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <h2 className="h5 mb-0">Photos</h2>
        {isAdmin ? (
          <div className="celebr8-toolbar">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="visually-hidden"
              id={`celebr8-album-upload-${partyId}`}
              onChange={(e) => void uploadFiles(e.target.files)}
            />
            <label htmlFor={`celebr8-album-upload-${partyId}`} className="btn btn-sm btn-primary mb-0">
              {busy ? 'Working…' : 'Upload'}
            </label>
            {photos.length > 0 ? (
              <button
                type="button"
                className={`btn btn-sm ${selectMode ? 'btn-secondary' : 'btn-outline-secondary'}`}
                disabled={busy}
                onClick={() => {
                  setSelectMode((v) => !v);
                  setSelected(new Set());
                }}
              >
                {selectMode ? 'Done selecting' : 'Select'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isAdmin && selectMode && selected.size > 0 ? (
        <div className="celebr8-album-bulk-bar mb-2">
          <span className="small">{selected.size} selected</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            disabled={busy}
            onClick={() => void deletePhotos([...selected])}
          >
            Delete selected
          </button>
          {otherParties.length > 0 ? (
            <>
              <select
                className="form-select form-select-sm celebr8-album-move-select"
                value={moveTarget === '' ? '' : String(moveTarget)}
                onChange={(e) => setMoveTarget(e.target.value ? Number(e.target.value) : '')}
                aria-label="Move to party"
              >
                <option value="">Move to party…</option>
                {otherParties.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={busy || moveTarget === ''}
                onClick={() => {
                  if (moveTarget === '') return;
                  void moveSelectedOrOne([...selected], moveTarget);
                }}
              >
                Move
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {!loaded ? (
        <p className="text-muted mb-0">Loading photos…</p>
      ) : photos.length === 0 ? (
        <p className="text-muted mb-0">
          No photos yet.
          {isAdmin ? ' Upload several from your phone camera roll or computer.' : ''}
        </p>
      ) : (
        <div className="celebr8-album-grid" role="list">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className={`celebr8-album-thumb-wrap${selected.has(photo.id) ? ' is-selected' : ''}${photo.is_cover ? ' is-cover' : ''}`}
              role="listitem"
              draggable={isAdmin && !selectMode}
              onDragStart={() => setDragId(photo.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void onDropReorder(photo.id)}
            >
              {selectMode ? (
                <label className="celebr8-album-check">
                  <input
                    type="checkbox"
                    checked={selected.has(photo.id)}
                    onChange={() => toggleSelected(photo.id)}
                  />
                  <span className="visually-hidden">Select photo</span>
                </label>
              ) : null}
              <button type="button" className="celebr8-album-thumb" onClick={() => openLightbox(photo)}>
                <img
                  src={photo.thumb_url || photo.url}
                  alt={photo.caption || photo.filename || 'Party photo'}
                  loading="lazy"
                />
                {photo.is_cover ? <span className="celebr8-album-cover-badge">Cover</span> : null}
                {photo.caption ? <span className="celebr8-album-thumb-cap">{photo.caption}</span> : null}
              </button>
              {isAdmin && !selectMode ? (
                <div className="celebr8-album-thumb-actions">
                  <button type="button" className="btn btn-link btn-sm px-1" disabled={busy || index === 0} onClick={() => void movePhotoAt(index, -1)} aria-label="Move up">↑</button>
                  <button type="button" className="btn btn-link btn-sm px-1" disabled={busy || index === photos.length - 1} onClick={() => void movePhotoAt(index, 1)} aria-label="Move down">↓</button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {lightbox ? (
        <div
          className="celebr8-album-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={() => setLightbox(null)}
        >
          <div className="celebr8-album-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox.url || lightbox.original_url}
              alt={lightbox.caption || lightbox.filename || 'Party photo'}
            />
            <div className="celebr8-album-lightbox-meta">
              <p className="small text-muted mb-1">{formatPhotoDate(lightbox)}</p>
              {isAdmin ? (
                <>
                  <label className="form-label small mb-1" htmlFor="celebr8-photo-caption">Caption</label>
                  <textarea
                    id="celebr8-photo-caption"
                    className="form-control form-control-sm mb-2"
                    rows={2}
                    value={captionDraft}
                    onChange={(e) => setCaptionDraft(e.target.value)}
                    disabled={busy}
                  />
                  <div className="celebr8-toolbar flex-wrap">
                    <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void saveCaption()}>
                      Save caption
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy || !!lightbox.is_cover} onClick={() => void setCover(lightbox)}>
                      {lightbox.is_cover ? 'Cover photo' : 'Set as cover'}
                    </button>
                    {otherParties.length > 0 ? (
                      <>
                        <select
                          className="form-select form-select-sm celebr8-album-move-select"
                          value={moveTarget === '' ? '' : String(moveTarget)}
                          onChange={(e) => setMoveTarget(e.target.value ? Number(e.target.value) : '')}
                          aria-label="Move to party"
                        >
                          <option value="">Move to party…</option>
                          {otherParties.map((p) => (
                            <option key={p.id} value={p.id}>{p.title}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          disabled={busy || moveTarget === ''}
                          onClick={() => {
                            if (moveTarget === '') return;
                            void moveSelectedOrOne([lightbox.id], moveTarget);
                          }}
                        >
                          Move
                        </button>
                      </>
                    ) : null}
                    <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => void deletePhotos([lightbox.id])}>
                      Delete
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setLightbox(null)}>
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {lightbox.caption ? <p className="mb-2">{lightbox.caption}</p> : null}
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setLightbox(null)}>
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
