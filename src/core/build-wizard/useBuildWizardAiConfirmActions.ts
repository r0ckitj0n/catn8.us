import React from 'react';

interface UseBuildWizardAiConfirmActionsOptions {
  generateStepsFromAi: (mode: 'fill_missing' | 'complete') => Promise<unknown>;
  requestConfirmation: (config: { title: string; message: string; confirmLabel?: string; confirmButtonClass?: string }) => Promise<boolean>;
}

export function useBuildWizardAiConfirmActions({
  generateStepsFromAi,
  requestConfirmation,
}: UseBuildWizardAiConfirmActionsOptions) {
  const onEstimateMissingWithAi = React.useCallback(async () => {
    const confirmed = await requestConfirmation({
      title: 'Estimate Missing Values?',
      message: 'Ask AI to estimate missing timeline and budget values for this project?',
      confirmLabel: 'Run AI Estimate',
      confirmButtonClass: 'btn btn-primary',
    });
    if (confirmed) {
      await generateStepsFromAi('fill_missing');
    }
  }, [generateStepsFromAi, requestConfirmation]);

  const onCompleteWithAi = React.useCallback(async () => {
    const confirmed = await requestConfirmation({
      title: 'Run Complete w/ AI?',
      message: 'This can reorder/add/update steps across phases using your project data and documents.',
      confirmLabel: 'Run Complete w/ AI',
      confirmButtonClass: 'btn btn-primary',
    });
    if (confirmed) {
      await generateStepsFromAi('complete');
    }
  }, [generateStepsFromAi, requestConfirmation]);

  return { onCompleteWithAi, onEstimateMissingWithAi };
}
