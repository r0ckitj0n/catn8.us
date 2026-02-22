export interface IBuildWizardStepNote {
  id: number;
  step_id: number;
  note_text: string;
  created_at: string;
}

export interface IBuildWizardStepAuditLog {
  id: number;
  project_id: number;
  step_id: number;
  actor_user_id: number | null;
  action_key: 'created' | 'updated' | 'note_added' | 'deleted' | string;
  changes: Record<string, unknown> | null;
  created_at: string;
}

export interface IBuildWizardStep {
  id: number;
  project_id: number;
  step_order: number;
  phase_key: string;
  parent_step_id: number | null;
  depends_on_step_ids: number[];
  step_type: 'permit' | 'purchase' | 'inspection' | 'documentation' | 'construction' | 'photos' | 'blueprints' | 'utility' | 'delivery' | 'milestone' | 'closeout' | 'other';
  title: string;
  description: string;
  permit_required: number;
  permit_document_id: number | null;
  permit_name: string | null;
  permit_authority: string | null;
  permit_status: string | null;
  permit_application_url: string | null;
  purchase_category: string | null;
  purchase_brand: string | null;
  purchase_model: string | null;
  purchase_sku: string | null;
  purchase_unit: string | null;
  purchase_qty: number | null;
  purchase_unit_price: number | null;
  purchase_vendor: string | null;
  purchase_url: string | null;
  expected_start_date: string | null;
  expected_end_date: string | null;
  expected_duration_days: number | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  ai_estimated_fields: string[];
  is_completed: number;
  completed_at: string | null;
  ai_generated: number;
  source_ref: string | null;
  created_at: string | null;
  updated_at: string | null;
  notes: IBuildWizardStepNote[];
  audit_logs: IBuildWizardStepAuditLog[];
}

export interface IBuildWizardDocument {
  id: number;
  project_id: number;
  step_id: number | null;
  step_phase_key: string | null;
  step_title: string | null;
  kind: string;
  original_name: string;
  mime_type: string;
  storage_path: string;
  file_size_bytes: number;
  caption: string | null;
  uploaded_at: string;
  public_url: string;
  thumbnail_url: string;
  is_image: number;
}

export interface IBuildWizardProject {
  id: number;
  owner_user_id: number | null;
  title: string;
  status: string;
  square_feet: number | null;
  home_style: string;
  home_type: string;
  room_count: number | null;
  bedrooms_count: number | null;
  kitchens_count: number | null;
  bathroom_count: number | null;
  stories_count: number | null;
  lot_size_sqft: number | null;
  garage_spaces: number | null;
  parking_spaces: number | null;
  year_built: number | null;
  hoa_fee_monthly: number | null;
  lot_address: string;
  target_start_date: string | null;
  target_completion_date: string | null;
  wizard_notes: string;
  blueprint_document_id: number | null;
  primary_photo_document_id: number | null;
  ai_prompt_text: string;
  ai_payload_json: string;
  created_at: string;
  updated_at: string;
}

export interface IBuildWizardProjectSummary {
  id: number;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  step_count: number;
  completed_step_count: number;
  blueprint_document_id: number | null;
  primary_photo_document_id: number | null;
  primary_blueprint_thumbnail_url: string | null;
  primary_photo_thumbnail_url: string | null;
}

export interface IBuildWizardContact {
  id: number;
  owner_user_id: number;
  project_id: number | null;
  display_name: string;
  contact_type: 'contact' | 'vendor' | 'authority';
  email: string | null;
  phone: string | null;
  company: string | null;
  role_title: string | null;
  notes: string | null;
  is_vendor: number;
  vendor_type: string | null;
  vendor_license: string | null;
  vendor_trade: string | null;
  vendor_website: string | null;
  created_at: string;
  updated_at: string;
}

export interface IBuildWizardContactAssignment {
  id: number;
  project_id: number;
  contact_id: number;
  step_id: number | null;
  phase_key: string | null;
  created_at: string;
}

export interface IBuildWizardPhaseDateRange {
  id: number;
  project_id: number;
  phase_tab: 'land' | 'permits' | 'site' | 'framing' | 'mep' | 'finishes';
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface IBuildWizardQuestionnaire {
  title: string;
  status: string;
  square_feet: number | null;
  home_style: string;
  home_type: string;
  room_count: number | null;
  bedrooms_count: number | null;
  kitchens_count: number | null;
  bathroom_count: number | null;
  stories_count: number | null;
  lot_size_sqft: number | null;
  garage_spaces: number | null;
  parking_spaces: number | null;
  year_built: number | null;
  hoa_fee_monthly: number | null;
  lot_address: string;
  target_start_date: string | null;
  target_completion_date: string | null;
  wizard_notes: string;
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

export interface IBuildWizardAlignSummary {
  project_id: number;
  template_step_count: number;
  existing_step_count: number;
  matched_existing_count: number;
  legacy_step_count: number;
  inserted_count: number;
  updated_count: number;
  dependency_updates: number;
}

export interface IBuildWizardPhaseReviewStep {
  step_id: number;
  step_order: number;
  title: string;
  step_type: string;
  dependency_count: number;
  depends_on: Array<{
    step_id: number;
    step_order: number;
    title: string;
    phase_key: string;
  }>;
  ordering_issues: string[];
}

export interface IBuildWizardPhaseReview {
  phase_key: string;
  step_count: number;
  dependency_issue_count: number;
  steps: IBuildWizardPhaseReviewStep[];
}

export interface IBuildWizardRefineLegacySummary {
  project_id: number;
  template_step_count: number;
  legacy_step_count_before: number;
  legacy_step_count_after: number;
  deduplicated_count: number;
  phase_reclassified_count: number;
  dependency_updates: number;
  updated_count: number;
}

export interface IBuildWizardSingletreeRecoverSummary {
  project_id: number;
  project_title: string;
  apply: number;
  source_root: string;
  source_files_considered: number;
  existing_documents_before: number;
  matched_existing: number;
  inserted_documents: number;
  updated_mappings: number;
  blob_backfilled: number;
  image_blob_backfilled: number;
  skipped_duplicates: number;
  blueprint_document_id_set: number;
  existing_documents_after: number;
}

export interface IBuildWizardSingletreeRecoverResult {
  success?: boolean;
  summary?: IBuildWizardSingletreeRecoverSummary;
  preview_sample?: Array<Record<string, unknown>>;
}

export interface IBuildWizardSingletreeRecoverResponse {
  success: boolean;
  queued?: number;
  completed?: number;
  job_id?: string;
  status?: 'queued' | 'running' | 'completed' | 'failed' | 'unknown';
  exit_code?: number;
  result?: IBuildWizardSingletreeRecoverResult | string;
  stderr?: string;
  command?: string;
  error?: string;
}

export interface IBuildWizardSingletreeStageUploadResponse {
  success: boolean;
  upload_token: string;
  staged_root: string;
  files_total: number;
  files_saved: number;
  files_skipped: number;
  saved_files: string[];
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
