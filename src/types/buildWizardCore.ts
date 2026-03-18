export interface IBuildWizardStepNote {
  id: number;
  step_id: number;
  note_text: string;
  created_at: string;
  updated_at: string;
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
  receipt_total?: number;
  receipt_count?: number;
  created_at: string | null;
  updated_at: string | null;
  notes: IBuildWizardStepNote[];
  audit_logs: IBuildWizardStepAuditLog[];
}

export interface IBuildWizardDocument {
  id: number;
  project_id: number;
  step_id: number | null;
  receipt_parent_document_id: number | null;
  step_phase_key: string | null;
  step_title: string | null;
  kind: string;
  original_name: string;
  mime_type: string;
  storage_path: string;
  file_size_bytes: number;
  caption: string | null;
  receipt_amount: number | null;
  receipt_title: string | null;
  receipt_vendor: string | null;
  receipt_date: string | null;
  receipt_notes: string | null;
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
  is_template: number;
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
  is_template: number;
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
