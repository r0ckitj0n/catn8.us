import React from 'react';

import { renderBuildWizardPage } from '../../core/build-wizard/buildWizardPageRender';
import { AppShellPageProps } from '../../types/pages/commonPageProps';

interface BuildWizardPageProps extends AppShellPageProps {
  isAdmin?: boolean;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}

export function BuildWizardPage(props: BuildWizardPageProps) {
  return renderBuildWizardPage(props);
}
