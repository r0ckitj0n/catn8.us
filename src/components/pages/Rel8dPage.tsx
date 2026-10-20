import React from 'react';

import { PageLayout } from '../layout/PageLayout';
import { AppShellPageProps } from '../../types/pages/commonPageProps';

export function Rel8dPage({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle }: AppShellPageProps) {
  return (
    <PageLayout
      page="rel8d"
      title="Rel8d"
      viewer={viewer}
      onLoginClick={onLoginClick}
      onLogout={onLogout}
      onAccountClick={onAccountClick}
      mysteryTitle={mysteryTitle}
    >
      <section className="hero">
        <div className="container hero-content">
          <div className="row justify-content-center">
            <div className="col-lg-9">
              <div className="welcome-message text-center">
                <h1>Rel8d</h1>
                <p className="lead">
                  Family history and shared genealogy on catn8.us. This path and host are reserved while the full Rel8d
                  workspace is built.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
