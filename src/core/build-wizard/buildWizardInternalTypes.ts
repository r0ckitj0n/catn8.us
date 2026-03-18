import {
  IBuildWizardContact,
  IBuildWizardContactAssignment,
  IBuildWizardDocument,
  IBuildWizardPhaseDateRange,
  IBuildWizardProject,
  IBuildWizardPurchaseOption,
  IBuildWizardStep,
} from '../../types/buildWizard';

export type BuildWizardToast = { tone: 'success' | 'error' | 'info' | 'warning'; message: string };

export type BuildWizardPayloadResponse = {
  success: boolean;
  prompt_text: string;
  payload: Record<string, unknown>;
};

export type BuildWizardAiGenerateResponse = {
  success: boolean;
  provider: string;
  model: string;
  mode?: 'optimize' | 'fill_missing' | 'complete';
  parsed_step_count: number;
  inserted_count: number;
  updated_count: number;
  missing_fields?: string[];
  steps: IBuildWizardStep[];
};

export type CreateProjectResponse = {
  success: boolean;
  project_id: number;
};

export type UpdateProjectResponse = {
  success: boolean;
  project: IBuildWizardProject;
};

export type AddStepResponse = {
  success: boolean;
  step: IBuildWizardStep;
};

export type DeleteStepResponse = {
  success: boolean;
  deleted_step_id: number;
  steps: IBuildWizardStep[];
};

export type ReorderStepsResponse = {
  success: boolean;
  steps: IBuildWizardStep[];
};

export type DeleteDocumentResponse = {
  success: boolean;
  deleted_document_id: number;
  documents: IBuildWizardDocument[];
  steps?: IBuildWizardStep[];
};

export type DeleteProjectResponse = {
  success: boolean;
  deleted_project_id: number;
  selected_project_id: number | null;
  projects: Array<{ id: number; title: string; status: string; is_template: number; created_at: string; updated_at: string; step_count: number; completed_step_count: number; blueprint_document_id: number | null; primary_photo_document_id: number | null; primary_blueprint_thumbnail_url: string | null; primary_photo_thumbnail_url: string | null; }>;
};

export type UpdateDocumentResponse = {
  success: boolean;
  document: IBuildWizardDocument;
  documents?: IBuildWizardDocument[];
  step?: IBuildWizardStep | null;
  steps?: IBuildWizardStep[];
};

export type ReplaceDocumentResponse = {
  success: boolean;
  document: IBuildWizardDocument;
};

export type SaveContactResponse = {
  success: boolean;
  contact: IBuildWizardContact;
};

export type DeleteContactResponse = {
  success: boolean;
  deleted_contact_id: number;
};

export type AddContactAssignmentResponse = {
  success: boolean;
  assignment: IBuildWizardContactAssignment;
};

export type DeleteContactAssignmentResponse = {
  success: boolean;
  deleted_assignment_id: number;
};

export type SavePhaseDateRangeResponse = {
  success: boolean;
  phase_date_ranges: IBuildWizardPhaseDateRange[];
};

export type PurchaseOptionsResult = {
  options: IBuildWizardPurchaseOption[];
  step: IBuildWizardStep | null;
};
