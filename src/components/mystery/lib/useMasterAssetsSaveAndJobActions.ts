import React from 'react';

import { ApiClient } from '../../../core/ApiClient';
import { MasterAssetsActionParams } from './masterAssetsActionTypes';

export function useMasterAssetsSaveAndJobActions({
  caseId,
  isAdmin,
  loaders,
  mysteryId,
  setBusy,
  setError,
  showMysteryToast,
  state,
  watchJobToast,
}: MasterAssetsActionParams) {
  const masterAssetDetailsItem = state.masterAssetDetailsItem;
  const masterAssetDetailsType = state.masterAssetDetailsType;
  const isCharacter = masterAssetDetailsType === 'character';

  const saveMasterAssetDetails = React.useCallback(async () => {
    if (!isAdmin || !mysteryId || !masterAssetDetailsItem) return;
    const type = masterAssetDetailsType;
    const name = state.masterAssetDetailsName.trim();
    if (!name) {
      setError('Name is required.');
      return;
    }

    try {
      let action = '';
      if (type === 'character') action = 'upsert_master_character';
      else if (type === 'location') action = 'upsert_master_location';
      else if (type === 'weapon') action = 'upsert_master_weapon';
      else if (type === 'motive') action = 'upsert_master_motive';

      const payload: any = {
        mystery_id: mysteryId,
        id: masterAssetDetailsItem.id,
        slug: masterAssetDetailsItem.slug,
        name,
        is_archived: masterAssetDetailsItem.is_archived ? 1 : 0,
      };

      if (type === 'character') {
        const fields = state.masterAssetDetailsFields;
        Object.assign(payload, {
          voice_profile_id: Number(fields.voice_profile_id || 0),
          dob: String(fields.dob || ''),
          age: Number(fields.age || 0),
          hometown: String(fields.hometown || ''),
          address: String(fields.address || ''),
          ethnicity: String(fields.ethnicity || ''),
          zodiac: String(fields.zodiac || ''),
          mbti: String(fields.mbti || ''),
          height: String(fields.height || ''),
          weight: String(fields.weight || ''),
          eye_color: String(fields.eye_color || ''),
          hair_color: String(fields.hair_color || ''),
          distinguishing_marks: String(fields.distinguishing_marks || ''),
          education: String(fields.education || ''),
          employment: Array.isArray(fields.employment) ? fields.employment : [],
          aliases: Array.isArray(fields.aliases) ? fields.aliases : [],
          criminal_record: String(fields.criminal_record || ''),
          fav_color: String(fields.fav_color || ''),
          fav_snack: String(fields.fav_snack || ''),
          fav_drink: String(fields.fav_drink || ''),
          fav_music: String(fields.fav_music || ''),
          fav_hobby: String(fields.fav_hobby || ''),
          fav_pet: String(fields.fav_pet || ''),
          rapport_likes: Array.isArray(fields.rapport_likes) ? fields.rapport_likes : [],
          rapport_dislikes: Array.isArray(fields.rapport_dislikes) ? fields.rapport_dislikes : [],
          rapport_quirks: Array.isArray(fields.rapport_quirks) ? fields.rapport_quirks : [],
          rapport_fun_facts: Array.isArray(fields.rapport_fun_facts) ? fields.rapport_fun_facts : [],
          rapport: state.masterAssetDetailsRapport,
          favorites: state.masterAssetDetailsFavorites,
        });
      } else {
        const dataObj = state.getMasterAssetDataObject();
        payload.description = dataObj.description || '';
        payload.items = dataObj.items || [];
        payload.image = dataObj.image || null;
        if (type === 'location') {
          const fields = state.masterAssetDetailsFields;
          Object.assign(payload, {
            location_id: String(fields.location_id || ''),
            address_line1: String(fields.address_line1 || ''),
            address_line2: String(fields.address_line2 || ''),
            city: String(fields.city || ''),
            region: String(fields.region || ''),
            postal_code: String(fields.postal_code || ''),
            country: String(fields.country || ''),
            base_image_prompt: String(fields.base_image_prompt || ''),
            overlay_asset_prompt: String(fields.overlay_asset_prompt || ''),
            overlay_trigger: String(fields.overlay_trigger || ''),
          });
        } else if (type === 'weapon') {
          payload.fingerprints = Array.isArray(state.masterAssetDetailsFields.fingerprints) ? state.masterAssetDetailsFields.fingerprints : [];
        }
      }

      await ApiClient.post(`/api/mystery/admin.php?action=${action}`, payload);
      state.setMasterAssetDetailsItem((prev: any) => ({ ...prev, name, ...payload }));
      state.masterAssetDetailsCleanSnapshotRef.current = state.buildMasterAssetDetailsSnapshot();

      if (type === 'character') await loaders.loadMasterCharacters();
      else if (type === 'location') await loaders.loadMasterLocations();
      else if (type === 'weapon') await loaders.loadMasterWeapons();
      else if (type === 'motive') await loaders.loadMasterMotives();

      showMysteryToast({ tone: 'success', message: 'Saved.' });
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    }
  }, [isAdmin, loaders, masterAssetDetailsItem, masterAssetDetailsType, mysteryId, setError, showMysteryToast, state]);

  const generateMasterAssetContent = React.useCallback(async () => {
    if (!isAdmin || !mysteryId || !masterAssetDetailsItem) return;
    if (!caseId) {
      setError('Select a case first to use the job queue.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const res = await ApiClient.post<any>('/api/mystery/play.php?action=enqueue_job', {
        case_id: caseId,
        job_action: 'generate_master_asset_content',
        job_spec: {
          mystery_id: mysteryId,
          type: masterAssetDetailsType,
          id: masterAssetDetailsItem.id,
          fill_missing_only: true,
        },
      });
      if (!res?.success || !res?.id) throw new Error(res?.error || 'Failed to enqueue job');

      const type = masterAssetDetailsType;
      const id = masterAssetDetailsItem.id;
      void watchJobToast({
        caseId: Number(caseId),
        jobId: Number(res.id),
        label: `Generating ${type} content`,
        onDone: async () => {
          let newList: any[] = [];
          if (type === 'character') newList = await loaders.loadMasterCharacters();
          else if (type === 'location') newList = await loaders.loadMasterLocations();
          else if (type === 'weapon') newList = await loaders.loadMasterWeapons();
          else if (type === 'motive') newList = await loaders.loadMasterMotives();

          if (masterAssetDetailsItem && Number(masterAssetDetailsItem.id) === Number(id)) {
            const updatedItem = newList.find((item) => Number(item.id) === Number(id));
            if (updatedItem) state.openMasterAssetDetails({ type, item: updatedItem });
          }
          showMysteryToast({ tone: 'success', message: `Generated ${type} content applied.` });
        },
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to generate content');
    } finally {
      setBusy(false);
    }
  }, [caseId, isAdmin, loaders, masterAssetDetailsItem, masterAssetDetailsType, mysteryId, setBusy, setError, showMysteryToast, state, watchJobToast]);

  const clearMasterAssetFields = React.useCallback(async () => {
    if (!isAdmin || !mysteryId || !masterAssetDetailsItem) return;
    if (!window.confirm('Clear all generated/profile fields?')) return;

    setBusy(true);
    setError('');
    try {
      const res = await ApiClient.post<any>('/api/mystery/admin.php?action=clear_master_asset_fields', {
        mystery_id: mysteryId,
        type: masterAssetDetailsType,
        id: masterAssetDetailsItem.id,
      });
      if (!res?.success) throw new Error(res?.error || 'Clear failed');

      if (isCharacter) {
        state.setMasterAssetDetailsFields({
          dob: '', age: 0, hometown: '', address: '', aliases: [],
          ethnicity: '', zodiac: '', mbti: '', height: '', weight: '',
          eye_color: '', hair_color: '', distinguishing_marks: '',
          education: '', employment: [], criminal_record: '',
          fav_color: '', fav_snack: '', fav_drink: '', fav_music: '', fav_hobby: '', fav_pet: '',
          rapport_likes: [], rapport_dislikes: [], rapport_quirks: [], rapport_fun_facts: [],
        });
        state.setMasterAssetDetailsRapport({ likes: [], dislikes: [], quirks: [], fun_facts: [] });
        state.setMasterAssetDetailsFavorites({ color: '', snack: '', drink: '', music: '', hobby: '', pet: '' });
      } else {
        state.setMasterAssetDetailsFields((prev: any) => ({
          ...prev,
          description: '',
          location_id: '', address_line1: '', address_line2: '', city: '', region: '', postal_code: '', country: '',
          base_image_prompt: '', overlay_asset_prompt: '', overlay_trigger: '',
          fingerprints: [],
        }));
      }
      state.setMasterAssetDetailsData({ description: '', items: [], image: null });
      showMysteryToast({ tone: 'success', message: 'Cleared.' });
    } catch (e: any) {
      setError(e?.message || 'Clear failed');
    } finally {
      setBusy(false);
    }
  }, [isAdmin, isCharacter, masterAssetDetailsItem, masterAssetDetailsType, mysteryId, setBusy, setError, showMysteryToast, state]);

  return {
    clearMasterAssetFields,
    generateMasterAssetContent,
    saveMasterAssetDetails,
  };
}
