import React from 'react';

import { BuildWizardConfirmState } from './buildWizardPageRenderTypes';

export function useBuildWizardConfirmationActions() {
  const [confirmState, setConfirmState] = React.useState<BuildWizardConfirmState | null>(null);

  const requestConfirmation = React.useCallback((config: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmButtonClass?: string;
  }) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        title: config.title,
        message: config.message,
        confirmLabel: config.confirmLabel || 'Confirm',
        cancelLabel: config.cancelLabel || 'Cancel',
        confirmButtonClass: config.confirmButtonClass || 'btn btn-danger',
        resolve,
      });
    });
  }, []);

  const closeConfirmation = React.useCallback((confirmed: boolean) => {
    setConfirmState((current) => {
      if (current) {
        current.resolve(confirmed);
      }
      return null;
    });
  }, []);

  return {
    closeConfirmation,
    confirmState,
    requestConfirmation,
  };
}
