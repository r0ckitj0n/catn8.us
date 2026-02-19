import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IMasterCharacter, IMasterLocation, IMasterWeapon, IMasterMotive, IVoiceProfile } from '../../../types/game';
import { IMasterAssetsCore } from '../../../types/mysteryHooks';

export function useMasterAssetsCore(
  mysteryId: string | number,
  caseId: string | number,
  setError: (err: string) => void
): IMasterAssetsCore {
  const [masterCharacters, setMasterCharacters] = useState<IMasterCharacter[]>([]);
  const [masterLocations, setMasterLocations] = useState<IMasterLocation[]>([]);
  const [masterWeapons, setMasterWeapons] = useState<IMasterWeapon[]>([]);
  const [masterMotives, setMasterMotives] = useState<IMasterMotive[]>([]);
  const [voiceProfiles, setVoiceProfiles] = useState<IVoiceProfile[]>([]);

  const [masterAssetsIncludeArchived, setMasterAssetsIncludeArchived] = React.useState(false);
  const [masterAssetNameDrafts, setMasterAssetNameDrafts] = useState<Record<string, string>>({});
  const [pendingMasterDelete, setPendingMasterDelete] = useState<{ type: string; item: any } | null>(null);

  const [newMasterCharacter, setNewMasterCharacter] = React.useState({ name: '' });
  const [newMasterLocation, setNewMasterLocation] = React.useState({ name: '' });
  const [newMasterWeapon, setNewMasterWeapon] = React.useState({ name: '' });
  const [newMasterMotive, setNewMasterMotive] = React.useState({ name: '' });

  const [masterCharacterImageUrl, setMasterCharacterImageUrl] = React.useState('');
  const [masterCharacterMugshotUrl, setMasterCharacterMugshotUrl] = React.useState('');
  const [masterCharacterIrUrls, setMasterCharacterIrUrls] = useState<string[]>([]);
  const [masterCharacterIrIndex, setMasterCharacterIrIndex] = React.useState(0);
  const [masterCharacterIrEmotionEnabled, setMasterCharacterIrEmotionEnabled] = useState<Record<string, boolean>>({});

  const masterCharacterIrEmotions = React.useMemo(() => {
    return ['angry', 'afraid', 'amused', 'anxious', 'defiant', 'exhausted', 'guilty', 'smug', 'suspicious', 'tearful'];
  }, []);

  const [masterAssetJsonOpen, setMasterAssetJsonOpen] = React.useState(false);
  const [masterAssetJsonText, setMasterAssetJsonText] = React.useState('');
  const [masterAssetJsonError, setMasterAssetJsonError] = React.useState('');
  const [masterAssetJsonTitle, setMasterAssetJsonTitle] = React.useState('JSON');

  const [jsonPreviewOpen, setJsonPreviewOpen] = React.useState(false);
  const [jsonPreviewText, setJsonPreviewText] = React.useState('');
  const [jsonPreviewTitle, setJsonPreviewTitle] = React.useState('JSON');

  const openJsonPreview = React.useCallback(({ title, payload }: { title: string; payload: any }) => {
    const t = String(title || 'JSON');
    let text = '';
    try {
      if (typeof payload === 'string') {
        text = payload;
      } else {
        text = JSON.stringify(payload ?? null, null, 2);
      }
    } catch (_err) {
      text = String(payload ?? '');
    }
    setJsonPreviewTitle(t);
    setJsonPreviewText(text);
    setJsonPreviewOpen(true);
  }, []);

  const [masterCharacterDepositionText, setMasterCharacterDepositionText] = React.useState('');
  const [masterCharacterDepositionUpdatedAt, setMasterCharacterDepositionUpdatedAt] = React.useState('');
  const [masterCharacterDepositionError, setMasterCharacterDepositionError] = React.useState('');
  const [masterCharacterDepositionBusy, setMasterCharacterDepositionBusy] = React.useState(false);
  const [needsCleanup, setNeedsCleanup] = React.useState(false);
  const [needsLinkImport, setNeedsLinkImport] = React.useState(false);

  const loadMasterCharacterImages = React.useCallback(async (id: string | number) => {
    const mid = Number(mysteryId);
    const rid = Number(id || 0);
    if (!mid || !rid) {
      setMasterCharacterImageUrl('');
      setMasterCharacterMugshotUrl('');
      setMasterCharacterIrUrls([]);
      setMasterCharacterIrIndex(0);
      return;
    }
    try {
      const res = await ApiClient.get<any>('/api/mystery/admin.php?action=list_master_character_images&mystery_id=' + String(mid) + '&id=' + String(rid));
      if (res && typeof res === 'object' && res.success === true) {
        setMasterCharacterImageUrl(String(res.character_url || ''));
        setMasterCharacterMugshotUrl(String(res.mugshot_url || ''));
        setMasterCharacterIrUrls(Array.isArray(res.ir_urls) ? res.ir_urls.map((x: any) => String(x || '')).filter(Boolean) : []);
        setMasterCharacterIrIndex(0);
        return;
      }
    } catch (_e) {}
    setMasterCharacterImageUrl('');
    setMasterCharacterMugshotUrl('');
    setMasterCharacterIrUrls([]);
    setMasterCharacterIrIndex(0);
  }, [mysteryId]);

  const loadVoiceProfiles = React.useCallback(async (isAdmin: boolean) => {
    if (!isAdmin || !mysteryId) {
      setVoiceProfiles([]);
      return;
    }
    try {
      const res = await ApiClient.get<{ voice_profiles: IVoiceProfile[] }>(`/api/mystery/admin.php?action=list_voice_profiles&mystery_id=${mysteryId}&include_archived=0`);
      setVoiceProfiles(Array.isArray(res?.voice_profiles) ? res.voice_profiles : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load voice profiles');
    }
  }, [mysteryId, setError]);

  const loadMasterCharacters = React.useCallback(async () => {
    if (!mysteryId) return [];
    try {
      const caseIdParam = caseId ? `&case_id=${caseId}` : '';
      const res = await ApiClient.get<{ characters: IMasterCharacter[] }>(`/api/mystery/admin.php?action=list_master_characters&mystery_id=${mysteryId}&include_archived=${masterAssetsIncludeArchived ? 1 : 0}${caseIdParam}`);
      const list = Array.isArray(res?.characters) ? res.characters : [];
      setMasterCharacters(list);
      return list;
    } catch (e: any) {
      setError(e?.message || 'Failed to load master characters');
      return [];
    }
  }, [mysteryId, caseId, masterAssetsIncludeArchived, setError]);

  const loadMasterLocations = React.useCallback(async () => {
    if (!mysteryId) return [];
    try {
      const caseIdParam = caseId ? `&case_id=${caseId}` : '';
      const res = await ApiClient.get<{ locations: IMasterLocation[] }>(`/api/mystery/admin.php?action=list_master_locations&mystery_id=${mysteryId}&include_archived=${masterAssetsIncludeArchived ? 1 : 0}${caseIdParam}`);
      const list = Array.isArray(res?.locations) ? res.locations : [];
      setMasterLocations(list);
      return list;
    } catch (e: any) {
      setError(e?.message || 'Failed to load master locations');
      return [];
    }
  }, [mysteryId, caseId, masterAssetsIncludeArchived, setError]);

  const loadMasterWeapons = React.useCallback(async () => {
    try {
      const caseIdParam = caseId ? `&case_id=${caseId}` : '';
      const res = await ApiClient.get<{ weapons: IMasterWeapon[] }>(`/api/mystery/admin.php?action=list_weapons&include_archived=${masterAssetsIncludeArchived ? 1 : 0}${caseIdParam}`);
      const list = Array.isArray(res?.weapons) ? res.weapons : [];
      setMasterWeapons(list);
      return list;
    } catch (e: any) {
      setError(e?.message || 'Failed to load weapons');
      return [];
    }
  }, [caseId, masterAssetsIncludeArchived, setError]);

  const loadMasterMotives = React.useCallback(async () => {
    try {
      const caseIdParam = caseId ? `&case_id=${caseId}` : '';
      const res = await ApiClient.get<{ motives: IMasterMotive[] }>(`/api/mystery/admin.php?action=list_motives&include_archived=${masterAssetsIncludeArchived ? 1 : 0}${caseIdParam}`);
      const list = Array.isArray(res?.motives) ? res.motives : [];
      setMasterMotives(list);
      return list;
    } catch (e: any) {
      setError(e?.message || 'Failed to load motives');
      return [];
    }
  }, [caseId, masterAssetsIncludeArchived, setError]);

  return {
    masterCharacters, setMasterCharacters,
    masterLocations, setMasterLocations,
    masterWeapons, setMasterWeapons,
    masterMotives, setMasterMotives,
    voiceProfiles, setVoiceProfiles,
    loadVoiceProfiles,
    loadMasterCharacters,
    loadMasterLocations,
    loadMasterWeapons,
    loadMasterMotives,
    masterAssetsIncludeArchived,
    setMasterAssetsIncludeArchived,
    masterAssetNameDrafts, setMasterAssetNameDrafts,
    pendingMasterDelete, setPendingMasterDelete,
    newMasterCharacter, setNewMasterCharacter,
    newMasterLocation, setNewMasterLocation,
    newMasterWeapon, setNewMasterWeapon,
    newMasterMotive, setNewMasterMotive,
    masterCharacterImageUrl, setMasterCharacterImageUrl,
    masterCharacterMugshotUrl, setMasterCharacterMugshotUrl,
    masterCharacterIrUrls, setMasterCharacterIrUrls,
    masterCharacterIrIndex, setMasterCharacterIrIndex,
    masterCharacterIrEmotionEnabled, setMasterCharacterIrEmotionEnabled,
    masterCharacterIrEmotions,
    masterAssetJsonOpen, setMasterAssetJsonOpen,
    masterAssetJsonText, setMasterAssetJsonText,
    masterAssetJsonError, setMasterAssetJsonError,
    masterAssetJsonTitle, setMasterAssetJsonTitle,
    jsonPreviewOpen, setJsonPreviewOpen,
    jsonPreviewText, setJsonPreviewText,
    jsonPreviewTitle, setJsonPreviewTitle,
    openJsonPreview,
    loadMasterCharacterImages,
    masterCharacterDepositionText, setMasterCharacterDepositionText,
    masterCharacterDepositionUpdatedAt, setMasterCharacterDepositionUpdatedAt,
    masterCharacterDepositionError, setMasterCharacterDepositionError,
    masterCharacterDepositionBusy, setMasterCharacterDepositionBusy,
    needsCleanup, setNeedsCleanup,
    needsLinkImport, setNeedsLinkImport
  };
}
