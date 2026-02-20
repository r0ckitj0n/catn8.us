import React from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IToast } from '../../../types/common';
import { IMasterCharacter, IMasterLocation, IMasterWeapon, IMasterMotive } from '../../../types/game';
import { IMasterAssetsCore, IMasterAssetsDetails, IMasterAssetsActions } from '../../../types/mysteryHooks';

type MasterAssetItem = IMasterCharacter | IMasterLocation | IMasterWeapon | IMasterMotive;

export function useMasterAssetsActionsInternal(
  isAdmin: boolean,
  mysteryId: string | number,
  caseId: string | number,
  scenarioId: string | number,
  setError: (err: string) => void,
  showMysteryToast: (t: IToast) => void,
  setBusy: (busy: boolean) => void,
  watchJobToast: (params: { caseId: number; jobId: number; label: string; onDone?: (result: any) => void }) => Promise<void>,
  loaders: {
    loadMasterCharacters: () => Promise<IMasterCharacter[]>;
    loadMasterLocations: () => Promise<IMasterLocation[]>;
    loadMasterWeapons: () => Promise<IMasterWeapon[]>;
    loadMasterMotives: () => Promise<IMasterMotive[]>;
    loadMasterCharacterImages: (id: string | number) => Promise<void>;
  },
  state: IMasterAssetsCore & IMasterAssetsDetails & { masterCharacterScenarioEntityId: number | null }
): IMasterAssetsActions {
  const {
    masterAssetDetailsType,
    masterAssetDetailsItem,
    masterAssetDetailsName,
    masterAssetDetailsFields,
    masterAssetDetailsData,
    masterAssetDetailsRapport,
    masterAssetDetailsFavorites,
    masterCharacterIrEmotionEnabled,
    masterCharacterIrEmotions,
    masterCharacterIrUrls,
    masterCharacterScenarioEntityId,
    setMasterCharacterDepositionText,
    setMasterCharacterDepositionUpdatedAt,
    setMasterCharacterDepositionError,
    setMasterCharacterDepositionBusy,
    setNeedsCleanup,
    setNeedsLinkImport,
    setMasterAssetJsonText,
    setMasterAssetJsonTitle,
    setMasterAssetJsonError,
    setMasterAssetJsonOpen,
    setMasterAssetDetailsItem,
    setMasterAssetDetailsData,
  } = state;

  const isCharacter = masterAssetDetailsType === 'character';

  const loadMasterCharacterDeposition = React.useCallback(async () => {
    const sid = Number(scenarioId);
    const eid = Number(masterCharacterScenarioEntityId || 0);
    if (!sid || !eid) {
      setMasterCharacterDepositionText('');
      setMasterCharacterDepositionUpdatedAt('');
      return;
    }
    setMasterCharacterDepositionBusy(true);
    setMasterCharacterDepositionError('');
    try {
      const res = await ApiClient.get<any>('/api/mystery/admin.php?action=get_scenario_deposition&scenario_id=' + String(sid) + '&entity_id=' + String(eid));
      const dep = res?.deposition;
      if (dep && typeof dep === 'object') {
        setMasterCharacterDepositionText(String(dep.text || ''));
        setMasterCharacterDepositionUpdatedAt(String(dep.updated_at || ''));
      } else {
        setMasterCharacterDepositionText('');
        setMasterCharacterDepositionUpdatedAt('');
      }
    } catch (e: any) {
      setMasterCharacterDepositionError(e?.message || 'Failed to load deposition');
    } finally {
      setMasterCharacterDepositionBusy(false);
    }
  }, [masterCharacterScenarioEntityId, scenarioId, setMasterCharacterDepositionBusy, setMasterCharacterDepositionError, setMasterCharacterDepositionText, setMasterCharacterDepositionUpdatedAt]);

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
        slug: item.slug
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
  }, [isAdmin, mysteryId, state.masterAssetNameDrafts, loaders, showMysteryToast, setError, state.setMasterAssetNameDrafts]);

  const uploadMasterCharacterImage = React.useCallback(async ({ kind, file }: { kind: 'character' | 'mugshot' | 'ir', file: File }) => {
    const mid = Number(mysteryId);
    const id = Number(masterAssetDetailsItem?.id || 0);
    if (!mid || !id) return;

    try {
      const fd = new FormData();
      fd.append('mystery_id', String(mid));
      fd.append('id', String(id));
      fd.append('kind', kind);
      fd.append('file', file);
      const res = await ApiClient.postFormData<any>('/api/mystery/admin.php?action=upload_master_character_image', fd);
      if (!res?.success) throw new Error(res?.error || 'Upload failed');

      await loaders.loadMasterCharacterImages(id);
      showMysteryToast({ tone: 'success', message: 'Uploaded.' });
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    }
  }, [mysteryId, masterAssetDetailsItem, loaders, showMysteryToast, setError]);

  const deleteMasterCharacterImage = React.useCallback(async ({ kind, url }: { kind: 'character' | 'mugshot' | 'ir', url?: string }) => {
    if (!isAdmin) return;
    const mid = Number(mysteryId);
    const id = Number(masterAssetDetailsItem?.id || 0);
    if (!mid || !id) return;

    try {
      const payload: any = { mystery_id: mid, id, kind };
      if (kind === 'ir') payload.url = String(url || '');
      const res = await ApiClient.post<any>('/api/mystery/admin.php?action=delete_master_character_image', payload);
      if (!res?.success) throw new Error(res?.error || 'Delete failed');

      await loaders.loadMasterCharacterImages(id);
      showMysteryToast({ tone: 'success', message: 'Deleted.' });
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  }, [isAdmin, mysteryId, masterAssetDetailsItem, loaders, showMysteryToast, setError]);

  const openMasterCharacterImagePrompt = React.useCallback(async ({ kind }: { kind: 'character' | 'mugshot' | 'ir' }) => {
    if (!isAdmin || !mysteryId || !masterAssetDetailsItem?.id) return;

    state.setMasterAssetJsonError('');
    state.setMasterAssetJsonText('');
    state.setMasterAssetJsonTitle(kind === 'character' ? 'Character Prompt' : (kind === 'mugshot' ? 'Mugshot Prompt' : 'Interrogation Room Prompt'));
    try {
      const res = await ApiClient.get<any>(`/api/mystery/admin.php?action=get_master_character_image_prompt_json&mystery_id=${mysteryId}&id=${masterAssetDetailsItem.id}`);
      if (!res?.success) throw new Error(res?.error || 'Failed to load prompt JSON');

      const pj = res.prompt_json ?? {};
      let block = kind === 'character' ? pj?.character : (kind === 'mugshot' ? pj?.mugshot : pj?.interrogation_room);
      const text = (String(block?.style_instruction || '').trim() !== '' ? ('STYLE INSTRUCTION\n' + block.style_instruction + '\n\n') : '') + 'PROMPT\n' + (block?.prompt || '');

      state.setMasterAssetJsonText(text);
      state.setMasterAssetJsonOpen(true);
    } catch (e: any) {
      state.setMasterAssetJsonError(e?.message || 'Failed to load prompt JSON');
      state.setMasterAssetJsonOpen(true);
    }
  }, [isAdmin, mysteryId, masterAssetDetailsItem, state.setMasterAssetJsonError, state.setMasterAssetJsonText, state.setMasterAssetJsonTitle, state.setMasterAssetJsonOpen]);

  const generateMasterCharacterImages = React.useCallback(async ({ kind }: { kind: 'character' | 'mugshot' | 'ir' }) => {
    if (!isAdmin || !mysteryId || !masterAssetDetailsItem?.id) return;

    if (kind === 'ir') {
      const selected = masterCharacterIrEmotions.filter((e) => masterCharacterIrEmotionEnabled[e] !== false);
      const existing = new Set<string>();
      masterCharacterIrUrls.forEach(u => {
        const m = u.match(/_ir_([a-z0-9_-]+)\.(png|jpe?g|webp)(?:\?.*)?$/i);
        if (m && m[1]) existing.add(m[1].toLowerCase());
      });
      const missing = selected.filter((e) => !existing.has(e));
      if (!missing.length) {
        showMysteryToast({ tone: 'info', message: 'All selected emotions already exist.' });
        return;
      }

      try {
        const res = await ApiClient.post<any>('/api/mystery/admin.php?action=generate_master_character_images', {
          mystery_id: mysteryId,
          id: masterAssetDetailsItem.id,
          kind: 'ir',
          emotions: missing,
        });
        if (!res?.success) throw new Error(res?.error || 'Failed to generate images');
        await loaders.loadMasterCharacterImages(masterAssetDetailsItem.id);
        showMysteryToast({ tone: 'success', message: 'Generated missing interrogation room images.' });
      } catch (e: any) {
        setError(e?.message || 'Failed to generate images');
      }
      return;
    }

    try {
      const res = await ApiClient.post<any>('/api/mystery/admin.php?action=generate_master_character_images', {
        mystery_id: mysteryId,
        id: masterAssetDetailsItem.id,
        kind,
      });
      if (!res?.success) throw new Error(res?.error || 'Failed to generate images');
      await loaders.loadMasterCharacterImages(masterAssetDetailsItem.id);
      showMysteryToast({ tone: 'success', message: kind === 'character' ? 'Generated character image.' : 'Generated mugshot.' });
    } catch (e: any) {
      setError(e?.message || 'Failed to generate images');
    }
  }, [isAdmin, mysteryId, masterAssetDetailsItem, masterCharacterIrEmotionEnabled, masterCharacterIrEmotions, masterCharacterIrUrls, loaders, showMysteryToast, setError]);

  const generateAllMissingMasterCharacterImages = React.useCallback(async () => {
    if (!isAdmin || !mysteryId || !masterAssetDetailsItem?.id) return;

    try {
      await ApiClient.post<any>('/api/mystery/admin.php?action=generate_master_character_images', { mystery_id: mysteryId, id: masterAssetDetailsItem.id, kind: 'character' });
      await ApiClient.post<any>('/api/mystery/admin.php?action=generate_master_character_images', { mystery_id: mysteryId, id: masterAssetDetailsItem.id, kind: 'mugshot' });

      const selected = masterCharacterIrEmotions.filter((e) => masterCharacterIrEmotionEnabled[e] !== false);
      const existing = new Set<string>();
      masterCharacterIrUrls.forEach(u => {
        const m = u.match(/_ir_([a-z0-9_-]+)\.(png|jpe?g|webp)(?:\?.*)?$/i);
        if (m && m[1]) existing.add(m[1].toLowerCase());
      });
      const missing = selected.filter((e) => !existing.has(e));
      if (missing.length) {
        await ApiClient.post<any>('/api/mystery/admin.php?action=generate_master_character_images', {
          mystery_id: mysteryId,
          id: masterAssetDetailsItem.id,
          kind: 'ir',
          emotions: missing,
        });
      }

      await loaders.loadMasterCharacterImages(masterAssetDetailsItem.id);
      showMysteryToast({ tone: 'success', message: 'Generated all missing character images.' });
    } catch (e: any) {
      setError(e?.message || 'Failed to generate images');
    }
  }, [isAdmin, mysteryId, masterAssetDetailsItem, masterCharacterIrEmotionEnabled, masterCharacterIrEmotions, masterCharacterIrUrls, loaders, showMysteryToast, setError]);

  const uploadMasterAssetImage = React.useCallback(async ({ file }: { file: File }) => {
    const mid = Number(mysteryId);
    const t = masterAssetDetailsType;
    const id = Number(masterAssetDetailsItem?.id || 0);
    if (!mid || !id || (t !== 'location' && t !== 'weapon' && t !== 'motive')) return;

    try {
      const fd = new FormData();
      fd.append('mystery_id', String(mid));
      fd.append('type', t);
      fd.append('id', String(id));
      fd.append('file', file);
      const res = await ApiClient.postFormData<any>('/api/mystery/admin.php?action=upload_master_asset_image', fd);
      if (!res?.success) throw new Error(res?.error || 'Upload failed');

      if (res.image) {
        state.setMasterAssetDetailsData((prev: any) => ({
          ...prev,
          image: { ...(prev.image || {}), ...res.image }
        }));
      }
      showMysteryToast({ tone: 'success', message: 'Uploaded.' });
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    }
  }, [mysteryId, masterAssetDetailsItem, masterAssetDetailsType, state.setMasterAssetDetailsData, showMysteryToast, setError]);

  const generateMasterAssetPrimaryImage = React.useCallback(async () => {
    if (!isAdmin || !mysteryId || !masterAssetDetailsItem?.id) return;
    const t = masterAssetDetailsType;
    if (t !== 'location' && t !== 'weapon') return;

    try {
      const res = await ApiClient.post<any>('/api/mystery/admin.php?action=generate_master_asset_image', {
        mystery_id: mysteryId,
        type: t,
        id: masterAssetDetailsItem.id,
      });
      if (!res?.success) throw new Error(res?.error || 'Failed to generate image');
      if (res.image) {
        state.setMasterAssetDetailsData((prev: any) => ({
          ...prev,
          image: { ...(prev.image || {}), ...res.image }
        }));
      }
      showMysteryToast({ tone: 'success', message: 'Generated image.' });
    } catch (e: any) {
      setError(e?.message || 'Failed to generate image');
    }
  }, [isAdmin, mysteryId, masterAssetDetailsItem, masterAssetDetailsType, state.setMasterAssetDetailsData, showMysteryToast, setError]);

  const deleteMasterAssetPrimaryImage = React.useCallback(async () => {
    if (!isAdmin || !mysteryId || !masterAssetDetailsItem?.id) return;
    const t = masterAssetDetailsType;
    if (t !== 'location' && t !== 'weapon') return;

    try {
      const res = await ApiClient.post<any>('/api/mystery/admin.php?action=delete_master_asset_image', {
        mystery_id: mysteryId,
        type: t,
        id: masterAssetDetailsItem.id,
      });
      if (!res?.success) throw new Error(res?.error || 'Failed to delete image');
      state.setMasterAssetDetailsData((prev: any) => ({
        ...prev,
        image: { ...(prev.image || {}), ...(res.image || {}), url: res.image?.url || '' }
      }));
      showMysteryToast({ tone: 'success', message: 'Deleted image file.' });
    } catch (e: any) {
      setError(e?.message || 'Failed to delete image');
    }
  }, [isAdmin, mysteryId, masterAssetDetailsItem, masterAssetDetailsType, state.setMasterAssetDetailsData, showMysteryToast, setError]);

  const saveMasterAssetDetails = React.useCallback(async () => {
    if (!isAdmin || !mysteryId || !masterAssetDetailsItem) return;
    const t = masterAssetDetailsType;
    const name = masterAssetDetailsName.trim();
    if (!name) {
      setError('Name is required.');
      return;
    }

    try {
      let action = '';
      if (t === 'character') action = 'upsert_master_character';
      else if (t === 'location') action = 'upsert_master_location';
      else if (t === 'weapon') action = 'upsert_master_weapon';
      else if (t === 'motive') action = 'upsert_master_motive';

      const payload: any = {
        mystery_id: mysteryId,
        id: masterAssetDetailsItem.id,
        slug: masterAssetDetailsItem.slug,
        name,
        is_archived: masterAssetDetailsItem.is_archived ? 1 : 0,
      };

      if (t === 'character') {
        const f = masterAssetDetailsFields;
        payload.voice_profile_id = Number(f.voice_profile_id || 0);
        payload.dob = String(f.dob || '');
        payload.age = Number(f.age || 0);
        payload.hometown = String(f.hometown || '');
        payload.address = String(f.address || '');
        payload.ethnicity = String(f.ethnicity || '');
        payload.zodiac = String(f.zodiac || '');
        payload.mbti = String(f.mbti || '');
        payload.height = String(f.height || '');
        payload.weight = String(f.weight || '');
        payload.eye_color = String(f.eye_color || '');
        payload.hair_color = String(f.hair_color || '');
        payload.distinguishing_marks = String(f.distinguishing_marks || '');
        payload.education = String(f.education || '');
        payload.employment = Array.isArray(f.employment) ? f.employment : [];
        payload.aliases = Array.isArray(f.aliases) ? f.aliases : [];
        payload.criminal_record = String(f.criminal_record || '');
        payload.fav_color = String(f.fav_color || '');
        payload.fav_snack = String(f.fav_snack || '');
        payload.fav_drink = String(f.fav_drink || '');
        payload.fav_music = String(f.fav_music || '');
        payload.fav_hobby = String(f.fav_hobby || '');
        payload.fav_pet = String(f.fav_pet || '');
        payload.rapport_likes = Array.isArray(f.rapport_likes) ? f.rapport_likes : [];
        payload.rapport_dislikes = Array.isArray(f.rapport_dislikes) ? f.rapport_dislikes : [];
        payload.rapport_quirks = Array.isArray(f.rapport_quirks) ? f.rapport_quirks : [];
        payload.rapport_fun_facts = Array.isArray(f.rapport_fun_facts) ? f.rapport_fun_facts : [];
        payload.rapport = masterAssetDetailsRapport;
        payload.favorites = masterAssetDetailsFavorites;
      } else {
        const dataObj = state.getMasterAssetDataObject();
        payload.description = dataObj.description || '';
        payload.items = dataObj.items || [];
        payload.image = dataObj.image || null;
        if (t === 'location') {
          const f = masterAssetDetailsFields;
          payload.location_id = String(f.location_id || '');
          payload.address_line1 = String(f.address_line1 || '');
          payload.address_line2 = String(f.address_line2 || '');
          payload.city = String(f.city || '');
          payload.region = String(f.region || '');
          payload.postal_code = String(f.postal_code || '');
          payload.country = String(f.country || '');
          payload.base_image_prompt = String(f.base_image_prompt || '');
          payload.overlay_asset_prompt = String(f.overlay_asset_prompt || '');
          payload.overlay_trigger = String(f.overlay_trigger || '');
        } else if (t === 'weapon') {
          payload.fingerprints = Array.isArray(masterAssetDetailsFields.fingerprints) ? masterAssetDetailsFields.fingerprints : [];
        }
      }

      await ApiClient.post(`/api/mystery/admin.php?action=${action}`, payload);

      state.setMasterAssetDetailsItem((prev: any) => ({ ...prev, name, ...payload }));
      state.masterAssetDetailsCleanSnapshotRef.current = state.buildMasterAssetDetailsSnapshot();

      if (t === 'character') await loaders.loadMasterCharacters();
      else if (t === 'location') await loaders.loadMasterLocations();
      else if (t === 'weapon') await loaders.loadMasterWeapons();
      else if (t === 'motive') await loaders.loadMasterMotives();

      showMysteryToast({ tone: 'success', message: 'Saved.' });
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    }
  }, [isAdmin, mysteryId, masterAssetDetailsItem, masterAssetDetailsType, masterAssetDetailsName, masterAssetDetailsFields, masterAssetDetailsRapport, masterAssetDetailsFavorites, state.getMasterAssetDataObject, state.buildMasterAssetDetailsSnapshot, state.masterAssetDetailsCleanSnapshotRef, loaders, showMysteryToast, setError, state.setMasterAssetDetailsItem]);

  const openMasterAssetDerivedJson = React.useCallback(async () => {
    if (!isAdmin || !mysteryId || !masterAssetDetailsItem?.id) return;
    const t = masterAssetDetailsType;
    let action = '';
    if (t === 'character') action = 'get_master_character_profile_json';
    else if (t === 'location') action = 'get_master_location_profile_json';
    else if (t === 'weapon') action = 'get_master_weapon_profile_json';
    else if (t === 'motive') action = 'get_master_motive_profile_json';
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
  }, [isAdmin, mysteryId, masterAssetDetailsItem, masterAssetDetailsType, state.setMasterAssetJsonError, state.setMasterAssetJsonText, state.setMasterAssetJsonOpen, setError]);

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
        is_archived: 0 
      });
      await loaders.loadMasterCharacters();
      state.setNewMasterCharacter({ name: '' });
      showMysteryToast({ tone: 'success', message: 'Master character added.' });
    } catch (err: any) {
      setError(err?.message || 'Failed to add master character');
    }
  }, [isAdmin, mysteryId, state.newMasterCharacter.name, loaders, showMysteryToast, setError, state.setNewMasterCharacter]);

  const upsertMasterLocation = React.useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isAdmin || !mysteryId) return;
    const name = String(state.newMasterLocation.name || '').trim();
    if (!name) {
      setError('Master location name is required.');
      return;
    }
    try {
      await ApiClient.post('/api/mystery/admin.php?action=upsert_master_location', { 
        mystery_id: mysteryId, 
        name,
        is_archived: 0 
      });
      await loaders.loadMasterLocations();
      state.setNewMasterLocation({ name: '' });
      showMysteryToast({ tone: 'success', message: 'Master location added.' });
    } catch (err: any) {
      setError(err?.message || 'Failed to add master location');
    }
  }, [isAdmin, mysteryId, state.newMasterLocation.name, loaders, showMysteryToast, setError, state.setNewMasterLocation]);

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
  }, [isAdmin, mysteryId, state.newMasterWeapon.name, loaders, showMysteryToast, setError, state.setNewMasterWeapon]);

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
  }, [isAdmin, mysteryId, state.newMasterMotive.name, loaders, showMysteryToast, setError, state.setNewMasterMotive]);

  const setMasterAssetRegenLock = React.useCallback(async ({ type, item, is_regen_locked }: { type: string; item: any; is_regen_locked: number }) => {
    if (!isAdmin || !mysteryId || !item?.id) return;
    try {
      await ApiClient.post('/api/mystery/admin.php?action=set_master_regen_lock', {
        mystery_id: mysteryId,
        type,
        id: item.id,
        is_regen_locked
      });

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
  }, [isAdmin, mysteryId, masterAssetDetailsType, state.setMasterAssetDetailsItem, loaders, showMysteryToast, setError]);

  const checkMaintenanceNeeded = React.useCallback(async () => {
    if (!isAdmin || !mysteryId) return;
    try {
      const res = await ApiClient.get<any>(`/api/mystery/admin.php?action=check_master_assets_maintenance_needed&mystery_id=${mysteryId}`);
      if (res && res.success) {
        setNeedsCleanup(!!res.needs_cleanup);
        setNeedsLinkImport(!!res.needs_link_import);
      }
    } catch (e) {
      console.error('Failed to check maintenance status', e);
    }
  }, [isAdmin, mysteryId, setNeedsCleanup, setNeedsLinkImport]);

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
  }, [isAdmin, mysteryId, loaders, showMysteryToast, setError]);

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
  }, [isAdmin, mysteryId, showMysteryToast, setError]);

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
  }, [isAdmin, mysteryId, loaders, showMysteryToast, setError]);

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
  }, [isAdmin, mysteryId, loaders, showMysteryToast, setError]);

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
  }, [isAdmin, mysteryId, state.pendingMasterDelete, loaders, showMysteryToast, setError, state.setPendingMasterDelete]);

  const generateMasterAssetContent = React.useCallback(async () => {
    if (!isAdmin || !mysteryId || !masterAssetDetailsItem) return;
    if (!caseId) {
      setError('Select a case first to use the job queue.');
      return;
    }
    const t = masterAssetDetailsType;
    const id = masterAssetDetailsItem.id;

    setBusy(true);
    setError('');
    try {
      const res = await ApiClient.post<any>('/api/mystery/play.php?action=enqueue_job', {
        case_id: caseId,
        job_action: 'generate_master_asset_content',
        job_spec: {
          mystery_id: mysteryId,
          type: t,
          id,
          fill_missing_only: true
        }
      });
      if (!res?.success || !res?.id) throw new Error(res?.error || 'Failed to enqueue job');

      const label = `Generating ${t} content`;
      void watchJobToast({
        caseId: Number(caseId),
        jobId: Number(res.id),
        label,
        onDone: async (result: any) => {
          // When job finishes, reload the asset lists
          let newList: any[] = [];
          if (t === 'character') newList = await loaders.loadMasterCharacters();
          else if (t === 'location') newList = await loaders.loadMasterLocations();
          else if (t === 'weapon') newList = await loaders.loadMasterWeapons();
          else if (t === 'motive') newList = await loaders.loadMasterMotives();

          // If the item is still the same one open in details, refresh the details state
          if (masterAssetDetailsItem && Number(masterAssetDetailsItem.id) === Number(id)) {
            const updatedItem = newList.find(item => Number(item.id) === Number(id));
            if (updatedItem) {
              state.openMasterAssetDetails({ type: t, item: updatedItem });
            }
          }
          showMysteryToast({ tone: 'success', message: `Generated ${t} content applied.` });
        }
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to generate content');
    } finally {
      setBusy(false);
    }
  }, [isAdmin, mysteryId, caseId, masterAssetDetailsItem, masterAssetDetailsType, loaders, watchJobToast, showMysteryToast, setError, setBusy]);

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
          rapport_likes: [], rapport_dislikes: [], rapport_quirks: [], rapport_fun_facts: []
        });
        state.setMasterAssetDetailsRapport({ likes: [], dislikes: [], quirks: [], fun_facts: [] });
        state.setMasterAssetDetailsFavorites({ color: '', snack: '', drink: '', music: '', hobby: '', pet: '' });
      } else {
        state.setMasterAssetDetailsFields((prev: any) => ({
          ...prev,
          description: '',
          location_id: '', address_line1: '', address_line2: '', city: '', region: '', postal_code: '', country: '',
          base_image_prompt: '', overlay_asset_prompt: '', overlay_trigger: '',
          fingerprints: []
        }));
      }
      state.setMasterAssetDetailsData({ description: '', items: [], image: null });
      showMysteryToast({ tone: 'success', message: 'Cleared.' });
    } catch (e: any) {
      setError(e?.message || 'Clear failed');
    } finally {
      setBusy(false);
    }
  }, [isAdmin, mysteryId, masterAssetDetailsItem, masterAssetDetailsType, isCharacter, state.setMasterAssetDetailsFields, state.setMasterAssetDetailsRapport, state.setMasterAssetDetailsFavorites, state.setMasterAssetDetailsData, showMysteryToast, setError, setBusy]);
  const requestMasterAssetDelete = React.useCallback(({ type, item }: { type: string; item: any }) => {
    if (!isAdmin) return;
    if (!item.is_archived) {
      setError('Only archived assets can be deleted.');
      return;
    }
    state.setPendingMasterDelete({ type, item });
  }, [isAdmin, setError, state.setPendingMasterDelete]);

  return {
    loadMasterCharacterDeposition,
    generateMasterAssetContent,
    clearMasterAssetFields,
    upsertMasterCharacter,
    archiveMasterAsset,
    confirmMasterAssetDelete,
    upsertMasterLocation,
    upsertMasterWeapon,
    upsertMasterMotive,
    setMasterAssetRegenLock,
    saveMasterAssetDetails,
    requestMasterAssetDelete,
    backfillMasterAssetColumnsFromJson,
    cleanupMasterOnlyFieldsForMystery,
    linkAndImportCaseDetailsForMystery,
    getMasterAssetNameDraft,
    updateMasterAssetNameDraft,
    saveMasterAssetInlineName,
    checkMaintenanceNeeded,
    uploadMasterCharacterImage,
    deleteMasterCharacterImage,
    openMasterCharacterImagePrompt,
    generateMasterCharacterImages,
    generateAllMissingMasterCharacterImages,
    uploadMasterAssetImage,
    generateMasterAssetPrimaryImage,
    deleteMasterAssetPrimaryImage,
    openMasterAssetDerivedJson
  };
}
