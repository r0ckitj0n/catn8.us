import React from 'react';

import { ApiClient } from '../../../core/ApiClient';
import { MasterAssetsActionParams } from './masterAssetsActionTypes';

export function useMasterAssetsAssetImageActions({
  isAdmin,
  mysteryId,
  setError,
  showMysteryToast,
  state,
}: MasterAssetsActionParams) {
  const masterAssetDetailsItem = state.masterAssetDetailsItem;
  const masterAssetDetailsType = state.masterAssetDetailsType;

  const uploadMasterAssetImage = React.useCallback(async ({ file }: { file: File }) => {
    const mid = Number(mysteryId);
    const type = masterAssetDetailsType;
    const id = Number(masterAssetDetailsItem?.id || 0);
    if (!mid || !id || (type !== 'location' && type !== 'weapon' && type !== 'motive')) return;

    try {
      const fd = new FormData();
      fd.append('mystery_id', String(mid));
      fd.append('type', type);
      fd.append('id', String(id));
      fd.append('file', file);
      const res = await ApiClient.postFormData<any>('/api/mystery/admin.php?action=upload_master_asset_image', fd);
      if (!res?.success) throw new Error(res?.error || 'Upload failed');
      if (res.image) {
        state.setMasterAssetDetailsData((prev: any) => ({
          ...prev,
          image: { ...(prev.image || {}), ...res.image },
        }));
      }
      showMysteryToast({ tone: 'success', message: 'Uploaded.' });
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    }
  }, [masterAssetDetailsItem, masterAssetDetailsType, mysteryId, setError, showMysteryToast, state]);

  const generateMasterAssetPrimaryImage = React.useCallback(async () => {
    if (!isAdmin || !mysteryId || !masterAssetDetailsItem?.id) return;
    const type = masterAssetDetailsType;
    if (type !== 'location' && type !== 'weapon') return;
    try {
      const res = await ApiClient.post<any>('/api/mystery/admin.php?action=generate_master_asset_image', {
        mystery_id: mysteryId,
        type,
        id: masterAssetDetailsItem.id,
      });
      if (!res?.success) throw new Error(res?.error || 'Failed to generate image');
      if (res.image) {
        state.setMasterAssetDetailsData((prev: any) => ({
          ...prev,
          image: { ...(prev.image || {}), ...res.image },
        }));
      }
      showMysteryToast({ tone: 'success', message: 'Generated image.' });
    } catch (e: any) {
      setError(e?.message || 'Failed to generate image');
    }
  }, [isAdmin, masterAssetDetailsItem, masterAssetDetailsType, mysteryId, setError, showMysteryToast, state]);

  const deleteMasterAssetPrimaryImage = React.useCallback(async () => {
    if (!isAdmin || !mysteryId || !masterAssetDetailsItem?.id) return;
    const type = masterAssetDetailsType;
    if (type !== 'location' && type !== 'weapon') return;
    try {
      const res = await ApiClient.post<any>('/api/mystery/admin.php?action=delete_master_asset_image', {
        mystery_id: mysteryId,
        type,
        id: masterAssetDetailsItem.id,
      });
      if (!res?.success) throw new Error(res?.error || 'Failed to delete image');
      state.setMasterAssetDetailsData((prev: any) => ({
        ...prev,
        image: { ...(prev.image || {}), ...(res.image || {}), url: res.image?.url || '' },
      }));
      showMysteryToast({ tone: 'success', message: 'Deleted image file.' });
    } catch (e: any) {
      setError(e?.message || 'Failed to delete image');
    }
  }, [isAdmin, masterAssetDetailsItem, masterAssetDetailsType, mysteryId, setError, showMysteryToast, state]);

  const openMasterAssetDerivedJson = React.useCallback(async () => {
    if (!isAdmin || !mysteryId || !masterAssetDetailsItem?.id) return;
    let action = '';
    if (masterAssetDetailsType === 'character') action = 'get_master_character_profile_json';
    else if (masterAssetDetailsType === 'location') action = 'get_master_location_profile_json';
    else if (masterAssetDetailsType === 'weapon') action = 'get_master_weapon_profile_json';
    else if (masterAssetDetailsType === 'motive') action = 'get_master_motive_profile_json';
    if (!action) return;

    state.setMasterAssetJsonError('');
    state.setMasterAssetJsonText('');
    try {
      const res = await ApiClient.get<any>(`/api/mystery/admin.php?action=${action}&mystery_id=${mysteryId}&id=${masterAssetDetailsItem.id}`);
      if (!res?.success) throw new Error(res?.error || 'Failed to load JSON');
      state.setMasterAssetJsonText(JSON.stringify(res.profile_json || {}, null, 2));
      state.setMasterAssetJsonOpen(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to load JSON');
    }
  }, [isAdmin, masterAssetDetailsItem, masterAssetDetailsType, mysteryId, setError, state]);

  return {
    deleteMasterAssetPrimaryImage,
    generateMasterAssetPrimaryImage,
    openMasterAssetDerivedJson,
    uploadMasterAssetImage,
  };
}
