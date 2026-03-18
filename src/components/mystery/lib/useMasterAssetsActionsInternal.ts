import { IMasterAssetsActions } from '../../../types/mysteryHooks';
import { MasterAssetsActionLoaders, MasterAssetsActionState } from './masterAssetsActionTypes';
import { useMasterAssetsAdminActions } from './useMasterAssetsAdminActions';
import { useMasterAssetsDetailActions } from './useMasterAssetsDetailActions';
import { useMasterAssetsImageActions } from './useMasterAssetsImageActions';

export function useMasterAssetsActionsInternal(
  isAdmin: boolean,
  mysteryId: string | number,
  caseId: string | number,
  scenarioId: string | number,
  setError: (err: string) => void,
  showMysteryToast: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void,
  setBusy: (busy: boolean) => void,
  watchJobToast: (params: { caseId: number; jobId: number; label: string; onDone?: (result: any) => void }) => Promise<void>,
  loaders: MasterAssetsActionLoaders,
  state: MasterAssetsActionState,
): IMasterAssetsActions {
  const params = {
    caseId,
    isAdmin,
    loaders,
    mysteryId,
    scenarioId,
    setBusy,
    setError,
    showMysteryToast,
    state,
    watchJobToast,
  };

  const detailActions = useMasterAssetsDetailActions(params);
  const imageActions = useMasterAssetsImageActions(params);
  const adminActions = useMasterAssetsAdminActions(params);

  return {
    ...detailActions,
    ...adminActions,
    ...imageActions,
  };
}
