export interface EmailSettingsConfig {
  host: string;
  port: number;
  secure: string;
  user: string;
  from_email: string;
  from_name: string;
  configured: boolean;
}

export interface EmailSettingsMeta {
  password_present: number;
  smtp_ready: number;
}

export interface EmailSettingsGetResponse {
  success: boolean;
  config: EmailSettingsConfig;
  meta: EmailSettingsMeta;
}

export interface EmailSettingsSaveRequest {
  action?: 'save';
  host: string;
  port: number;
  secure: string;
  user: string;
  pass: string;
  from_email: string;
  from_name: string;
}

export interface EmailSettingsSaveResponse extends EmailSettingsGetResponse {}

export interface EmailSettingsTestRequest {
  action: 'test_send';
  to_email: string;
}

export interface EmailSettingsTestResponse extends EmailSettingsGetResponse {
  message: string;
  sent_to: string;
}
