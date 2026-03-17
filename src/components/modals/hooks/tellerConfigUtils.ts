import { ITellerSettingsGetResponse, ITellerSettingsMutationResponse, TellerEnvironment } from '../../../types/tellerSettings';

export const LS_TELLER_TEST = 'catn8.last_test.settings.teller';

export interface TellerFormState {
  env: TellerEnvironment;
  application_id: string;
  certificate: string;
  private_key: string;
}

export interface TellerStatusState {
  has_application_id: boolean;
  has_certificate: boolean;
  has_private_key: boolean;
}

export const defaultFormState: TellerFormState = {
  env: 'sandbox',
  application_id: '',
  certificate: '',
  private_key: '',
};

export const defaultStatusState: TellerStatusState = {
  has_application_id: false,
  has_certificate: false,
  has_private_key: false,
};

export function mapTellerFormState(
  config: ITellerSettingsGetResponse['config'] | ITellerSettingsMutationResponse['config'] | undefined,
  fallbackEnv: TellerEnvironment = 'sandbox',
): TellerFormState {
  return {
    env: (config?.env || fallbackEnv) as TellerEnvironment,
    application_id: String(config?.application_id || ''),
    certificate: '',
    private_key: '',
  };
}

export function mapTellerStatusState(
  status: ITellerSettingsGetResponse['status'] | ITellerSettingsMutationResponse['status'] | undefined,
): TellerStatusState {
  return {
    has_application_id: Boolean(status?.has_application_id),
    has_certificate: Boolean(status?.has_certificate),
    has_private_key: Boolean(status?.has_private_key),
  };
}
