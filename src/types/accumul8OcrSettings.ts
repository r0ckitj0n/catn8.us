export interface Accumul8OcrSettings {
  has_service_account_json: number;
  project_id: string;
  client_email: string;
  client_email_hint: string;
}

export interface Accumul8OcrSettingsResponse {
  success: boolean;
  settings: Accumul8OcrSettings;
}
