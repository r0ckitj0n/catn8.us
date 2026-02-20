import React from 'react';

type LocationProfileFieldsProps = {
  busy: boolean;
  isAdmin: boolean;
  fields: any;
  setFields: React.Dispatch<React.SetStateAction<any>>;
};

export function LocationProfileFields({ busy, isAdmin, fields, setFields }: LocationProfileFieldsProps) {
  return (
    <div className="row g-2">
      <div className="col-12"><label className="form-label">Location ID</label><input className="form-control" value={fields.location_id || ''} onChange={(e) => setFields((p: any) => ({ ...p, location_id: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">Address Line 1</label><input className="form-control" value={fields.address_line1 || ''} onChange={(e) => setFields((p: any) => ({ ...p, address_line1: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">Address Line 2</label><input className="form-control" value={fields.address_line2 || ''} onChange={(e) => setFields((p: any) => ({ ...p, address_line2: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">City</label><input className="form-control" value={fields.city || ''} onChange={(e) => setFields((p: any) => ({ ...p, city: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-6"><label className="form-label">Region/State</label><input className="form-control" value={fields.region || ''} onChange={(e) => setFields((p: any) => ({ ...p, region: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-6"><label className="form-label">Postal Code</label><input className="form-control" value={fields.postal_code || ''} onChange={(e) => setFields((p: any) => ({ ...p, postal_code: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">Country</label><input className="form-control" value={fields.country || ''} onChange={(e) => setFields((p: any) => ({ ...p, country: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12 mt-3">
        <div className="fw-bold small">AI Generation Prompts</div>
        <label className="form-label smallest text-muted mt-1">Base Image Prompt</label>
        <textarea className="form-control form-control-sm" rows={2} value={fields.base_image_prompt || ''} onChange={(e) => setFields((p: any) => ({ ...p, base_image_prompt: e.target.value }))} disabled={busy || !isAdmin} />
        <label className="form-label smallest text-muted mt-2">Overlay Asset Prompt</label>
        <textarea className="form-control form-control-sm" rows={2} value={fields.overlay_asset_prompt || ''} onChange={(e) => setFields((p: any) => ({ ...p, overlay_asset_prompt: e.target.value }))} disabled={busy || !isAdmin} />
        <label className="form-label smallest text-muted mt-2">Overlay Trigger</label>
        <input className="form-control form-control-sm" value={fields.overlay_trigger || ''} onChange={(e) => setFields((p: any) => ({ ...p, overlay_trigger: e.target.value }))} disabled={busy || !isAdmin} />
      </div>
    </div>
  );
}
