export type TellerEnvironment = 'sandbox' | 'development' | 'production';

export interface ITellerSettingsConfig {
  env: TellerEnvironment;
  application_id: string;
}

export interface ITellerSettingsStatus {
  has_application_id: boolean;
  has_certificate: boolean;
  has_private_key: boolean;
}

export interface ITellerSettingsGetResponse {
  success: boolean;
  source: 'secret_store';
  config: ITellerSettingsConfig;
  status: ITellerSettingsStatus;
}

export interface ITellerSettingsSaveRequest {
  env: TellerEnvironment;
  application_id?: string;
  certificate?: string;
  private_key?: string;
}

export interface ITellerSettingsDeleteRequest {
  field: 'application_id' | 'certificate' | 'private_key' | 'all';
}

export interface ITellerSettingsMutationResponse {
  success: boolean;
  message: string;
  config: ITellerSettingsConfig;
  status: ITellerSettingsStatus;
}

export interface ITellerSettingsTestRequest {
  env: TellerEnvironment;
  application_id?: string;
  certificate?: string;
  private_key?: string;
}

export interface ITellerSettingsTestResponse {
  success: boolean;
  ok: boolean;
  message: string;
  teller_env: TellerEnvironment;
}
