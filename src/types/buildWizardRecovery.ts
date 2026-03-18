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
