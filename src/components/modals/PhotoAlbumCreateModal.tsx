import React from 'react';

import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { PhotoAlbumAiCreateRequest } from '../../types/photoAlbums';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';

interface PhotoAlbumCreateModalProps {
  open: boolean;
  busy: boolean;
  value: PhotoAlbumAiCreateRequest;
  onChange: (next: PhotoAlbumAiCreateRequest) => void;
  onClose: () => void;
  onCreate: () => void;
}

export function PhotoAlbumCreateModal({
  open,
  busy,
  value,
  onChange,
  onClose,
  onCreate,
}: PhotoAlbumCreateModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  const setField = <K extends keyof PhotoAlbumAiCreateRequest>(key: K, nextValue: PhotoAlbumAiCreateRequest[K]) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Create Photo Album (AI)</h5>
            <ModalCloseIconButton />
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Album title</label>
                <input className="form-control" value={value.title} onChange={(e) => setField('title', e.target.value)} disabled={busy} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Memory era</label>
                <input className="form-control" value={value.memory_era} onChange={(e) => setField('memory_era', e.target.value)} disabled={busy} placeholder="1990s summer road trips" />
              </div>
              <div className="col-12">
                <label className="form-label">Album summary</label>
                <textarea className="form-control" rows={2} value={value.summary} onChange={(e) => setField('summary', e.target.value)} disabled={busy} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Mood</label>
                <input className="form-control" value={value.mood} onChange={(e) => setField('mood', e.target.value)} disabled={busy} placeholder="warm, playful, nostalgic" />
              </div>
              <div className="col-md-6">
                <label className="form-label">Dominant palette (comma-separated)</label>
                <input className="form-control" value={value.dominant_palette} onChange={(e) => setField('dominant_palette', e.target.value)} disabled={busy} placeholder="rose, sage, cream" />
              </div>
              <div className="col-md-6">
                <label className="form-label">Scrapbook materials</label>
                <input className="form-control" value={value.scrapbook_materials} onChange={(e) => setField('scrapbook_materials', e.target.value)} disabled={busy} placeholder="linen, tape, envelopes" />
              </div>
              <div className="col-md-6">
                <label className="form-label">Motif keywords</label>
                <input className="form-control" value={value.motif_keywords} onChange={(e) => setField('motif_keywords', e.target.value)} disabled={busy} placeholder="stamps, flowers, doodles" />
              </div>
              <div className="col-md-4">
                <label className="form-label">Camera style</label>
                <input className="form-control" value={value.camera_style} onChange={(e) => setField('camera_style', e.target.value)} disabled={busy} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Spread count</label>
                <input className="form-control" type="number" min={6} max={30} value={value.spread_count} onChange={(e) => setField('spread_count', Number(e.target.value) || 10)} disabled={busy} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Aspect ratio</label>
                <select className="form-select" value={value.aspect_ratio} onChange={(e) => setField('aspect_ratio', e.target.value as PhotoAlbumAiCreateRequest['aspect_ratio'])} disabled={busy}>
                  <option value="4:3">4:3</option>
                  <option value="3:2">3:2</option>
                  <option value="16:9">16:9</option>
                  <option value="1:1">1:1</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Page switch control</label>
                <select className="form-select" value={value.page_turn_style} onChange={(e) => setField('page_turn_style', e.target.value as PhotoAlbumAiCreateRequest['page_turn_style'])} disabled={busy}>
                  <option value="ribbon-tabs">Ribbon tabs</option>
                  <option value="classic-book">Classic book flip</option>
                  <option value="spiral-notebook">Spiral notebook</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Texture intensity</label>
                <select className="form-select" value={value.texture_intensity} onChange={(e) => setField('texture_intensity', e.target.value as PhotoAlbumAiCreateRequest['texture_intensity'])} disabled={busy}>
                  <option value="soft">Soft</option>
                  <option value="balanced">Balanced</option>
                  <option value="rich">Rich</option>
                </select>
              </div>
            </div>
            <div className="form-text mt-3">
              Uses standardized prompt syntax <code>CATN8_SCRAPBOOK_COVER_PROMPT_V1</code> and structured spec <code>catn8_scrapbook_spec_v1</code> for consistent album dimensions, controls, zoom, and downloads.
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={onCreate} disabled={busy}>Create Photo Album</button>
          </div>
        </div>
      </div>
    </div>
  );
}
