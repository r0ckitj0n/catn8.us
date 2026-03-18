import { MasterAssetsActionParams } from './masterAssetsActionTypes';
import { useMasterAssetsNameAndDepositionActions } from './useMasterAssetsNameAndDepositionActions';
import { useMasterAssetsSaveAndJobActions } from './useMasterAssetsSaveAndJobActions';

export function useMasterAssetsDetailActions(params: MasterAssetsActionParams) {
  return {
    ...useMasterAssetsNameAndDepositionActions(params),
    ...useMasterAssetsSaveAndJobActions(params),
  };
}
