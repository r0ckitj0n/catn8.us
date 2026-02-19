export interface IBuildWizardStepNote {
  id: number;
  step_id: number;
  note_text: string;
  created_at: string;
}

export interface IBuildWizardStep {
  id: number;
  project_id: number;
  step_order: number;
  phase_key: string;
  title: string;
  description: string;
  permit_required: number;
  permit_name: string | null;
  expected_start_date: string | null;
  expected_end_date: string | null;
  expected_duration_days: number | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  is_completed: number;
  completed_at: string | null;
  ai_generated: number;
  source_ref: string | null;
  notes: IBuildWizardStepNote[];
}

export interface IBuildWizardDocument {
  id: number;
  project_id: number;
  step_id: number | null;
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
  room_count: number | null;
  bathroom_count: number | null;
  stories_count: number | null;
  lot_address: string;
  target_start_date: string | null;
  target_completion_date: string | null;
  wizard_notes: string;
  blueprint_document_id: number | null;
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
}

export interface IBuildWizardQuestionnaire {
  title: string;
  status: string;
  square_feet: number | null;
  home_style: string;
  room_count: number | null;
  bathroom_count: number | null;
  stories_count: number | null;
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
