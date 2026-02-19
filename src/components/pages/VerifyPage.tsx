import React from 'react';
import { ApiClient } from '../../core/ApiClient';
import { PageLayout } from '../layout/PageLayout';
import { IToast } from '../../types/common';

interface VerifyPageProps {
  onToast?: (toast: IToast) => void;
  mysteryTitle?: string;
}

export function VerifyPage({ onToast, mysteryTitle }: VerifyPageProps) {
  const [status, setStatus] = React.useState('Verifying...');
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
    ApiClient.post('/api/auth/verify.php', { token })
      .then(() => {
        setError('');
        setStatus('Your account is now verified. You can close this page and log in.');
      })
      .catch((e: any) => {
        setStatus('');
        setError(e?.message || 'Verification failed');
      });
  }, []);

  return (
    <PageLayout page="verify" title="Verify" mysteryTitle={mysteryTitle}>
      <section className="section">
        <div className="container">
          <h1 className="section-title">Verify Account</h1>
          <div className="catn8-card p-2">Check your toast notifications for status updates.</div>
        </div>
      </section>
    </PageLayout>
  );
}
