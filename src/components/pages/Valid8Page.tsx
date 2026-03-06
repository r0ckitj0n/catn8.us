import React from 'react';
import { PageLayout } from '../layout/PageLayout';
import { AppShellPageProps } from '../../types/pages/commonPageProps';

export function Valid8Page({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle }: AppShellPageProps) {
  return (
    <PageLayout page="valid8" title="VALID8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <main className="container py-4">
        <section className="card shadow-sm">
          <div className="card-body">
            <h1 className="section-title mb-3">VALID8 Password Vault</h1>
            <p className="mb-2">
              VALID8 is enabled. The vault schema and AES-256-GCM model are ready.
            </p>
            <p className="text-muted mb-0">
              Active passwords are the default view. Replaced passwords are retained as inactive history.
            </p>
          </div>
        </section>
      </main>
    </PageLayout>
  );
}
