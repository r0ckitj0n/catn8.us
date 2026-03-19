import React from 'react';

import { AppShellPageProps } from '../../../types/pages/commonPageProps';
import { PageLayout } from '../../layout/PageLayout';
import { Accumul8PageHeader } from './Accumul8PageHeader';
import { Accumul8PageModalAssembly } from './Accumul8PageModalAssembly';
import { Accumul8PageOverlays } from './Accumul8PageOverlays';
import { Accumul8PageTabContent } from './Accumul8PageTabContent';

interface Accumul8PageContentProps extends Pick<AppShellPageProps, 'viewer' | 'onLoginClick' | 'onLogout' | 'onAccountClick' | 'mysteryTitle'> {
  headerProps: React.ComponentProps<typeof Accumul8PageHeader>;
  loaded: boolean;
  modalProps: React.ComponentProps<typeof Accumul8PageModalAssembly>['props'];
  overlayProps: React.ComponentProps<typeof Accumul8PageOverlays>;
  tabContentProps: React.ComponentProps<typeof Accumul8PageTabContent>;
}

export function Accumul8PageContent({
  headerProps,
  loaded,
  modalProps,
  mysteryTitle,
  onAccountClick,
  onLoginClick,
  onLogout,
  overlayProps,
  tabContentProps,
  viewer,
}: Accumul8PageContentProps) {
  return (
    <PageLayout page="accumul8" title="ACCUMUL8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className="section">
        <div className="container accumul8-page">
          <Accumul8PageHeader {...headerProps} />
          <Accumul8PageTabContent {...tabContentProps} />
          <Accumul8PageOverlays {...overlayProps} />
          <Accumul8PageModalAssembly props={modalProps} />
          {!loaded ? <div className="text-muted mt-2">Loading Accumul8...</div> : null}
        </div>
      </section>
    </PageLayout>
  );
}
