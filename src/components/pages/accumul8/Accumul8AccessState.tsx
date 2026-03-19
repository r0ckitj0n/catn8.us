import React from 'react';

import { AppShellPageProps } from '../../../types/pages/commonPageProps';
import { PageLayout } from '../../layout/PageLayout';

interface Accumul8AccessStateProps extends Pick<AppShellPageProps, 'viewer' | 'onLoginClick' | 'onLogout' | 'onAccountClick' | 'mysteryTitle'> {
  mode: 'login' | 'forbidden';
}

export function Accumul8AccessState({
  mysteryTitle,
  mode,
  onAccountClick,
  onLoginClick,
  onLogout,
  viewer,
}: Accumul8AccessStateProps) {
  return (
    <PageLayout page="accumul8" title="ACCUMUL8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className="section">
        <div className="container">
          <h1 className="section-title">ACCUMUL8</h1>
          <div className="catn8-card p-3">
            {mode === 'login' ? (
              <>
                <p className="mb-2">Login required.</p>
                <button type="button" className="btn btn-primary" onClick={onLoginClick}>Log in</button>
              </>
            ) : (
              <p className="mb-0">Your account is not in the <strong>Accumul8 Users</strong> group. Ask an administrator to grant access.</p>
            )}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
