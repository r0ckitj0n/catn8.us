import React from 'react';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { ApiClient } from '../../core/ApiClient';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import {
  EmailSettingsConfig,
  EmailSettingsGetResponse,
  EmailSettingsMeta,
  EmailSettingsSaveRequest,
  EmailSettingsSaveResponse,
  EmailSettingsTestRequest,
  EmailSettingsTestResponse,
} from '../../types/emailSettings';

interface EmailConfigModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
}

export function EmailConfigModal({ open, onClose, onToast }: EmailConfigModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [smtpReady, setSmtpReady] = React.useState(false);
  const [passwordPresent, setPasswordPresent] = React.useState(false);
  const [form, setForm] = React.useState({ host: 'smtp.ionos.com', port: 587, secure: 'tls', user: '', pass: '', from_email: '', from_name: 'catn8.us' });
  const [testRecipientEmail, setTestRecipientEmail] = React.useState('');
  const cleanFormRef = React.useRef('');

  const applyIonosDefaults = React.useCallback(() => {
    setForm((current) => ({
      ...current,
      host: current.host || 'smtp.ionos.com',
      port: Number(current.port || 587),
      secure: current.secure || 'tls',
      from_name: current.from_name || 'catn8.us',
    }));
  }, []);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  React.useEffect(() => {
    if (!open) return;
    setBusy(true);
    setError('');
    setMessage('');
    ApiClient.get<EmailSettingsGetResponse>('/api/settings/email.php')
      .then((res) => {
        const cfg: Partial<EmailSettingsConfig> = res?.config || {};
        const meta: Partial<EmailSettingsMeta> = res?.meta || {};
        setPasswordPresent(Number(meta.password_present || 0) === 1);
        setSmtpReady(Number(meta.smtp_ready || 0) === 1);
        const next = (f: any) => ({
          ...f,
          host: cfg.host || f.host,
          port: cfg.port || f.port,
          secure: cfg.secure || f.secure,
          user: cfg.user || f.user,
          from_email: cfg.from_email || f.from_email,
          from_name: cfg.from_name || f.from_name,
          pass: '',
        });
        setForm((f) => {
          const nf = next(f);
          cleanFormRef.current = JSON.stringify({ ...nf, pass: '' });
          return nf;
        });
        setTestRecipientEmail(String(cfg.from_email || ''));
      })
      .catch((e) => setError(e?.message || 'Failed to load email settings'))
      .finally(() => setBusy(false));
  }, [open]);

  React.useEffect(() => {
    if (!error) return;
    if (typeof onToast === 'function') onToast({ tone: 'error', message: String(error) });
    setError('');
  }, [error, onToast]);

  React.useEffect(() => {
    if (!message) return;
    if (typeof onToast === 'function') onToast({ tone: 'success', message: String(message) });
    setMessage('');
  }, [message, onToast]);

  const isDirty = React.useMemo(() => {
    const cur = JSON.stringify({ ...form, pass: String(form.pass || '') });
    return String(cleanFormRef.current || '') !== cur;
  }, [form]);

  const save = async (e: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await ApiClient.post<EmailSettingsSaveResponse>('/api/settings/email.php', {
        action: 'save',
        ...form,
      } satisfies EmailSettingsSaveRequest);
      const meta: Partial<EmailSettingsMeta> = res?.meta || {};
      setPasswordPresent(Number(meta.password_present || 0) === 1);
      setSmtpReady(Number(meta.smtp_ready || 0) === 1);
      setMessage('Saved.');
      setForm((f) => ({ ...f, pass: '' }));
      cleanFormRef.current = JSON.stringify({ ...form, pass: '' });
    } catch (err: any) {
      setError(err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const sendTestEmail = async () => {
    setBusy(true);
      setError('');
      setMessage('');
      try {
      const res = await ApiClient.post<EmailSettingsTestResponse>('/api/settings/email.php', {
        action: 'test_send',
        to_email: String(testRecipientEmail || '').trim(),
      } satisfies EmailSettingsTestRequest);
      const meta: Partial<EmailSettingsMeta> = res?.meta || {};
      setPasswordPresent(Number(meta.password_present || 0) === 1);
      setSmtpReady(Number(meta.smtp_ready || 0) === 1);
      setMessage(res?.message || `Test email sent to ${res?.sent_to || testRecipientEmail}.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to send test email');
    } finally {
      setBusy(false);
    }
  };

  const setField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => 
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveSvg = (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4.5a1 1 0 0 0-.293-.707l-2.5-2.5A1 1 0 0 0 11.5 1H2zm1 1h8v4H3V2zm0 6h10v6H3V8zm2 1v4h6V9H5z"
      />
    </svg>
  );

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Email Configuration</h5>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className={'btn btn-sm btn-primary catn8-dirty-save' + (isDirty ? ' catn8-dirty-save--visible' : '')}
                onClick={save}
                disabled={busy || !isDirty}
                aria-label="Save"
                title={isDirty ? 'Save changes' : 'No changes to save'}
              >
                {saveSvg}
                <span className="ms-1">Save</span>
              </button>
              <ModalCloseIconButton />
            </div>
          </div>
          <div className="modal-body">
            <form onSubmit={save}>
              <div className={`alert ${smtpReady ? 'alert-success' : 'alert-warning'} py-2`} role="status">
                <div><strong>{smtpReady ? 'Email notifications are ready.' : 'Email notifications still need setup.'}</strong></div>
                <div className="small mb-0">
                  Using the same IONOS-style SMTP pattern as WhimsicalFrog: `smtp.ionos.com`, port `587`, `TLS`.
                  {passwordPresent ? ' A password is already stored.' : ' Add your mailbox password when you are ready.'}
                </div>
              </div>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div className="text-muted small">
                  Save the sending mailbox details here, then AIcountant notifications, password resets, and other site emails will use them.
                </div>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={applyIonosDefaults} disabled={busy}>
                  Use IONOS Defaults
                </button>
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="smtp-host">SMTP Host</label>
                <input className="form-control" id="smtp-host" value={form.host} onChange={setField('host')} disabled={busy} autoComplete="off" />
              </div>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label" htmlFor="smtp-port">Port</label>
                  <input className="form-control" id="smtp-port" type="number" value={form.port} onChange={setField('port')} disabled={busy} autoComplete="off" />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label" htmlFor="smtp-secure">Encryption</label>
                  <select className="form-select" id="smtp-secure" value={form.secure} onChange={setField('secure')} disabled={busy}>
                    <option value="tls">TLS</option>
                    <option value="ssl">SSL</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="smtp-user">SMTP Username</label>
                <input className="form-control" id="smtp-user" value={form.user} onChange={setField('user')} disabled={busy} autoComplete="username" />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="smtp-pass">SMTP Password</label>
                <input className="form-control" id="smtp-pass" type="password" value={form.pass} onChange={setField('pass')} disabled={busy} autoComplete="current-password" />
                <div className="form-text">
                  Leave blank to keep the existing password. If you have not saved one yet, this must be the mailbox password for your catn8.us sending address.
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="smtp-from-email">From Email</label>
                <input className="form-control" id="smtp-from-email" type="email" value={form.from_email} onChange={setField('from_email')} disabled={busy} autoComplete="email" />
                <div className="form-text">Example: `notifications@catn8.us` or whichever mailbox you create on your IONOS hosting account.</div>
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="smtp-from-name">From Name</label>
                <input className="form-control" id="smtp-from-name" value={form.from_name} onChange={setField('from_name')} disabled={busy} autoComplete="name" />
              </div>
              <div className="mb-0">
                <label className="form-label" htmlFor="smtp-test-recipient">Test Recipient Email</label>
                <input
                  className="form-control"
                  id="smtp-test-recipient"
                  type="email"
                  value={testRecipientEmail}
                  onChange={(e) => setTestRecipientEmail(e.target.value)}
                  disabled={busy}
                  autoComplete="email"
                />
                <div className="form-text">Use any email address you want to receive the test message.</div>
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
              Close
            </button>
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => void sendTestEmail()}
              disabled={busy || isDirty || !smtpReady || String(testRecipientEmail || '').trim() === ''}
              title={
                isDirty
                  ? 'Save your changes before sending a test email'
                  : String(testRecipientEmail || '').trim() === ''
                    ? 'Enter a test recipient email address first'
                  : smtpReady
                    ? 'Send a test email to the configured mailbox'
                    : 'Save a complete SMTP configuration before sending a test email'
              }
            >
              Send Test Email
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !isDirty}>
              {busy ? 'Saving...' : 'Save Email Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
