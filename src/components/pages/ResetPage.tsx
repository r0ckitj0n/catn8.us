import React from 'react';
import { ApiClient } from '../../core/ApiClient';
import { PageLayout } from '../layout/PageLayout';
import { IToast } from '../../types/common';

interface ResetPageProps {
  onToast?: (toast: IToast) => void;
  mysteryTitle?: string;
}

export function ResetPage({ onToast, mysteryTitle }: ResetPageProps) {
  const [status, setStatus] = React.useState('Confirming...');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!error) return;
    if (typeof onToast === 'function') onToast({ tone: 'error', message: String(error) });
    setError('');
  }, [error, onToast]);

  React.useEffect(() => {
    if (!status) return;
    if (typeof onToast === 'function') onToast({ tone: 'info', message: String(status) });
  }, [status, onToast]);

  React.useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') || '';
    if (!token) {
      setStatus('');
      setError('Missing token');
      return;
    }
    ApiClient.post('/api/auth/confirm_password_reset.php', { token })
      .then(() => {
        setError('');
        setStatus('Your password has been updated. You can close this page and log in.');
      })
      .catch((e: any) => {
        setStatus('');
        setError(e?.message || 'Password reset failed');
      });
  }, []);

  return (
    <PageLayout page="reset" title="Reset" viewer={null} onLoginClick={() => {}} onLogout={() => {}} onAccountClick={() => {}} mysteryTitle={mysteryTitle}>
      <section className="section">
        <div className="container">
          <h1 className="section-title">Reset Password</h1>
          <div className="catn8-card p-2">Check your toast notifications for status updates.</div>
        </div>
      </section>
    </PageLayout>
  );
}
