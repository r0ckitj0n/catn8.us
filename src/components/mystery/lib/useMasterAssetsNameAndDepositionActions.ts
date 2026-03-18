import React from 'react';

import { ApiClient } from '../../../core/ApiClient';
import { MasterAssetsActionParams } from './masterAssetsActionTypes';

export function useMasterAssetsNameAndDepositionActions({
  isAdmin,
  loaders,
  mysteryId,
  scenarioId,
  setError,
  showMysteryToast,
  state,
}: MasterAssetsActionParams) {
  const loadMasterCharacterDeposition = React.useCallback(async () => {
    const sid = Number(scenarioId);
    const eid = Number(state.masterCharacterScenarioEntityId || 0);
    if (!sid || !eid) {
      state.setMasterCharacterDepositionText('');
      state.setMasterCharacterDepositionUpdatedAt('');
      return;
    }
    state.setMasterCharacterDepositionBusy(true);
    state.setMasterCharacterDepositionError('');
    try {
      const res = await ApiClient.get<any>(`/api/mystery/admin.php?action=get_scenario_deposition&scenario_id=${sid}&entity_id=${eid}`);
      const dep = res?.deposition;
      if (dep && typeof dep === 'object') {
        state.setMasterCharacterDepositionText(String(dep.text || ''));
        state.setMasterCharacterDepositionUpdatedAt(String(dep.updated_at || ''));
      } else {
        state.setMasterCharacterDepositionText('');
        state.setMasterCharacterDepositionUpdatedAt('');
      }
    } catch (e: any) {
      state.setMasterCharacterDepositionError(e?.message || 'Failed to load deposition');
    } finally {
      state.setMasterCharacterDepositionBusy(false);
    }
  }, [scenarioId, state]);

  const getMasterAssetNameDraft = React.useCallback(({ type, id, fallback }: { type: string; id: string | number; fallback: string }) => {
    const key = `${type}:${id}`;
    return state.masterAssetNameDrafts[key] ?? fallback;
  }, [state.masterAssetNameDrafts]);

  const updateMasterAssetNameDraft = React.useCallback(({ type, id, value }: { type: string; id: string | number; value: string }) => {
    const key = `${type}:${id}`;
    state.setMasterAssetNameDrafts((prev: any) => ({ ...prev, [key]: value }));
  }, [state.setMasterAssetNameDrafts]);

  const saveMasterAssetInlineName = React.useCallback(async ({ type, item }: { type: string; item: any }) => {
    if (!isAdmin || !mysteryId) return;
    const key = `${type}:${item.id}`;
    const newName = state.masterAssetNameDrafts[key];
    if (newName === undefined || newName === item.name) return;

    try {
      let action = '';
      if (type === 'character') action = 'upsert_master_character';
      else if (type === 'location') action = 'upsert_master_location';
      else if (type === 'weapon') action = 'upsert_master_weapon';
      else if (type === 'motive') action = 'upsert_master_motive';

      await ApiClient.post(`/api/mystery/admin.php?action=${action}`, {
        mystery_id: mysteryId,
        id: item.id,
        name: newName,
        slug: item.slug,
      });

      if (type === 'character') await loaders.loadMasterCharacters();
      else if (type === 'location') await loaders.loadMasterLocations();
      else if (type === 'weapon') await loaders.loadMasterWeapons();
      else if (type === 'motive') await loaders.loadMasterMotives();

      state.setMasterAssetNameDrafts((prev: any) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      showMysteryToast({ tone: 'success', message: 'Name updated.' });
    } catch (err: any) {
      setError(err?.message || 'Failed to update name');
    }
  }, [isAdmin, loaders, mysteryId, setError, showMysteryToast, state]);

  return {
    getMasterAssetNameDraft,
    loadMasterCharacterDeposition,
    saveMasterAssetInlineName,
    updateMasterAssetNameDraft,
  };
}
