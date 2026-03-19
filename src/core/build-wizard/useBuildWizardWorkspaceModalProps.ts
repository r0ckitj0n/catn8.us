import React from 'react';

import { BuildWizardWorkspaceModals } from './buildWizardWorkspaceModals';

export function useBuildWizardWorkspaceModalProps(
  props: React.ComponentProps<typeof BuildWizardWorkspaceModals>,
) {
  return React.useMemo(() => props, [props]);
}
