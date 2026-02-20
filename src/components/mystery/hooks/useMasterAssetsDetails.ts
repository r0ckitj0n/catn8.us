import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IMasterCharacter, IMasterLocation, IMasterWeapon, IMasterMotive } from '../../../types/game';
import { IMasterAssetsDetails } from '../../../types/mysteryHooks';
import { buildMasterAssetDetailState } from '../lib/masterAssetDetailsMapper';

type MasterAssetItem = IMasterCharacter | IMasterLocation | IMasterWeapon | IMasterMotive;

export function useMasterAssetsDetails(
  mysteryId: string | number,
  setError: (err: string) => void
): IMasterAssetsDetails {
  const [masterAssetDetailsOpen, setMasterAssetDetailsOpen] = React.useState(false);
  const [masterAssetDetailsItem, setMasterAssetDetailsItem] = useState<MasterAssetItem | null>(null);
  const [masterAssetDetailsType, setMasterAssetDetailsType] = React.useState('');
  const [masterAssetDetailsName, setMasterAssetDetailsName] = React.useState('');
  const [masterAssetDetailsSlug, setMasterAssetDetailsSlug] = React.useState('');
  const [masterAssetDetailsFields, setMasterAssetDetailsFields] = useState<Record<string, any>>({});
  const [masterAssetDetailsLocks, setMasterAssetDetailsLocks] = useState<Record<string, number>>({});
  const [masterAssetDetailsData, setMasterAssetDetailsData] = useState<Record<string, any>>({ description: '', items: [], image: null });
  const [masterAssetDetailsRapport, setMasterAssetDetailsRapport] = useState<any>({ likes: [], dislikes: [], quirks: [], fun_facts: [] });
  const [masterAssetDetailsFavorites, setMasterAssetDetailsFavorites] = useState<any>({ color: '', snack: '', drink: '', music: '', hobby: '', pet: '' });

  const masterAssetDetailsCleanSnapshotRef = React.useRef('');

  const getMasterAssetDataObject = React.useCallback(() => {
    if (masterAssetDetailsType === 'character') return {};
    return masterAssetDetailsData || { description: '', items: [], image: null };
  }, [masterAssetDetailsType, masterAssetDetailsData]);

  const updateMasterAssetDetailsDataObject = React.useCallback((updater: any) => {
    setMasterAssetDetailsData((prev) => {
      const base = (prev && typeof prev === 'object' && !Array.isArray(prev)) ? prev : { description: '', items: [], image: null };
      const next = (typeof updater === 'function') ? updater(base) : updater;
      if (!next || typeof next !== 'object' || Array.isArray(next)) return base;
      return next;
    });
  }, []);

  const masterAssetDetailsDataText = React.useMemo(() => {
    if (masterAssetDetailsType === 'character') return '{}';
    const base = masterAssetDetailsData || { description: '', items: [], image: null };
    return JSON.stringify({
      description: String(base.description || ''),
      items: Array.isArray(base.items) ? base.items : [],
      image: (base.image && typeof base.image === 'object' && !Array.isArray(base.image)) ? base.image : null,
    }, null, 2);
  }, [masterAssetDetailsType, masterAssetDetailsData]);

  const buildMasterAssetDetailsSnapshot = React.useCallback(() => {
    const t = masterAssetDetailsType;
    const id = masterAssetDetailsItem?.id || 0;
    const slug = masterAssetDetailsItem?.slug || '';
    const name = masterAssetDetailsName;
    const fields = masterAssetDetailsFields || {};
    const dataObj = getMasterAssetDataObject();

    if (t === 'character') {
      const rp = masterAssetDetailsRapport || { likes: [], dislikes: [], quirks: [], fun_facts: [] };
      const fav = masterAssetDetailsFavorites || { color: '', snack: '', drink: '', music: '', hobby: '', pet: '' };
      return JSON.stringify({ t, id, slug, name, fields, rapport: rp, favorites: fav });
    }

    return JSON.stringify({ t, id, slug, name, fields, data: dataObj });
  }, [masterAssetDetailsType, masterAssetDetailsItem, masterAssetDetailsName, masterAssetDetailsFields, masterAssetDetailsRapport, masterAssetDetailsFavorites, getMasterAssetDataObject]);

  const isMasterAssetDetailsDirty = React.useMemo(() => {
    const clean = masterAssetDetailsCleanSnapshotRef.current;
    if (!clean) return false;
    return clean !== buildMasterAssetDetailsSnapshot();
  }, [buildMasterAssetDetailsSnapshot]);

  const masterCharacterRapport = React.useMemo(() => {
    if (masterAssetDetailsType !== 'character') return null;
    const rp = masterAssetDetailsRapport || { likes: [], dislikes: [], quirks: [], fun_facts: [] };
    const fav = masterAssetDetailsFavorites || { color: '', snack: '', drink: '', music: '', hobby: '', pet: '' };
    const cleanList = (v: any) => Array.isArray(v) ? v.map((x: any) => String(x || '').trim()).filter(Boolean) : [];
    return {
      likes: cleanList(rp.likes),
      dislikes: cleanList(rp.dislikes),
      quirks: cleanList(rp.quirks),
      fun_facts: cleanList(rp.fun_facts),
      favorites: {
        color: String(fav.color || ''),
        snack: String(fav.snack || ''),
        drink: String(fav.drink || ''),
        music: String(fav.music || ''),
        hobby: String(fav.hobby || ''),
        pet: String(fav.pet || ''),
      },
    };
  }, [masterAssetDetailsFavorites, masterAssetDetailsRapport, masterAssetDetailsType]);

  const masterCharacterMissingRequiredImageFields = React.useMemo(() => {
    if (masterAssetDetailsType !== 'character') return [] as string[];
    const f = masterAssetDetailsFields || {};

    const missing: string[] = [];
    const reqStr = (key: string, label: string) => {
      const v = String(f[key] ?? '').trim();
      if (v === '') missing.push(label);
    };
    const reqAge = (key: string, label: string) => {
      const n = Number(f[key] ?? 0);
      if (!Number.isFinite(n) || n <= 0) missing.push(label);
    };

    reqStr('dob', 'DOB');
    reqAge('age', 'Age');
    reqStr('hometown', 'Hometown');
    reqStr('ethnicity', 'Ethnicity');
    reqStr('mbti', 'MBTI');
    reqStr('height', 'Height');
    reqStr('weight', 'Weight');
    reqStr('eye_color', 'Eye color');
    reqStr('hair_color', 'Hair color');

    return missing;
  }, [masterAssetDetailsFields, masterAssetDetailsType]);

  const getMasterAssetFieldLocks = React.useCallback(() => {
    return (masterAssetDetailsLocks && typeof masterAssetDetailsLocks === 'object' && !Array.isArray(masterAssetDetailsLocks)) ? masterAssetDetailsLocks : {};
  }, [masterAssetDetailsLocks]);

  const loadMasterAssetFieldLocks = React.useCallback(async (type: string, id: string | number) => {
    const mid = Number(mysteryId || 0);
    const rid = Number(id || 0);
    if (!mid || !rid || !type) {
      setMasterAssetDetailsLocks({});
      return;
    }
    try {
      const res = await ApiClient.get<{ success: boolean, locks?: Record<string, number> }>('/api/mystery/admin.php?action=get_master_asset_field_locks&mystery_id=' + String(mid) + '&type=' + encodeURIComponent(type) + '&id=' + String(rid));
      if (res?.success) {
        setMasterAssetDetailsLocks(res.locks || {});
      }
    } catch (_e) {
      setMasterAssetDetailsLocks({});
    }
  }, [mysteryId]);

  const toggleMasterAssetFieldLock = React.useCallback(async (lockKey: string) => {
    if (!lockKey || !masterAssetDetailsType || !masterAssetDetailsItem?.id || !mysteryId) return;

    const curLocks = getMasterAssetFieldLocks();
    const nextLocked = Number(curLocks[lockKey] || 0) ? 0 : 1;

    try {
      await ApiClient.post('/api/mystery/admin.php?action=set_master_asset_field_lock', {
        mystery_id: mysteryId,
        type: masterAssetDetailsType,
        id: masterAssetDetailsItem.id,
        lock_key: lockKey,
        is_locked: nextLocked,
      });
      setMasterAssetDetailsLocks(prev => {
        const next = { ...prev };
        if (nextLocked) next[lockKey] = 1;
        else delete next[lockKey];
        return next;
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to update lock');
    }
  }, [getMasterAssetFieldLocks, masterAssetDetailsType, masterAssetDetailsItem, mysteryId, setError]);

  const isMasterAssetFieldLocked = React.useCallback((lockKey: string) => {
    return Boolean(masterAssetDetailsLocks?.[lockKey]);
  }, [masterAssetDetailsLocks]);

  const openMasterAssetDetails = React.useCallback(async ({ type, item }: { type: string; item: any }) => {
    setMasterAssetDetailsType(type);
    setMasterAssetDetailsItem(item);
    setMasterAssetDetailsName(item.name || '');
    setMasterAssetDetailsSlug(item.slug || '');
    const nextState = buildMasterAssetDetailState(type, item);
    setMasterAssetDetailsFields(nextState.fields);
    if (nextState.rapport) setMasterAssetDetailsRapport(nextState.rapport);
    if (nextState.favorites) setMasterAssetDetailsFavorites(nextState.favorites);
    if (nextState.data) setMasterAssetDetailsData(nextState.data);

    await loadMasterAssetFieldLocks(type, item.id);
    
    window.setTimeout(() => {
      masterAssetDetailsCleanSnapshotRef.current = buildMasterAssetDetailsSnapshot();
    }, 0);
  }, [loadMasterAssetFieldLocks, buildMasterAssetDetailsSnapshot]);

  const resetMasterAssetDetails = React.useCallback(() => {
    if (!masterAssetDetailsItem) return;
    const item = masterAssetDetailsItem;
    const type = masterAssetDetailsType;

    setMasterAssetDetailsName(item.name || '');
    setMasterAssetDetailsSlug(item.slug || '');
    
    const nextState = buildMasterAssetDetailState(type, item);
    setMasterAssetDetailsFields(nextState.fields);
    if (nextState.rapport) setMasterAssetDetailsRapport(nextState.rapport);
    if (nextState.favorites) setMasterAssetDetailsFavorites(nextState.favorites);
    if (nextState.data) setMasterAssetDetailsData(nextState.data);
    
    window.setTimeout(() => {
      masterAssetDetailsCleanSnapshotRef.current = buildMasterAssetDetailsSnapshot();
    }, 0);
  }, [masterAssetDetailsItem, masterAssetDetailsType, buildMasterAssetDetailsSnapshot]);

  return { masterAssetDetailsOpen, setMasterAssetDetailsOpen, masterAssetDetailsItem, setMasterAssetDetailsItem, masterAssetDetailsType, setMasterAssetDetailsType, masterAssetDetailsName, setMasterAssetDetailsName, masterAssetDetailsSlug, setMasterAssetDetailsSlug, masterAssetDetailsFields, setMasterAssetDetailsFields, masterAssetDetailsLocks, setMasterAssetDetailsLocks, masterAssetDetailsData, setMasterAssetDetailsData, masterAssetDetailsRapport, setMasterAssetDetailsRapport, masterAssetDetailsFavorites, setMasterAssetDetailsFavorites, masterAssetDetailsDataText, getMasterAssetFieldLocks, loadMasterAssetFieldLocks, toggleMasterAssetFieldLock, isMasterAssetFieldLocked, openMasterAssetDetails, updateMasterAssetDetailsDataObject, getMasterAssetDataObject, isMasterAssetDetailsDirty, masterAssetDetailsCleanSnapshotRef, masterCharacterRapport, masterCharacterMissingRequiredImageFields, resetMasterAssetDetails, buildMasterAssetDetailsSnapshot };
}
