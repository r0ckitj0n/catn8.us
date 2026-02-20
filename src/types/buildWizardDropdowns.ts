export interface IBuildWizardDropdownSettings {
  document_kinds: string[];
  permit_statuses: string[];
  purchase_units: string[];
}

export interface IBuildWizardDropdownSettingsResponse {
  success: boolean;
  settings: IBuildWizardDropdownSettings;
}
