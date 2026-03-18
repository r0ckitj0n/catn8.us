import { MasterAssetsActionParams } from './masterAssetsActionTypes';
import { useMasterAssetsCrudActions } from './useMasterAssetsCrudActions';
import { useMasterAssetsMaintenanceActions } from './useMasterAssetsMaintenanceActions';

export function useMasterAssetsAdminActions(params: MasterAssetsActionParams) {
  return {
    ...useMasterAssetsCrudActions(params),
    ...useMasterAssetsMaintenanceActions(params),
  };
}
