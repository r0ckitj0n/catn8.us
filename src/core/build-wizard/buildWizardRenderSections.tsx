import React from 'react';

import { StandardIconButton } from '../../components/common/StandardIconButton';
import { WebpImage } from '../../components/common/WebpImage';
import { IBuildWizardDocument } from '../../types/buildWizard';
import { prettyPhaseLabel, isPdfDocument, thumbnailKindLabel } from '../../components/pages/build-wizard/buildWizardUtils';

interface BuildWizardDocumentGalleryProps {
  emptyText: string;
  isPlanPreviewDoc: (doc: IBuildWizardDocument) => boolean;
  isSpreadsheetPreviewDoc: (doc: IBuildWizardDocument) => boolean;
  items: IBuildWizardDocument[];
  openDocumentPreview: (doc: IBuildWizardDocument) => void;
  onRemoveDocumentFromStep: (id: number, originalName: string) => void;
  readOnly?: boolean;
  unlinkingDocumentId: number;
}

export function BuildWizardDocumentGallery({
  emptyText,
  isPlanPreviewDoc,
  isSpreadsheetPreviewDoc,
  items,
  openDocumentPreview,
  onRemoveDocumentFromStep,
  readOnly = false,
  unlinkingDocumentId,
}: BuildWizardDocumentGalleryProps) {
  if (!items.length) {
    return <div className="build-wizard-muted">{emptyText}</div>;
  }

  return (
    <div className="build-wizard-doc-gallery">
      {items.map((doc) => (
        <div className="build-wizard-doc-card" key={doc.id}>
          {Number(doc.is_image) === 1 ? (
            <button className="build-wizard-doc-thumb-btn" onClick={() => openDocumentPreview(doc)} title="Click to enlarge">
              <WebpImage src={doc.thumbnail_url || doc.public_url} alt={doc.original_name} className="build-wizard-doc-thumb" />
            </button>
          ) : isPdfDocument(doc) ? (
            <button type="button" className="build-wizard-doc-thumb-link" onClick={() => openDocumentPreview(doc)} title="Open preview">
              <WebpImage src={doc.thumbnail_url || doc.public_url} alt={`${doc.original_name} preview`} className="build-wizard-doc-thumb" />
            </button>
          ) : (isSpreadsheetPreviewDoc(doc) || isPlanPreviewDoc(doc)) ? (
            <button type="button" className="build-wizard-doc-file-link build-wizard-doc-file-link-rich" onClick={() => openDocumentPreview(doc)} title="Open preview">
              <span className="build-wizard-doc-file-glyph" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5" /><path d="M9 13h6M9 16h6" /></svg>
              </span>
              <span className="build-wizard-doc-file-ext">{thumbnailKindLabel(doc)}</span>
              <span className="build-wizard-doc-file-open">Open preview</span>
            </button>
          ) : (
            <button type="button" className="build-wizard-doc-file-link build-wizard-doc-file-link-rich" onClick={() => openDocumentPreview(doc)}>
              <span className="build-wizard-doc-file-glyph" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5" /><path d="M9 13h6M9 16h6" /></svg>
              </span>
              <span className="build-wizard-doc-file-ext">{thumbnailKindLabel(doc)}</span>
              <span className="build-wizard-doc-file-open">Open file</span>
            </button>
          )}
          <button
            type="button"
            className="build-wizard-doc-delete-btn"
            title={unlinkingDocumentId === doc.id ? 'Removing...' : 'Remove from step'}
            aria-label={unlinkingDocumentId === doc.id ? `Removing ${doc.original_name} from step` : `Remove ${doc.original_name} from step`}
            onClick={() => void onRemoveDocumentFromStep(doc.id, doc.original_name)}
            disabled={readOnly || unlinkingDocumentId === doc.id}
          >
            <svg viewBox="0 0 24 24" className="build-wizard-doc-delete-icon" aria-hidden="true">
              <path d="M9 3h6a1 1 0 0 1 1 1v1h4v2h-1v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7H4V5h4V4a1 1 0 0 1 1-1Zm1 2v0h4V5h-4Zm-3 2v12h10V7H7Zm2 2h2v8H9V9Zm4 0h2v8h-2V9Z" />
            </svg>
          </button>
          <div className="build-wizard-doc-name">{doc.original_name}</div>
          <div className="build-wizard-doc-meta">
            <span>{doc.kind}</span>
            <span>{prettyPhaseLabel(doc.step_phase_key)}</span>
            <span>{doc.step_title || 'No Step Linked'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

interface BuildWizardProjectPhotosSectionProps {
  docKind: string;
  docKindOptions: Array<{ value: string; label: string }>;
  docPhaseKey: string;
  docStepId: number;
  phaseOptions: Array<{ value: string; label: string }>;
  primaryBlueprintChoices: IBuildWizardDocument[];
  primaryPhotoChoices: IBuildWizardDocument[];
  project: { blueprint_document_id?: number | null; primary_photo_document_id?: number | null } | null;
  projectDocuments: IBuildWizardDocument[];
  renderDocumentGallery: (items: IBuildWizardDocument[], emptyText: string, readOnly?: boolean) => React.ReactNode;
  selectableDocSteps: Array<{ id: number; step_order: number; title: string }>;
  setDocKind: (value: string) => void;
  setDocPhaseKey: (value: string) => void;
  setDocStepId: (value: number) => void;
  updateProject: (patch: { primary_photo_document_id?: number | null; blueprint_document_id?: number | null }) => Promise<unknown>;
  uploadDocument: (kind: string, file: File, stepId?: number, caption?: string, phaseKey?: string) => Promise<unknown>;
}

export function BuildWizardProjectPhotosSection({
  docKind,
  docKindOptions,
  docPhaseKey,
  docStepId,
  phaseOptions,
  primaryBlueprintChoices,
  primaryPhotoChoices,
  project,
  projectDocuments,
  renderDocumentGallery,
  selectableDocSteps,
  setDocKind,
  setDocPhaseKey,
  setDocStepId,
  updateProject,
  uploadDocument,
}: BuildWizardProjectPhotosSectionProps) {
  return (
    <>
      <div className="build-wizard-section-divider" />
      <h3>Project Photos & Key Paperwork</h3>
      <div className="build-wizard-upload-row">
        <select value={docKind} onChange={(e) => setDocKind(e.target.value)}>
          {docKindOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <select value={docPhaseKey} onChange={(e) => setDocPhaseKey(e.target.value)}>
          {phaseOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <select value={docStepId > 0 ? String(docStepId) : ''} onChange={(e) => setDocStepId(Number(e.target.value || '0'))}>
          <option value="">Auto-link by phase</option>
          {selectableDocSteps.map((step) => <option key={step.id} value={step.id}>#{step.step_order} {step.title}</option>)}
        </select>
        <input
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={(e) => {
            const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
            if (file) void uploadDocument(docKind, file, docStepId > 0 ? docStepId : undefined, undefined, docPhaseKey);
            e.currentTarget.value = '';
          }}
        />
      </div>
      <div className="build-wizard-upload-row build-wizard-primary-row">
        <label>
          Primary Project Photo
          <select value={Number(project?.primary_photo_document_id || 0) > 0 ? String(project?.primary_photo_document_id) : ''} onChange={(e) => { const nextId = Number(e.target.value || '0'); void updateProject({ primary_photo_document_id: nextId > 0 ? nextId : null }); }}>
            <option value="">No primary photo</option>
            {primaryPhotoChoices.map((doc) => <option key={doc.id} value={doc.id}>{doc.original_name}</option>)}
          </select>
        </label>
        <label>
          Primary Blueprint
          <select value={Number(project?.blueprint_document_id || 0) > 0 ? String(project?.blueprint_document_id) : ''} onChange={(e) => { const nextId = Number(e.target.value || '0'); void updateProject({ blueprint_document_id: nextId > 0 ? nextId : null }); }}>
            <option value="">No primary blueprint</option>
            {primaryBlueprintChoices.map((doc) => <option key={doc.id} value={doc.id}>{doc.original_name}</option>)}
          </select>
        </label>
      </div>
      {renderDocumentGallery(projectDocuments, 'No project media yet.')}
    </>
  );
}

interface BuildWizardLauncherProps {
  deletingProjectId: number;
  launcherProjects: Array<{ id: number; title: string; primary_photo_thumbnail_url?: string | null; primary_blueprint_thumbnail_url?: string | null }>;
  newHomeWastewaterKind: 'septic' | 'public_sewer';
  newHomeWaterKind: 'county_water' | 'private_well';
  onCloseWizard: () => void;
  onCreateNewBuild: () => Promise<unknown>;
  onDeleteProject: (project: { id: number; title: string }) => Promise<unknown>;
  onOpenTemplateEditor: () => void;
  openBuild: (projectId: number, entryPoint: 'launcher' | 'template_editor') => Promise<unknown>;
  setNewHomeWastewaterKind: (value: 'septic' | 'public_sewer') => void;
  setNewHomeWaterKind: (value: 'county_water' | 'private_well') => void;
}

export function BuildWizardLauncher(props: BuildWizardLauncherProps) {
  const { deletingProjectId, launcherProjects, newHomeWastewaterKind, newHomeWaterKind, onCloseWizard, onCreateNewBuild, onDeleteProject, onOpenTemplateEditor, openBuild, setNewHomeWastewaterKind, setNewHomeWaterKind } = props;
  return (
    <div className="build-wizard-shell">
      <div className="build-wizard-launcher">
        <div className="build-wizard-page-close">
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={onOpenTemplateEditor}>Template Editor</button>
          <StandardIconButton iconKey="close" ariaLabel="Close FABRIC8" title="Close FABRIC8" className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn" onClick={onCloseWizard} />
        </div>
        <h1>FABRIC8</h1>
        <p>Choose an existing build or start a new build.</p>
        <div className="build-wizard-launcher-grid">
          <div className="build-wizard-launch-card is-new">
            <button type="button" className="build-wizard-launch-icon-btn" onClick={() => void onCreateNewBuild()} aria-label="Create a new home build project" title="Create a new home build project">
              <div className="build-wizard-thumb"><div className="build-wizard-thumb-roof" /><div className="build-wizard-thumb-body" /></div>
            </button>
            <span className="build-wizard-launch-title">Build a New Home</span>
            <div className="build-wizard-launcher-template-picker">
              <label htmlFor="build-wizard-template-wastewater-kind">Wastewater setup</label>
              <select id="build-wizard-template-wastewater-kind" className="form-select form-select-sm" value={newHomeWastewaterKind} onChange={(e) => setNewHomeWastewaterKind(String(e.target.value || '').trim() === 'public_sewer' ? 'public_sewer' : 'septic')}>
                <option value="septic">Dawson County Home - Septic</option>
                <option value="public_sewer">Dawson County Home - Public Sewer</option>
              </select>
            </div>
            <div className="build-wizard-launcher-template-picker">
              <label htmlFor="build-wizard-template-water-kind">Water source</label>
              <select id="build-wizard-template-water-kind" className="form-select form-select-sm" value={newHomeWaterKind} onChange={(e) => setNewHomeWaterKind(String(e.target.value || '').trim() === 'private_well' ? 'private_well' : 'county_water')}>
                <option value="county_water">County Water (Etowah Water &amp; Sewer)</option>
                <option value="private_well">Private Well</option>
              </select>
            </div>
          </div>
          {launcherProjects.map((p) => (
            <div key={p.id} className="build-wizard-launch-card build-wizard-launch-card-with-delete" style={{ ['--thumb-tone' as any]: `${(p.id * 37) % 360}deg` }}>
              <button type="button" className="build-wizard-launch-card-open" onClick={() => void openBuild(p.id, 'launcher')} title={`Open ${p.title}`}>
                <div className="build-wizard-thumb build-wizard-thumb-media">
                  <div className="build-wizard-thumb-media-main">{p.primary_photo_thumbnail_url ? <WebpImage src={p.primary_photo_thumbnail_url} alt={`${p.title} primary photo`} className="build-wizard-thumb-media-image" /> : <div className="build-wizard-thumb-fallback">Photo</div>}</div>
                  <div className="build-wizard-thumb-media-overlay">{p.primary_blueprint_thumbnail_url ? <WebpImage src={p.primary_blueprint_thumbnail_url} alt={`${p.title} primary blueprint`} className="build-wizard-thumb-media-image" /> : <div className="build-wizard-thumb-fallback is-blueprint">Blueprint</div>}</div>
                </div>
                <span className="build-wizard-launch-title">{p.title}</span>
              </button>
              <button type="button" className="build-wizard-launch-card-delete" aria-label={`Delete ${p.title}`} title={`Delete ${p.title}`} onClick={() => void onDeleteProject({ id: p.id, title: p.title })} disabled={deletingProjectId === p.id}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
              </button>
            </div>
          ))}
          {launcherProjects.length === 0 ? <div className="build-wizard-launch-empty">No home builds yet. Use <strong>Build a New Home</strong> to create your first project.</div> : null}
        </div>
      </div>
    </div>
  );
}

interface BuildWizardTemplateEditorProps {
  deletingProjectId: number;
  formatDate: (value: string | null | undefined) => string;
  onBackToLauncher: () => void;
  onCloseWizard: () => void;
  onCreateTemplate: () => Promise<unknown>;
  onDeleteProject: (project: { id: number; title: string }) => Promise<unknown>;
  openBuild: (projectId: number, entryPoint: 'launcher' | 'template_editor') => Promise<unknown>;
  templateProjects: Array<{ id: number; title: string; step_count: number; updated_at: string | null }>;
}

export function BuildWizardTemplateEditor({ deletingProjectId, formatDate, onBackToLauncher, onCloseWizard, onCreateTemplate, onDeleteProject, openBuild, templateProjects }: BuildWizardTemplateEditorProps) {
  return (
    <div className="build-wizard-shell">
      <div className="build-wizard-launcher">
        <div className="build-wizard-page-close">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onBackToLauncher}>Back to Launcher</button>
          <StandardIconButton iconKey="close" ariaLabel="Close FABRIC8" title="Close FABRIC8" className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn" onClick={onCloseWizard} />
        </div>
        <div className="build-wizard-template-editor-head">
          <h1>Template Editor</h1>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void onCreateTemplate()}>Create Template</button>
        </div>
        <p>Manage reusable Build Wizard templates.</p>
        <div className="build-wizard-template-editor-list">
          {templateProjects.length === 0 ? <div className="build-wizard-template-editor-empty">No templates yet. Create your first template to get started.</div> : templateProjects.map((template) => (
            <div key={template.id} className="build-wizard-template-editor-row">
              <div className="build-wizard-template-editor-meta">
                <div className="build-wizard-template-editor-title">{template.title}</div>
                <div className="build-wizard-template-editor-sub">{template.step_count} step{template.step_count === 1 ? '' : 's'} | Updated {formatDate(template.updated_at)}</div>
              </div>
              <div className="build-wizard-template-editor-actions">
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void openBuild(template.id, 'template_editor')}>Edit</button>
                <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void onDeleteProject({ id: template.id, title: template.title })} disabled={deletingProjectId === template.id}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
