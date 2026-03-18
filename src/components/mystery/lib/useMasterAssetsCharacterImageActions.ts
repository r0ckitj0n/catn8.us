import React from 'react';

import { ApiClient } from '../../../core/ApiClient';
import { MasterAssetsActionParams } from './masterAssetsActionTypes';

export function useMasterAssetsCharacterImageActions({
  isAdmin,
  loaders,
  mysteryId,
  setError,
  showMysteryToast,
  state,
}: MasterAssetsActionParams) {
  const masterAssetDetailsItem = state.masterAssetDetailsItem;

  const uploadMasterCharacterImage = React.useCallback(async ({ kind, file }: { kind: 'character' | 'mugshot' | 'ir'; file: File }) => {
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
  }, [loaders, masterAssetDetailsItem, mysteryId, setError, showMysteryToast]);

  const deleteMasterCharacterImage = React.useCallback(async ({ kind, url }: { kind: 'character' | 'mugshot' | 'ir'; url?: string }) => {
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
  }, [isAdmin, loaders, masterAssetDetailsItem, mysteryId, setError, showMysteryToast]);

  const openMasterCharacterImagePrompt = React.useCallback(async ({ kind }: { kind: 'character' | 'mugshot' | 'ir' }) => {
    if (!isAdmin || !mysteryId || !masterAssetDetailsItem?.id) return;

    state.setMasterAssetJsonError('');
    state.setMasterAssetJsonText('');
    state.setMasterAssetJsonTitle(kind === 'character' ? 'Character Prompt' : (kind === 'mugshot' ? 'Mugshot Prompt' : 'Interrogation Room Prompt'));
    try {
      const res = await ApiClient.get<any>(`/api/mystery/admin.php?action=get_master_character_image_prompt_json&mystery_id=${mysteryId}&id=${masterAssetDetailsItem.id}`);
      if (!res?.success) throw new Error(res?.error || 'Failed to load prompt JSON');
      const pj = res.prompt_json ?? {};
      const block = kind === 'character' ? pj?.character : (kind === 'mugshot' ? pj?.mugshot : pj?.interrogation_room);
      const text = (String(block?.style_instruction || '').trim() !== '' ? (`STYLE INSTRUCTION\n${block.style_instruction}\n\n`) : '') + 'PROMPT\n' + (block?.prompt || '');
      state.setMasterAssetJsonText(text);
      state.setMasterAssetJsonOpen(true);
    } catch (e: any) {
      state.setMasterAssetJsonError(e?.message || 'Failed to load prompt JSON');
      state.setMasterAssetJsonOpen(true);
    }
  }, [isAdmin, masterAssetDetailsItem, mysteryId, state]);

  const generateMasterCharacterImages = React.useCallback(async ({ kind }: { kind: 'character' | 'mugshot' | 'ir' }) => {
    if (!isAdmin || !mysteryId || !masterAssetDetailsItem?.id) return;

    if (kind === 'ir') {
      const selected = state.masterCharacterIrEmotions.filter((emotion) => state.masterCharacterIrEmotionEnabled[emotion] !== false);
      const existing = new Set<string>();
      state.masterCharacterIrUrls.forEach((url) => {
        const match = url.match(/_ir_([a-z0-9_-]+)\.(png|jpe?g|webp)(?:\?.*)?$/i);
        if (match && match[1]) existing.add(match[1].toLowerCase());
      });
      const missing = selected.filter((emotion) => !existing.has(emotion));
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
  }, [isAdmin, loaders, masterAssetDetailsItem, mysteryId, setError, showMysteryToast, state.masterCharacterIrEmotionEnabled, state.masterCharacterIrEmotions, state.masterCharacterIrUrls]);

  const generateAllMissingMasterCharacterImages = React.useCallback(async () => {
    if (!isAdmin || !mysteryId || !masterAssetDetailsItem?.id) return;

    try {
      await ApiClient.post<any>('/api/mystery/admin.php?action=generate_master_character_images', { mystery_id: mysteryId, id: masterAssetDetailsItem.id, kind: 'character' });
      await ApiClient.post<any>('/api/mystery/admin.php?action=generate_master_character_images', { mystery_id: mysteryId, id: masterAssetDetailsItem.id, kind: 'mugshot' });
      const selected = state.masterCharacterIrEmotions.filter((emotion) => state.masterCharacterIrEmotionEnabled[emotion] !== false);
      const existing = new Set<string>();
      state.masterCharacterIrUrls.forEach((url) => {
        const match = url.match(/_ir_([a-z0-9_-]+)\.(png|jpe?g|webp)(?:\?.*)?$/i);
        if (match && match[1]) existing.add(match[1].toLowerCase());
      });
      const missing = selected.filter((emotion) => !existing.has(emotion));
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
  }, [isAdmin, loaders, masterAssetDetailsItem, mysteryId, setError, showMysteryToast, state.masterCharacterIrEmotionEnabled, state.masterCharacterIrEmotions, state.masterCharacterIrUrls]);

  return {
    deleteMasterCharacterImage,
    generateAllMissingMasterCharacterImages,
    generateMasterCharacterImages,
    openMasterCharacterImagePrompt,
    uploadMasterCharacterImage,
  };
}
