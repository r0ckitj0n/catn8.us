import {
  IBuildWizardContact,
  IBuildWizardContactAssignment,
  IBuildWizardDocument,
  IBuildWizardPhaseDateRange,
  IBuildWizardProject,
  IBuildWizardProjectSummary,
  IBuildWizardStep,
} from './buildWizardCore';

export interface IBuildWizardCabinRepairSummary {
  project_id: number;
  sibling_projects: number[];
  merged_steps: number;
  moved_steps: number;
  remapped_step_references: number;
  merged_phase_ranges: number;
  moved_documents: number;
  remapped_step_ids: number;
  moved_contacts: number;
  moved_assignments: number;
  search_index_updated: number;
}

export interface IBuildWizardBootstrapResponse {
  success: boolean;
  selected_project_id: number;
  projects: IBuildWizardProjectSummary[];
  project: IBuildWizardProject;
  steps: IBuildWizardStep[];
  documents: IBuildWizardDocument[];
  contacts: IBuildWizardContact[];
  contact_assignments: IBuildWizardContactAssignment[];
  phase_date_ranges: IBuildWizardPhaseDateRange[];
  leading_questions: string[];
  cabin_repair?: IBuildWizardCabinRepairSummary | null;
}

export interface IBuildWizardMissingDocumentRef {
  document_id: number;
  project_id: number;
  original_name: string;
  storage_path: string;
}

export interface IBuildWizardDocumentBlobBackfillReport {
  project_id: number | null;
  apply: number;
  limit: number;
  total: number;
  already_blob: number;
  from_image_blob: number;
  from_file_path: number;
  missing: number;
  written: number;
  missing_docs: IBuildWizardMissingDocumentRef[];
}

export interface IBuildWizardDocumentBlobBackfillResponse {
  success: boolean;
  report: IBuildWizardDocumentBlobBackfillReport;
}

export interface IBuildWizardHydrateBlobsResponse {
  success: boolean;
  processed_files: number;
  matched_documents: number;
  written_blobs: number;
  unmatched_filenames: string[];
  ambiguous_filenames?: string[];
}

export interface IBuildWizardHydrateFromSourcesResponse {
  success: boolean;
  source_roots: string[];
  source_files_scanned: number;
  missing_documents_considered: number;
  matched_documents: number;
  written_blobs: number;
  ambiguous_documents: Array<{
    document_id: number;
    original_name: string;
  }>;
}

export interface IBuildWizardPdfThumbnailDiagnosticsResponse {
  success: boolean;
  diagnostics: {
    imagick_loaded: boolean;
    imagick_version: string | null;
    imagick_pdf_format_available: boolean;
    imagick_pdfa_format_available: boolean;
    imagick_delegate_contains_ghostscript: boolean;
    imagick_delegates_summary: string | null;
    shell_exec_available: boolean;
    ghostscript_binary_path: string | null;
    ghostscript_render_supported: boolean;
    pdf_thumbnail_supported: boolean;
    checked_at_utc: string;
  };
}

export interface IBuildWizardPurchaseOption {
  title: string;
  url: string;
  vendor: string | null;
  unit_price: number | null;
  summary: string;
  source: 'provided_url' | 'web_search';
  tier: 'conservative' | 'standard' | 'premium';
  tier_label: 'Conservative' | 'Standard' | 'Premium';
}

export interface IBuildWizardFindPurchaseOptionsResponse {
  success: boolean;
  step_id: number;
  step_type: string;
  query: string;
  options: IBuildWizardPurchaseOption[];
  step: IBuildWizardStep;
}

export interface IBuildWizardContentSearchResult extends IBuildWizardDocument {
  snippet: string;
  score: number;
  extraction_method: string;
  indexed_at: string;
}

export interface IBuildWizardContentSearchResponse {
  success: boolean;
  query: string;
  project_id: number;
  results: IBuildWizardContentSearchResult[];
  indexing?: {
    indexed: number;
    errors: number;
  };
}
