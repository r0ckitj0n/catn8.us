import React from 'react';

type WeaponProfileFieldsProps = {
  busy: boolean;
  isAdmin: boolean;
  fields: any;
  setFields: React.Dispatch<React.SetStateAction<any>>;
};

export function WeaponProfileFields({ busy, isAdmin, fields, setFields }: WeaponProfileFieldsProps) {
  return (
    <div className="row g-2">
      <div className="col-12">
        <label className="form-label">Fingerprints (one per line)</label>
        <textarea
          className="form-control"
          rows={3}
          value={(fields.fingerprints || []).join('\n')}
          onChange={(e) => setFields((p: any) => ({ ...p, fingerprints: e.target.value.split('\n').filter(Boolean) }))}
          disabled={busy || !isAdmin}
        />
      </div>
    </div>
  );
}
