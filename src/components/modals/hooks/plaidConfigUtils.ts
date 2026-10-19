import { IPlaidSettingsGetResponse, IPlaidSettingsMutationResponse, PlaidEnvironment } from '../../../types/plaidSettings';

export const LS_PLAID_TEST = 'catn8.last_test.settings.plaid';

export interface PlaidFormState {
  env: PlaidEnvironment;
  client_id: string;
  secret: string;
  products: string;
  country_codes: string;
  redirect_uri: string;
}

export interface PlaidStatusState {
  has_client_id: boolean;
  has_secret: boolean;
}

export const defaultFormState: PlaidFormState = {
  env: 'sandbox',
  client_id: '',
  secret: '',
  products: 'transactions',
  country_codes: 'US',
  redirect_uri: '',
};

export const defaultStatusState: PlaidStatusState = {
  has_client_id: false,
  has_secret: false,
};

export function mapPlaidFormState(
  config: IPlaidSettingsGetResponse['config'] | IPlaidSettingsMutationResponse['config'] | undefined,
  fallbackEnv: PlaidEnvironment = 'sandbox',
): PlaidFormState {
  return {
    env: (config?.env || fallbackEnv) as PlaidEnvironment,
    client_id: String(config?.client_id || ''),
    secret: '',
    products: String(config?.products || 'transactions'),
    country_codes: String(config?.country_codes || 'US'),
    redirect_uri: String(config?.redirect_uri || ''),
  };
}

export function mapPlaidStatusState(
  status: IPlaidSettingsGetResponse['status'] | IPlaidSettingsMutationResponse['status'] | undefined,
): PlaidStatusState {
  return {
    has_client_id: Boolean(status?.has_client_id),
    has_secret: Boolean(status?.has_secret),
  };
}
