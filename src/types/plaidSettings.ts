export type PlaidEnvironment = 'sandbox' | 'development' | 'production';

export interface IPlaidSettingsConfig {
  env: PlaidEnvironment;
  client_id: string;
}

export interface IPlaidSettingsStatus {
  has_client_id: boolean;
  has_secret: boolean;
}

export interface IPlaidSettingsGetResponse {
  success: boolean;
  source: 'secret_store';
  config: IPlaidSettingsConfig;
  status: IPlaidSettingsStatus;
}

export interface IPlaidSettingsSaveRequest {
  env: PlaidEnvironment;
  client_id?: string;
  secret?: string;
}

export interface IPlaidSettingsDeleteRequest {
  field: 'client_id' | 'secret' | 'all';
}

export interface IPlaidSettingsMutationResponse {
  success: boolean;
  message: string;
  config: IPlaidSettingsConfig;
  status: IPlaidSettingsStatus;
}

export interface IPlaidSettingsTestRequest {
  env: PlaidEnvironment;
  client_id?: string;
  secret?: string;
}

export interface IPlaidSettingsTestResponse {
  success: boolean;
  ok: boolean;
  message: string;
  plaid_env: PlaidEnvironment;
  request_id: string;
  expiration: string;
}
