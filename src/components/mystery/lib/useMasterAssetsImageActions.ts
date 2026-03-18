import { MasterAssetsActionParams } from './masterAssetsActionTypes';
import { useMasterAssetsAssetImageActions } from './useMasterAssetsAssetImageActions';
import { useMasterAssetsCharacterImageActions } from './useMasterAssetsCharacterImageActions';

export function useMasterAssetsImageActions(params: MasterAssetsActionParams) {
  return {
    ...useMasterAssetsCharacterImageActions(params),
    ...useMasterAssetsAssetImageActions(params),
  };
}
