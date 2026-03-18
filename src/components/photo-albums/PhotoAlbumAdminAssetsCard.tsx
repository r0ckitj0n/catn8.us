import React from 'react';

import { PhotoAlbum } from '../../types/photoAlbums';

interface PhotoAlbumAdminAssetsCardProps {
  busy: boolean;
  pageIndex: number;
  images: NonNullable<PhotoAlbum['spec']['spreads'][number]['images']>;
  textItems: NonNullable<PhotoAlbum['spec']['spreads'][number]['text_items']>;
  decorItems: Array<{ item: NonNullable<NonNullable<PhotoAlbum['spec']['spreads'][number]['decor_items']>[number]>; index: number }>;
  onAlbumChange: (updater: (prev: PhotoAlbum) => PhotoAlbum) => void;
  onEnsureTextItems: () => void;
}

export function PhotoAlbumAdminAssetsCard({
  busy,
  pageIndex,
  images,
  textItems,
  decorItems,
  onAlbumChange,
  onEnsureTextItems,
}: PhotoAlbumAdminAssetsCardProps) {
  return (
    <div className="catn8-card p-3 mb-3">
      <h3 className="h6">Media + Text</h3>
      <div className="d-flex gap-2 mb-2">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onEnsureTextItems} disabled={busy}>Init Text Items</button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => onAlbumChange((prev) => {
            const next = structuredClone(prev);
            const target = next.spec.spreads[pageIndex];
            if (!target) return prev;
            if (!Array.isArray(target.decor_items)) target.decor_items = [];
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
            if (!target) return prev;
            if (!Array.isArray(target.images)) target.images = [];
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
            if (!target) return prev;
            if (!Array.isArray(target.text_items)) target.text_items = [];
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
          <input className="form-control" value={image.src || ''} disabled={busy} onChange={(event) => onAlbumChange((prev) => {
            const next = structuredClone(prev);
            const target = next.spec.spreads[pageIndex]?.images?.[index];
            if (target) target.src = event.target.value;
            return next;
          })} />
          <label className="form-label mt-2">Caption</label>
          <textarea className="form-control" rows={2} value={image.caption || ''} disabled={busy} onChange={(event) => onAlbumChange((prev) => {
            const next = structuredClone(prev);
            const target = next.spec.spreads[pageIndex]?.images?.[index];
            if (target) target.caption = event.target.value;
            return next;
          })} />
          <label className="form-label mt-2">Memory Text</label>
          <textarea className="form-control" rows={2} value={image.memory_text || ''} disabled={busy} onChange={(event) => onAlbumChange((prev) => {
            const next = structuredClone(prev);
            const target = next.spec.spreads[pageIndex]?.images?.[index];
            if (target) target.memory_text = event.target.value;
            return next;
          })} />
          <div className="row g-2 mt-1">
            <div className="col-4"><label className="form-label">X%</label><input className="form-control" type="number" value={Number(image.x ?? 10)} disabled={busy} onChange={(event) => onAlbumChange((prev) => {
              const next = structuredClone(prev);
              const target = next.spec.spreads[pageIndex]?.images?.[index];
              if (target) target.x = Number(event.target.value);
              return next;
            })} /></div>
            <div className="col-4"><label className="form-label">Y%</label><input className="form-control" type="number" value={Number(image.y ?? 10)} disabled={busy} onChange={(event) => onAlbumChange((prev) => {
              const next = structuredClone(prev);
              const target = next.spec.spreads[pageIndex]?.images?.[index];
              if (target) target.y = Number(event.target.value);
              return next;
            })} /></div>
            <div className="col-4"><label className="form-label">W%</label><input className="form-control" type="number" value={Number(image.w ?? 18)} disabled={busy} onChange={(event) => onAlbumChange((prev) => {
              const next = structuredClone(prev);
              const target = next.spec.spreads[pageIndex]?.images?.[index];
              if (target) target.w = Number(event.target.value);
              return next;
            })} /></div>
          </div>
          <div className="d-flex justify-content-end mt-2">
            <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => onAlbumChange((prev) => {
              const next = structuredClone(prev);
              const target = next.spec.spreads[pageIndex];
              if (target?.images) target.images.splice(index, 1);
              return next;
            })}>Delete Media</button>
          </div>
        </div>
      ))}

      {textItems.map((item, index) => (
        <div className="catn8-admin-image-editor" key={item.id || `text-item-${index}`}>
          <label className="form-label">Text {index + 1}</label>
          <textarea className="form-control" rows={2} value={item.text || ''} disabled={busy} onChange={(event) => onAlbumChange((prev) => {
            const next = structuredClone(prev);
            const target = next.spec.spreads[pageIndex]?.text_items?.[index];
            if (target) target.text = event.target.value;
            return next;
          })} />
          <div className="row g-2 mt-1">
            <div className="col-4"><label className="form-label">X%</label><input className="form-control" type="number" value={Number(item.x ?? 10)} disabled={busy} onChange={(event) => onAlbumChange((prev) => {
              const next = structuredClone(prev);
              const target = next.spec.spreads[pageIndex]?.text_items?.[index];
              if (target) target.x = Number(event.target.value);
              return next;
            })} /></div>
            <div className="col-4"><label className="form-label">Y%</label><input className="form-control" type="number" value={Number(item.y ?? 10)} disabled={busy} onChange={(event) => onAlbumChange((prev) => {
              const next = structuredClone(prev);
              const target = next.spec.spreads[pageIndex]?.text_items?.[index];
              if (target) target.y = Number(event.target.value);
              return next;
            })} /></div>
            <div className="col-4"><label className="form-label">W%</label><input className="form-control" type="number" value={Number(item.w ?? 20)} disabled={busy} onChange={(event) => onAlbumChange((prev) => {
              const next = structuredClone(prev);
              const target = next.spec.spreads[pageIndex]?.text_items?.[index];
              if (target) target.w = Number(event.target.value);
              return next;
            })} /></div>
          </div>
          <div className="d-flex justify-content-end mt-2">
            <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => onAlbumChange((prev) => {
              const next = structuredClone(prev);
              const target = next.spec.spreads[pageIndex];
              if (target?.text_items) target.text_items.splice(index, 1);
              return next;
            })}>Delete Text</button>
          </div>
        </div>
      ))}

      {decorItems.map(({ item, index: sourceIndex }) => (
        <div className="catn8-admin-image-editor" key={item.id || `decor-${sourceIndex}`}>
          <label className="form-label">Clipart Emoji</label>
          <input className="form-control" value={item.emoji || '✨'} disabled={busy} onChange={(event) => onAlbumChange((prev) => {
            const next = structuredClone(prev);
            const target = next.spec.spreads[pageIndex]?.decor_items?.[sourceIndex];
            if (target) target.emoji = event.target.value || '✨';
            return next;
          })} />
          <div className="d-flex justify-content-end mt-2">
            <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => onAlbumChange((prev) => {
              const next = structuredClone(prev);
              const target = next.spec.spreads[pageIndex];
              if (target?.decor_items) target.decor_items.splice(sourceIndex, 1);
              return next;
            })}>Delete Clipart</button>
          </div>
        </div>
      ))}
    </div>
  );
}
