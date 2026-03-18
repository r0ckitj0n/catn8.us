import React from 'react';

import { StandardIconButton } from '../../components/common/StandardIconButton';

interface BuildWizardDocumentUploadModalProps {
  busy: boolean;
  docKind: string;
  docKindOptions: Array<{ value: string; label: string }>;
  docPhaseKey: string;
  docStepId: number;
  file: File | null;
  onClose: () => void;
  onFileChange: (file: File | null) => void;
  open: boolean;
  phaseOptions: Array<{ value: string; label: string }>;
  selectableDocSteps: Array<{ id: number; step_order: number; title: string }>;
  setDocKind: (value: string) => void;
  setDocPhaseKey: (value: string) => void;
  setDocStepId: (value: number) => void;
  uploadDocument: (kind: string, file: File, stepId?: number, caption?: string, phaseKey?: string) => Promise<unknown>;
}

export function BuildWizardDocumentUploadModal({
  busy,
  docKind,
  docKindOptions,
  docPhaseKey,
  docStepId,
  file,
  onClose,
  onFileChange,
  open,
  phaseOptions,
  selectableDocSteps,
  setDocKind,
  setDocPhaseKey,
  setDocStepId,
  uploadDocument,
}: BuildWizardDocumentUploadModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="build-wizard-doc-manager" onClick={onClose}>
      <div className="build-wizard-doc-manager-inner build-wizard-upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="build-wizard-doc-manager-head">
          <h3>Upload Document</h3>
          <div className="build-wizard-doc-manager-actions">
            <StandardIconButton iconKey="close" ariaLabel="Close upload dialog" title="Close" className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn" onClick={onClose} />
          </div>
        </div>
        <div className="build-wizard-doc-manager-grid">
          <label>
            Kind
            <select value={docKind} onChange={(e) => setDocKind(e.target.value)}>
              {docKindOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label>
            Phase
            <select value={docPhaseKey} onChange={(e) => setDocPhaseKey(e.target.value)}>
              {phaseOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="is-wide">
            Linked Step
            <select value={docStepId > 0 ? String(docStepId) : ''} onChange={(e) => setDocStepId(Number(e.target.value || '0'))}>
              <option value="">Auto-link by phase</option>
              {selectableDocSteps.map((step) => (
                <option key={step.id} value={step.id}>#{step.step_order} {step.title}</option>
              ))}
            </select>
          </label>
          <label className="is-wide">
            File
            <input type="file" onChange={(e) => onFileChange(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
          </label>
        </div>
        <div className="build-wizard-doc-manager-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || !file}
            onClick={() => {
              if (!file || busy) {
                return;
              }
              void uploadDocument(docKind, file, docStepId > 0 ? docStepId : undefined, undefined, docPhaseKey)
                .then(() => {
                  onClose();
                  onFileChange(null);
                });
            }}
          >
            {busy ? 'Uploading...' : 'Upload'}
          </button>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { onClose(); onFileChange(null); }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
