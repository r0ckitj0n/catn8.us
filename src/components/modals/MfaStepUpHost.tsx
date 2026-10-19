import React from 'react';
import { ApiClient } from '../../core/ApiClient';
import { getMfaStepUpRequest, settleMfaStepUp, subscribeMfaStepUp } from '../../core/mfaStepUp';
import { AuthMfaChallengeResponse, AuthMfaResendResponse, AuthMfaVerifyRequest } from '../../types/authMfa';
import { MfaCodeForm } from './sections/MfaCodeForm';

export function MfaStepUpHost() {
  const request = React.useSyncExternalStore(subscribeMfaStepUp, getMfaStepUpRequest, getMfaStepUpRequest);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [emailMasked, setEmailMasked] = React.useState('');
  const [trustDevice, setTrustDevice] = React.useState(false);

  React.useEffect(() => {
    setError('');
    setBusy(false);
    setTrustDevice(false);
    setEmailMasked(request?.emailMasked || '');
  }, [request]);

  if (!request) {
    return null;
  }

  const submit = async (code: string) => {
    setBusy(true);
    setError('');
    try {
      const body: AuthMfaVerifyRequest = { code, trust_device: trustDevice };
      await ApiClient.post<AuthMfaChallengeResponse>('/api/auth/mfa_verify.php', body);
      settleMfaStepUp(true);
    } catch (err: any) {
      setError(err?.message || 'That code is incorrect.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await ApiClient.post<AuthMfaResendResponse>('/api/auth/mfa_resend.php', {});
      if (res?.email_masked) {
        setEmailMasked(res.email_masked);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not resend the code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="catn8-mfa-overlay" role="presentation">
      <div className="catn8-mfa-card card shadow" role="dialog" aria-modal="true" aria-label="Two-factor verification">
        <MfaCodeForm
          busy={busy}
          emailMasked={emailMasked}
          error={error}
          note={request.note}
          showTrustDevice
          trustDevice={trustDevice}
          onTrustDevice={setTrustDevice}
          onResend={() => void resend()}
          onSubmit={(code) => void submit(code)}
        />
        <button type="button" className="btn btn-link px-0" onClick={() => settleMfaStepUp(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
