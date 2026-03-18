import React from 'react';

import { StandardIconButton } from '../../components/common/StandardIconButton';
import { StandardIconLink } from '../../components/common/StandardIconLink';
import { WebpImage } from '../../components/common/WebpImage';
import { buildWizardTokenLabel } from '../buildWizardDropdownSettings';
import { formatTimelineDate, isPdfDocument, prettyPhaseLabel, thumbnailKindLabel, withDownloadFlag } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';

type DocumentDraft = {
  caption: string;
  kind: string;
  receipt_amount: string;
  receipt_date: string;
  receipt_notes: string;
  receipt_title: string;
  receipt_vendor: string;
  step_id: number;
};

interface BuildWizardProjectDeskDocumentsProps {
  buildDocumentDraft: (doc: IBuildWizardDocument) => DocumentDraft;
  deletingDocumentId: number;
  docKindOptions: Array<{ value: string; label: string }>;
  documentManagerKindFilter: string;
  documentManagerKindOptions: string[];
  documentManagerLinkedStepFilterOptions: Array<{ label: string; step: IBuildWizardStep }>;
  documentManagerPhaseFilter: string;
  documentManagerPhaseOptions: string[];
  documentManagerQuery: string;
  documentManagerSearchLoading: boolean;
  documentManagerSearchResultById: Map<number, { snippet?: string }>;
  documentManagerStepFilter: string;
  documentSavingId: number;
  documents: IBuildWizardDocument[];
  filteredDocumentManagerDocs: IBuildWizardDocument[];
  isPlanPreviewDoc: (doc: IBuildWizardDocument) => boolean;
  isSpreadsheetPreviewDoc: (doc: IBuildWizardDocument) => boolean;
  linkedStepOptions: Array<{ label: string; step: IBuildWizardStep }>;
  onDeleteDocument: (id: number, originalName: string) => Promise<unknown>;
  onOpenUploadModal: () => void;
  onReplaceDocumentFile: (doc: IBuildWizardDocument, file: File | null) => Promise<unknown>;
  onSaveDocumentDraft: (doc: IBuildWizardDocument) => Promise<unknown>;
  openDocumentPreview: (doc: IBuildWizardDocument) => Promise<unknown>;
  project: { blueprint_document_id?: number | null; primary_photo_document_id?: number | null } | null;
  replaceFileInputByDocId: React.MutableRefObject<Record<number, HTMLInputElement | null>>;
  replacingDocumentId: number;
  setDocumentManagerKindFilter: (value: string) => void;
  setDocumentManagerPhaseFilter: (value: string) => void;
  setDocumentManagerQuery: (value: string) => void;
  setDocumentManagerStepFilter: (value: string) => void;
  steps: IBuildWizardStep[];
  updateDocumentDraft: (documentId: number, patch: Partial<DocumentDraft>) => void;
  updateProject: (patch: { blueprint_document_id?: number | null; primary_photo_document_id?: number | null }) => Promise<unknown>;
}

export function BuildWizardProjectDeskDocuments({
  buildDocumentDraft,
  deletingDocumentId,
  docKindOptions,
  documentManagerKindFilter,
  documentManagerKindOptions,
  documentManagerLinkedStepFilterOptions,
  documentManagerPhaseFilter,
  documentManagerPhaseOptions,
  documentManagerQuery,
  documentManagerSearchLoading,
  documentManagerSearchResultById,
  documentManagerStepFilter,
  documentSavingId,
  documents,
  filteredDocumentManagerDocs,
  isPlanPreviewDoc,
  isSpreadsheetPreviewDoc,
  linkedStepOptions,
  onDeleteDocument,
  onOpenUploadModal,
  onReplaceDocumentFile,
  onSaveDocumentDraft,
  openDocumentPreview,
  project,
  replaceFileInputByDocId,
  replacingDocumentId,
  setDocumentManagerKindFilter,
  setDocumentManagerPhaseFilter,
  setDocumentManagerQuery,
  setDocumentManagerStepFilter,
  steps,
  updateDocumentDraft,
  updateProject,
}: BuildWizardProjectDeskDocumentsProps) {
  return (
    <div className="build-wizard-desk-documents">
      <div className="build-wizard-doc-manager-head">
        <h3>Documents</h3>
        <div className="build-wizard-doc-manager-actions">
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={onOpenUploadModal}>Upload Document</button>
        </div>
      </div>
      {documents.length ? (
        <div className="build-wizard-doc-manager-list">
          <div className="build-wizard-doc-manager-filters">
            <label>
              Kind
              <select value={documentManagerKindFilter} onChange={(e) => setDocumentManagerKindFilter(e.target.value)}>
                <option value="all">All</option>
                {documentManagerKindOptions.map((kindValue) => (
                  <option key={kindValue} value={kindValue}>{buildWizardTokenLabel(kindValue, 'Other')}</option>
                ))}
              </select>
            </label>
            <label>
              Phase
              <select value={documentManagerPhaseFilter} onChange={(e) => setDocumentManagerPhaseFilter(e.target.value)}>
                <option value="all">All</option>
                {documentManagerPhaseOptions.map((phaseKey) => (
                  <option key={phaseKey} value={phaseKey}>{prettyPhaseLabel(phaseKey)}</option>
                ))}
              </select>
            </label>
            <label>
              Linked Step
              <select value={documentManagerStepFilter} onChange={(e) => setDocumentManagerStepFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="unlinked">No step linked</option>
                {documentManagerLinkedStepFilterOptions.map((option) => (
                  <option key={`doc-filter-step-${option.step.id}`} value={String(option.step.id)}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Query Index
              <input type="search" value={documentManagerQuery} onChange={(e) => setDocumentManagerQuery(e.target.value)} placeholder="Search indexed document text..." />
            </label>
          </div>
          {documentManagerQuery.trim().length >= 2 ? (
            <div className="build-wizard-muted">
              {documentManagerSearchLoading ? 'Searching index...' : `Index matches: ${filteredDocumentManagerDocs.length}`}
            </div>
          ) : null}
          {filteredDocumentManagerDocs.length ? filteredDocumentManagerDocs.map((doc) => {
            const draft = buildDocumentDraft(doc);
            const selectedStep = steps.find((step) => step.id === Number(draft.step_id || 0));
            const phaseLabel = prettyPhaseLabel(selectedStep?.phase_key || doc.step_phase_key || 'general');
            const indexedHit = documentManagerSearchResultById.get(doc.id);

            return (
              <div className="build-wizard-doc-manager-row" key={doc.id}>
                <div className="build-wizard-doc-manager-preview">
                  {Number(doc.is_image) === 1 ? (
                    <button className="build-wizard-doc-thumb-btn" onClick={() => void openDocumentPreview(doc)} title="Open preview">
                      <WebpImage src={doc.thumbnail_url || doc.public_url} alt={doc.original_name} className="build-wizard-doc-thumb" />
                    </button>
                  ) : isPdfDocument(doc) ? (
                    <button type="button" className="build-wizard-doc-thumb-link" onClick={() => void openDocumentPreview(doc)} title="Open preview">
                      <WebpImage src={doc.thumbnail_url || doc.public_url} alt={`${doc.original_name} preview`} className="build-wizard-doc-thumb" />
                    </button>
                  ) : (isSpreadsheetPreviewDoc(doc) || isPlanPreviewDoc(doc)) ? (
                    <button type="button" className="build-wizard-doc-file-link build-wizard-doc-file-link-rich" onClick={() => void openDocumentPreview(doc)} title="Open preview">
                      <span className="build-wizard-doc-file-glyph" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5" /><path d="M9 13h6M9 16h6" /></svg></span>
                      <span className="build-wizard-doc-file-ext">{thumbnailKindLabel(doc)}</span>
                      <span className="build-wizard-doc-file-open">Open preview</span>
                    </button>
                  ) : (
                    <button type="button" className="build-wizard-doc-file-link build-wizard-doc-file-link-rich" onClick={() => void openDocumentPreview(doc)}>
                      <span className="build-wizard-doc-file-glyph" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5" /><path d="M9 13h6M9 16h6" /></svg></span>
                      <span className="build-wizard-doc-file-ext">{thumbnailKindLabel(doc)}</span>
                      <span className="build-wizard-doc-file-open">Open file</span>
                    </button>
                  )}
                </div>
                <div className="build-wizard-doc-manager-fields">
                  <div className="build-wizard-doc-manager-title">{doc.original_name}</div>
                  <div className="build-wizard-doc-manager-meta">Uploaded: {formatTimelineDate(doc.uploaded_at)} | Phase: {phaseLabel}</div>
                  {indexedHit?.snippet ? <div className="build-wizard-muted">{indexedHit.snippet}</div> : null}
                  <div className="build-wizard-doc-manager-grid">
                    <label>
                      Kind
                      <select value={draft.kind} onChange={(e) => updateDocumentDraft(doc.id, { kind: e.target.value })}>
                        {docKindOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Linked Step
                      <select className="build-wizard-doc-manager-step-select" value={draft.step_id > 0 ? String(draft.step_id) : ''} onChange={(e) => updateDocumentDraft(doc.id, { step_id: Number(e.target.value || '0') })}>
                        <option value="">No step linked</option>
                        {linkedStepOptions.map((option) => (
                          <option key={option.step.id} value={option.step.id}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="is-wide">
                      Caption
                      <input type="text" value={draft.caption} onChange={(e) => updateDocumentDraft(doc.id, { caption: e.target.value })} />
                    </label>
                    {draft.kind === 'receipt' ? (
                      <>
                        <label>
                          Receipt Title
                          <input type="text" value={draft.receipt_title} onChange={(e) => updateDocumentDraft(doc.id, { receipt_title: e.target.value })} />
                        </label>
                        <label>
                          Receipt Vendor
                          <input type="text" value={draft.receipt_vendor} onChange={(e) => updateDocumentDraft(doc.id, { receipt_vendor: e.target.value })} />
                        </label>
                        <label>
                          Task Date Override
                          <input type="date" value={draft.receipt_date} onChange={(e) => updateDocumentDraft(doc.id, { receipt_date: e.target.value })} />
                        </label>
                        <label>
                          Receipt Amount
                          <input type="number" min="0" step="0.01" inputMode="decimal" value={draft.receipt_amount} onChange={(e) => updateDocumentDraft(doc.id, { receipt_amount: e.target.value })} />
                        </label>
                        <label className="is-wide">
                          Receipt Notes
                          <input type="text" value={draft.receipt_notes} onChange={(e) => updateDocumentDraft(doc.id, { receipt_notes: e.target.value })} />
                        </label>
                      </>
                    ) : null}
                  </div>
                  <div className="build-wizard-doc-manager-actions">
                    <StandardIconButton iconKey="view" ariaLabel={`Open ${doc.original_name}`} title="Open" className="btn btn-outline-primary btn-sm catn8-action-icon-btn" onClick={() => void openDocumentPreview(doc)} />
                    <StandardIconLink iconKey="download" ariaLabel={`Download ${doc.original_name}`} title="Download" className="btn btn-outline-secondary btn-sm catn8-action-icon-btn" href={withDownloadFlag(doc.public_url)} />
                    <input
                      ref={(el) => { replaceFileInputByDocId.current[doc.id] = el; }}
                      type="file"
                      className="build-wizard-hidden-file-input"
                      onChange={(e) => {
                        const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                        void onReplaceDocumentFile(doc, file);
                        e.currentTarget.value = '';
                      }}
                    />
                    <StandardIconButton iconKey={replacingDocumentId === doc.id ? 'refresh' : 'upload'} ariaLabel={replacingDocumentId === doc.id ? `Replacing ${doc.original_name}` : `Replace ${doc.original_name}`} title={replacingDocumentId === doc.id ? 'Replacing...' : 'Replace'} className="btn btn-outline-secondary btn-sm catn8-action-icon-btn" onClick={() => replaceFileInputByDocId.current[doc.id]?.click()} disabled={replacingDocumentId === doc.id} />
                    {Number(doc.is_image) === 1 ? (
                      <button className="btn btn-outline-primary btn-sm" onClick={() => void updateProject({ primary_photo_document_id: doc.id })}>
                        {Number(project?.primary_photo_document_id || 0) === doc.id ? 'Primary Photo' : 'Set Primary Photo'}
                      </button>
                    ) : null}
                    {String(doc.kind || '') === 'blueprint' ? (
                      <button className="btn btn-outline-primary btn-sm" onClick={() => void updateProject({ blueprint_document_id: doc.id })}>
                        {Number(project?.blueprint_document_id || 0) === doc.id ? 'Primary Blueprint' : 'Set Primary Blueprint'}
                      </button>
                    ) : null}
                    <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void onSaveDocumentDraft(doc)} disabled={documentSavingId === doc.id || Number(draft.step_id || 0) <= 0} title={Number(draft.step_id || 0) > 0 ? 'Attach this document to the selected step' : 'Select a step first'}>Attach to Step</button>
                    <StandardIconButton iconKey={documentSavingId === doc.id ? 'refresh' : 'save'} ariaLabel={documentSavingId === doc.id ? `Saving ${doc.original_name}` : `Save ${doc.original_name}`} title={documentSavingId === doc.id ? 'Saving...' : 'Save'} className="btn btn-success btn-sm catn8-action-icon-btn" onClick={() => void onSaveDocumentDraft(doc)} disabled={documentSavingId === doc.id} />
                    <StandardIconButton iconKey={deletingDocumentId === doc.id ? 'refresh' : 'delete'} ariaLabel={deletingDocumentId === doc.id ? `Deleting ${doc.original_name}` : `Delete ${doc.original_name}`} title={deletingDocumentId === doc.id ? 'Deleting...' : 'Delete'} className="btn btn-outline-danger btn-sm catn8-action-icon-btn" onClick={() => void onDeleteDocument(doc.id, doc.original_name)} disabled={deletingDocumentId === doc.id} />
                  </div>
                </div>
              </div>
            );
          }) : <div className="build-wizard-muted">No documents match the selected filters.</div>}
        </div>
      ) : (
        <div className="build-wizard-muted">No documents uploaded yet.</div>
      )}
    </div>
  );
}
