import React from 'react';

interface MfaCodeFormProps {
  busy: boolean;
  emailMasked: string;
  error: string;
  note: string;
  showTrustDevice: boolean;
  trustDevice: boolean;
  onTrustDevice: (value: boolean) => void;
  onResend: () => void;
  onSubmit: (code: string) => void;
}

export function MfaCodeForm({
  busy,
  emailMasked,
  error,
  note,
  showTrustDevice,
  trustDevice,
  onTrustDevice,
  onResend,
  onSubmit,
}: MfaCodeFormProps) {
  const [code, setCode] = React.useState('');
  const masked = emailMasked || 'your email';

  return (
    <form
      className="catn8-mfa-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(code.trim());
      }}
    >
      <h2 className="catn8-mfa-title">Two-factor verification</h2>
      <p className="catn8-mfa-lead">We emailed a 6-digit code to {masked}</p>
      {note ? <p className="catn8-mfa-note">{note}</p> : null}
      {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
      <div className="mb-3">
        <label className="form-label" htmlFor="mfa-code">6-digit code</label>
        <input
          id="mfa-code"
          name="code"
          className="form-control catn8-mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          disabled={busy}
          required
        />
      </div>
      {showTrustDevice ? (
        <div className="form-check mb-3">
          <input
            id="mfa-trust-device"
            className="form-check-input"
            type="checkbox"
            checked={trustDevice}
            onChange={(event) => onTrustDevice(event.target.checked)}
            disabled={busy}
          />
          <label className="form-check-label" htmlFor="mfa-trust-device">Trust this device for 30 days</label>
        </div>
      ) : null}
      <button type="submit" className="btn btn-primary w-100" disabled={busy || code.length !== 6}>
        Verify code
      </button>
      <button type="button" className="btn btn-link px-0 mt-2" onClick={onResend} disabled={busy}>
        Resend code
      </button>
    </form>
  );
}
