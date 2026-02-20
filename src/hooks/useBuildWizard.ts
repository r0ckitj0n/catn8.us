import { useBuildWizardInternal } from '../core/build-wizard/useBuildWizardInternal';

export function useBuildWizard(onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void) {
  return useBuildWizardInternal(onToast);
}
