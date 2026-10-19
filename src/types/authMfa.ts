export interface AuthMfaChallengeResponse {
  success: boolean;
  mfa_required?: boolean;
  mfa_step_up_required?: boolean;
  email_masked?: string;
  email_sent?: boolean;
  expires_in_seconds?: number;
  retry_after_seconds?: number;
  trusted_device?: boolean;
  error?: string;
  purpose?: 'login' | 'step_up';
}

export interface AuthMfaVerifyRequest {
  code: string;
  trust_device?: boolean;
}

export interface AuthMfaResendResponse {
  success: boolean;
  email_masked?: string;
  email_sent?: boolean;
  retry_after_seconds?: number;
  error?: string;
}
