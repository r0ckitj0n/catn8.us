import React from 'react';

import { BuildWizardWorkspaceMain } from './buildWizardWorkspaceMain';

export function useBuildWizardWorkspaceMainProps(
  props: Omit<React.ComponentProps<typeof BuildWizardWorkspaceMain>, 'children'>,
) {
  return React.useMemo(() => props, [props]);
}
