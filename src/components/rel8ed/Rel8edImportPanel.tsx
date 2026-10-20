import React from 'react';

import type { Rel8edImportPreview } from '../../types/rel8ed';

type Props = {
  importPreview: Rel8edImportPreview | null;
  onPreviewFile: (file: File) => void;
  onApply: (importId: number) => void;
  onCancel: () => void;
};

export function Rel8edImportPanel({ importPreview, onPreviewFile, onApply, onCancel }: Props) {
  return (
    <section className="rel8ed-section">
      <h2>GEDCOM import / export</h2>
      <input
        type="file"
        accept=".ged,.GED,text/plain"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          onPreviewFile(file);
          e.target.value = '';
        }}
      />
      {importPreview ? (
        <div className="rel8ed-diff">
          <p>
            Import #{importPreview.import_id}: +{importPreview.diff?.people_added ?? 0} people,
            −{importPreview.diff?.people_removed ?? 0}, ~{importPreview.diff?.people_changed ?? 0} changed;
            families +{importPreview.diff?.families_added ?? 0}/−{importPreview.diff?.families_removed ?? 0}
          </p>
          <pre>{JSON.stringify(importPreview.counts, null, 2)}</pre>
          <button type="button" className="btn btn-sm btn-success" onClick={() => onApply(importPreview.import_id)}>
            Apply import
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      ) : null}
      <p>
        <a className="btn btn-sm btn-outline-secondary" href="/api/rel8ed.php?action=export_gedcom">
          Download GEDCOM export
        </a>
      </p>
    </section>
  );
}
