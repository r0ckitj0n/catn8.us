import React from 'react';

import { ApiClient } from '../../../core/ApiClient';
import { MasterAssetsActionParams } from './masterAssetsActionTypes';

export function useMasterAssetsCrudActions({
  isAdmin,
  loaders,
  mysteryId,
  setError,
  showMysteryToast,
  state,
}: MasterAssetsActionParams) {
  const masterAssetDetailsType = state.masterAssetDetailsType;

  const upsertMasterCharacter = React.useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isAdmin || !mysteryId) return;
    const name = String(state.newMasterCharacter.name || '').trim();
    if (!name) {
      setError('Master character name is required.');
      return;
    }
    try {
      await ApiClient.post('/api/mystery/admin.php?action=upsert_master_character', {
        mystery_id: mysteryId,
        name,
        rapport: { likes: [], dislikes: [], quirks: [], fun_facts: [] },
        favorites: { color: '', snack: '', drink: '', music: '', hobby: '', pet: '' },
        is_archived: 0,
      });
      await loaders.loadMasterCharacters();
      state.setNewMasterCharacter({ name: '' });
      showMysteryToast({ tone: 'success', message: 'Master character added.' });
    } catch (err: any) {
      setError(err?.message || 'Failed to add master character');
    }
  }, [isAdmin, loaders, mysteryId, setError, showMysteryToast, state]);

  const upsertMasterLocation = React.useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isAdmin || !mysteryId) return;
    const name = String(state.newMasterLocation.name || '').trim();
    if (!name) {
      setError('Master location name is required.');
      return;
    }
    try {
      await ApiClient.post('/api/mystery/admin.php?action=upsert_master_location', { mystery_id: mysteryId, name, is_archived: 0 });
      await loaders.loadMasterLocations();
      state.setNewMasterLocation({ name: '' });
      showMysteryToast({ tone: 'success', message: 'Master location added.' });
    } catch (err: any) {
      setError(err?.message || 'Failed to add master location');
    }
  }, [isAdmin, loaders, mysteryId, setError, showMysteryToast, state]);

  const upsertMasterWeapon = React.useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isAdmin || !mysteryId) return;
    const name = String(state.newMasterWeapon.name || '').trim();
    if (!name) {
      setError('Weapon name is required.');
      return;
    }
    try {
      await ApiClient.post('/api/mystery/admin.php?action=upsert_master_weapon', { mystery_id: mysteryId, name, is_archived: 0 });
      await loaders.loadMasterWeapons();
      state.setNewMasterWeapon({ name: '' });
      showMysteryToast({ tone: 'success', message: 'Weapon added.' });
    } catch (err: any) {
      setError(err?.message || 'Failed to add weapon');
    }
  }, [isAdmin, loaders, mysteryId, setError, showMysteryToast, state]);

  const upsertMasterMotive = React.useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isAdmin || !mysteryId) return;
    const name = String(state.newMasterMotive.name || '').trim();
    if (!name) {
      setError('Motive name is required.');
      return;
    }
    try {
      await ApiClient.post('/api/mystery/admin.php?action=upsert_master_motive', { mystery_id: mysteryId, name, is_archived: 0 });
      await loaders.loadMasterMotives();
      state.setNewMasterMotive({ name: '' });
      showMysteryToast({ tone: 'success', message: 'Motive added.' });
    } catch (err: any) {
      setError(err?.message || 'Failed to add motive');
    }
  }, [isAdmin, loaders, mysteryId, setError, showMysteryToast, state]);

  const setMasterAssetRegenLock = React.useCallback(async ({ type, item, is_regen_locked }: { type: string; item: any; is_regen_locked: number }) => {
    if (!isAdmin || !mysteryId || !item?.id) return;
    try {
      await ApiClient.post('/api/mystery/admin.php?action=set_master_regen_lock', { mystery_id: mysteryId, type, id: item.id, is_regen_locked });
      if (type === 'character') await loaders.loadMasterCharacters();
      else if (type === 'location') await loaders.loadMasterLocations();
      else if (type === 'weapon') await loaders.loadMasterWeapons();
      else if (type === 'motive') await loaders.loadMasterMotives();
      state.setMasterAssetDetailsItem((prev: any) => {
        if (!prev || masterAssetDetailsType !== type || prev.id !== item.id) return prev;
        return { ...prev, is_regen_locked };
      });
      showMysteryToast({ tone: 'success', message: is_regen_locked ? 'Locked from regeneration.' : 'Unlocked for regeneration.' });
    } catch (e: any) {
      setError(e?.message || 'Failed to update regen lock');
    }
  }, [isAdmin, loaders, masterAssetDetailsType, mysteryId, setError, showMysteryToast, state]);

  const archiveMasterAsset = React.useCallback(async ({ type, id, is_archived }: { type: string; id: string | number; is_archived: number }) => {
    if (!isAdmin || !mysteryId) return;
    try {
      let action = '';
      if (type === 'character') action = 'archive_master_character';
      else if (type === 'location') action = 'archive_master_location';
      else if (type === 'weapon') action = 'archive_master_weapon';
      else if (type === 'motive') action = 'archive_master_motive';
      await ApiClient.post(`/api/mystery/admin.php?action=${action}`, { mystery_id: mysteryId, id, is_archived });
      if (type === 'character') await loaders.loadMasterCharacters();
      else if (type === 'location') await loaders.loadMasterLocations();
      else if (type === 'weapon') await loaders.loadMasterWeapons();
      else if (type === 'motive') await loaders.loadMasterMotives();
      showMysteryToast({ tone: 'success', message: is_archived ? 'Asset archived.' : 'Asset restored.' });
    } catch (e: any) {
      setError(e?.message || 'Failed to update asset');
    }
  }, [isAdmin, loaders, mysteryId, setError, showMysteryToast]);

  const confirmMasterAssetDelete = React.useCallback(async () => {
    if (!isAdmin || !mysteryId || !state.pendingMasterDelete) return;
    try {
      const { type, item } = state.pendingMasterDelete;
      let action = '';
      if (type === 'character') action = 'delete_master_character';
      else if (type === 'location') action = 'delete_master_location';
      else if (type === 'weapon') action = 'delete_master_weapon';
      else if (type === 'motive') action = 'delete_master_motive';
      await ApiClient.post(`/api/mystery/admin.php?action=${action}`, { mystery_id: mysteryId, id: item.id });
      if (type === 'character') await loaders.loadMasterCharacters();
      else if (type === 'location') await loaders.loadMasterLocations();
      else if (type === 'weapon') await loaders.loadMasterWeapons();
      else if (type === 'motive') await loaders.loadMasterMotives();
      state.setPendingMasterDelete(null);
      showMysteryToast({ tone: 'success', message: 'Asset deleted.' });
    } catch (e: any) {
      setError(e?.message || 'Failed to delete asset');
    }
  }, [isAdmin, loaders, mysteryId, setError, showMysteryToast, state]);

  const requestMasterAssetDelete = React.useCallback(({ type, item }: { type: string; item: any }) => {
    if (!isAdmin) return;
    if (!item.is_archived) {
      setError('Only archived assets can be deleted.');
      return;
    }
    state.setPendingMasterDelete({ type, item });
  }, [isAdmin, setError, state]);

  return {
    archiveMasterAsset,
    confirmMasterAssetDelete,
    requestMasterAssetDelete,
    setMasterAssetRegenLock,
    upsertMasterCharacter,
    upsertMasterLocation,
    upsertMasterMotive,
    upsertMasterWeapon,
  };
}
