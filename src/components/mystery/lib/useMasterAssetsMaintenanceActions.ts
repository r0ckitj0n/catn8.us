import React from 'react';

import { ApiClient } from '../../../core/ApiClient';
import { MasterAssetsActionParams } from './masterAssetsActionTypes';

export function useMasterAssetsMaintenanceActions({
  isAdmin,
  loaders,
  mysteryId,
  setError,
  showMysteryToast,
  state,
}: MasterAssetsActionParams) {
  const checkMaintenanceNeeded = React.useCallback(async () => {
    if (!isAdmin || !mysteryId) return;
    try {
      const res = await ApiClient.get<any>(`/api/mystery/admin.php?action=check_master_assets_maintenance_needed&mystery_id=${mysteryId}`);
      if (res && res.success) {
        state.setNeedsCleanup(!!res.needs_cleanup);
        state.setNeedsLinkImport(!!res.needs_link_import);
      }
    } catch (e) {
      console.error('Failed to check maintenance status', e);
    }
  }, [isAdmin, mysteryId, state]);

  const backfillMasterAssetColumnsFromJson = React.useCallback(async () => {
    if (!isAdmin || !mysteryId) return;
    try {
      const res = await ApiClient.post<any>('/api/mystery/admin.php?action=backfill_master_asset_columns_from_json', {
        mystery_id: mysteryId,
        types: ['character', 'location', 'weapon'],
      });
      const rep = res?.report;
      const msg = rep ? `Imported from JSON. Characters: ${rep.characters_updated || 0}, Locations: ${rep.locations_updated || 0}, Weapons: ${rep.weapons_updated || 0}.` : 'Imported from JSON.';
      showMysteryToast({ tone: 'success', message: msg });
      await loaders.loadMasterCharacters();
      await loaders.loadMasterLocations();
      await loaders.loadMasterWeapons();
    } catch (e: any) {
      setError(e?.message || 'Import failed');
    }
  }, [isAdmin, loaders, mysteryId, setError, showMysteryToast]);

  const cleanupMasterOnlyFieldsForMystery = React.useCallback(async () => {
    if (!isAdmin || !mysteryId) return;
    if (!window.confirm('Run cleanup across ALL cases for this mystery? This removes address/aliases/eye_color/weight/hair_color from case entity JSON.')) return;
    try {
      const res = await ApiClient.post<any>('/api/mystery/admin.php?action=cleanup_master_only_fields_for_mystery', { mystery_id: mysteryId });
      const rep = res?.report;
      showMysteryToast({ tone: 'success', message: `Cleanup complete. Updated ${rep?.entities_updated || 0} of ${rep?.entities_scanned || 0} characters.` });
    } catch (e: any) {
      setError(e?.message || 'Cleanup failed');
    }
  }, [isAdmin, mysteryId, setError, showMysteryToast]);

  const linkAndImportCaseDetailsForMystery = React.useCallback(async () => {
    if (!isAdmin || !mysteryId) return;
    if (!window.confirm('Run link+import across ALL cases? This links case characters to master assets and imports missing fields (fills blanks only).')) return;
    showMysteryToast({ tone: 'info', message: 'Running link+import…' });
    try {
      const res = await ApiClient.post<any>('/api/mystery/admin.php?action=link_and_import_case_character_details_for_mystery', { mystery_id: mysteryId });
      const rep = res?.report;
      showMysteryToast({ tone: 'success', message: `Link+import complete. Linked: ${rep?.entities_linked || 0}, Masters updated: ${rep?.masters_updated || 0}.` });
      await loaders.loadMasterCharacters();
    } catch (e: any) {
      setError(e?.message || 'Link+import failed');
    }
  }, [isAdmin, loaders, mysteryId, setError, showMysteryToast]);

  return {
    backfillMasterAssetColumnsFromJson,
    checkMaintenanceNeeded,
    cleanupMasterOnlyFieldsForMystery,
    linkAndImportCaseDetailsForMystery,
  };
}
