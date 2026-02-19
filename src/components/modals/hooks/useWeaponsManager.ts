import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IToast } from '../../../types/common';
import { useWeaponsDraft } from './useWeaponsDraft';

/**
 * useWeaponsManager - Refactored Hook
 * COMPLIANCE: File size < 250 lines
 */
export function useWeaponsManager(
  isAdmin: boolean,
  mysteryId: string | number,
  caseId: string | number,
  showMysteryToast: (t: Partial<IToast>) => void
) {
  const [weaponsBusy, setWeaponsBusy] = React.useState(false);
  const [weaponsError, setWeaponsError] = React.useState('');
  const [weaponsIncludeArchived, setWeaponsIncludeArchived] = React.useState(false);
  const [weapons, setWeapons] = useState<any[]>([]);
  const [weaponSelectedId, setWeaponSelectedId] = React.useState('');
  const [weaponSelectedIsLocked, setWeaponSelectedIsLocked] = React.useState(false);
  const [weaponBaseline, setWeaponBaseline] = useState<any>({ id: '', slug: '', name: '', description: '', is_archived: 0 });

  const draft = useWeaponsDraft();

  const loadWeapons = React.useCallback(async () => {
    setWeaponsBusy(true);
    setWeaponsError('');
    try {
      const caseIdParam = !isAdmin && caseId ? `&case_id=${caseId}` : '';
      const res = await ApiClient.get(`/api/mystery/admin.php?action=list_weapons&include_archived=${weaponsIncludeArchived ? 1 : 0}${caseIdParam}`);
      if (res?.success) {
        const items = Array.isArray(res?.weapons) ? res.weapons : [];
        setWeapons(items);
        if (weaponSelectedId) {
          const found = items.find((x: any) => String(x?.id || '') === weaponSelectedId);
          setWeaponSelectedIsLocked(Boolean(found && Number(found?.is_locked || 0) === 1));
        }
      }
    } catch (e: any) {
      setWeaponsError(e?.message || 'Failed to load weapons');
    } finally {
      setWeaponsBusy(false);
    }
  }, [weaponSelectedId, weaponsIncludeArchived]);

  const selectWeaponById = React.useCallback((id: string, list: any[]) => {
    const sid = String(id || '');
    setWeaponSelectedId(sid);
    const found = (Array.isArray(list) ? list : []).find((x: any) => String(x?.id || '') === sid);
    if (!found) {
      setWeaponSelectedIsLocked(false);
      draft.resetDraft();
      setWeaponBaseline({ id: '', slug: '', name: '', description: '', is_archived: 0 });
      return;
    }
    setWeaponSelectedIsLocked(Boolean(Number(found?.is_locked || 0) === 1));
    draft.setDraftFromWeapon(found);
    setWeaponBaseline({
      id: String(found?.id || ''),
      slug: String(found?.slug || ''),
      name: String(found?.name || ''),
      description: String(found?.description || ''),
      is_archived: Number(found?.is_archived || 0) === 1 ? 1 : 0,
    });
  }, [draft]);

  const saveWeapon = React.useCallback(async () => {
    if (!isAdmin || weaponSelectedIsLocked) return;
    setWeaponsBusy(true);
    try {
      const idNum = weaponSelectedId ? Number(weaponSelectedId) : 0;
      const res = await ApiClient.post('/api/mystery/admin.php?action=save_weapon', {
        id: idNum > 0 ? idNum : 0,
        slug: draft.weaponSlugDraft,
        name: draft.weaponNameDraft,
        description: draft.weaponDescriptionDraft,
        is_archived: draft.weaponIsArchivedDraft ? 1 : 0,
      });
      const newId = String(res?.id || '');
      if (res?.image) draft.setWeaponImageDraft(res.image);
      await loadWeapons();
      if (newId) {
        const refreshed = await ApiClient.get(`/api/mystery/admin.php?action=list_weapons&include_archived=${weaponsIncludeArchived ? 1 : 0}`);
        const items = Array.isArray(refreshed?.weapons) ? refreshed.weapons : [];
        setWeapons(items);
        selectWeaponById(newId, items);
      }
    } catch (e: any) {
      setWeaponsError(e?.message || 'Failed to save weapon');
    } finally {
      setWeaponsBusy(false);
    }
  }, [isAdmin, weaponSelectedIsLocked, weaponSelectedId, draft, loadWeapons, weaponsIncludeArchived, selectWeaponById]);

  const generateWeapon = React.useCallback(async (fillMissingOnly: boolean) => {
    if (!isAdmin || weaponSelectedIsLocked) return;
    setWeaponsBusy(true);
    try {
      const idNum = weaponSelectedId ? Number(weaponSelectedId) : 0;
      const res = await ApiClient.post('/api/mystery/admin.php?action=generate_weapon', {
        id: idNum > 0 ? idNum : 0,
        fill_missing_only: fillMissingOnly ? 1 : 0,
        with_image: 1,
        name: draft.weaponNameDraft,
        description: draft.weaponDescriptionDraft,
      });
      const w = res?.weapon;
      if (w) {
        setWeaponSelectedId(String(w.id || ''));
        draft.setDraftFromWeapon(w);
        setWeaponSelectedIsLocked(Boolean(Number(w.is_locked || 0) === 1));
      }
      await loadWeapons();
    } catch (e: any) {
      setWeaponsError(e?.message || 'Failed to generate weapon');
    } finally {
      setWeaponsBusy(false);
    }
  }, [isAdmin, weaponSelectedIsLocked, weaponSelectedId, draft, loadWeapons]);

  React.useEffect(() => { loadWeapons(); }, [loadWeapons]);

  React.useEffect(() => {
    if (weaponsError) {
      showMysteryToast({ tone: 'error', message: String(weaponsError) });
      setWeaponsError('');
    }
  }, [weaponsError, showMysteryToast]);

  const weaponIsDirty = React.useMemo(() => {
    const base = weaponBaseline || {};
    const norm = (v: any) => String(v ?? '');
    const normBool = (v: any) => (Boolean(v) ? 1 : 0);
    return (
      norm(base.slug) !== norm(draft.weaponSlugDraft) ||
      norm(base.name) !== norm(draft.weaponNameDraft) ||
      norm(base.description) !== norm(draft.weaponDescriptionDraft) ||
      normBool(base.is_archived) !== normBool(draft.weaponIsArchivedDraft)
    );
  }, [weaponBaseline, draft]);

  const canGenerateWeaponDetails = React.useMemo(() => {
    return Boolean(draft.weaponNameDraft.trim());
  }, [draft.weaponNameDraft]);

  const deleteWeaponAction = React.useCallback(async () => {
    if (!isAdmin || !weaponSelectedId || weaponSelectedIsLocked) return;
    setWeaponsBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=delete_weapon', { id: Number(weaponSelectedId) });
      showMysteryToast({ tone: 'success', message: 'Weapon deleted.' });
      setWeaponSelectedId('');
      draft.resetDraft();
      await loadWeapons();
    } catch (e: any) {
      setWeaponsError(e?.message || 'Failed to delete weapon');
    } finally {
      setWeaponsBusy(false);
    }
  }, [isAdmin, weaponSelectedId, weaponSelectedIsLocked, draft, loadWeapons, showMysteryToast]);

  const uploadWeaponImage = React.useCallback(async (file: File) => {
    if (!isAdmin || !weaponSelectedId || weaponSelectedIsLocked) return;
    setWeaponsBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('id', weaponSelectedId);
      formData.append('type', 'weapon');
      
      const res = await ApiClient.post<{ image?: any }>('/api/mystery/admin.php?action=upload_weapon_image', formData);
      if (res?.image) {
        draft.setWeaponImageDraft(res.image);
        showMysteryToast({ tone: 'success', message: 'Image uploaded.' });
      }
    } catch (e: any) {
      setWeaponsError(e?.message || 'Upload failed');
    } finally {
      setWeaponsBusy(false);
    }
  }, [isAdmin, weaponSelectedId, weaponSelectedIsLocked, draft, showMysteryToast]);

  const deleteWeaponImage = React.useCallback(async () => {
    if (!isAdmin || !weaponSelectedId || weaponSelectedIsLocked) return;
    setWeaponsBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=delete_weapon_image', { id: Number(weaponSelectedId) });
      draft.setWeaponImageDraft({ title: '', url: '', alt_text: '', prompt_text: '', negative_prompt_text: '', provider: '', model: '' });
      showMysteryToast({ tone: 'success', message: 'Image removed.' });
    } catch (e: any) {
      setWeaponsError(e?.message || 'Failed to remove image');
    } finally {
      setWeaponsBusy(false);
    }
  }, [isAdmin, weaponSelectedId, weaponSelectedIsLocked, draft, showMysteryToast]);

  const importMasterWeaponsToGlobal = React.useCallback(async () => {
    if (!isAdmin || !mysteryId) return;
    setWeaponsBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=import_master_weapons_to_global', { mystery_id: mysteryId });
      showMysteryToast({ tone: 'success', message: 'Weapons imported.' });
      await loadWeapons();
    } catch (e: any) {
      setWeaponsError(e?.message || 'Failed to import weapons');
    } finally {
      setWeaponsBusy(false);
    }
  }, [isAdmin, mysteryId, loadWeapons, showMysteryToast]);

  return {
    weaponsBusy, weaponsIncludeArchived, setWeaponsIncludeArchived,
    weapons, weaponSelectedId, setWeaponSelectedId, weaponSelectedIsLocked,
    ...draft, loadWeapons, selectWeaponById, saveWeapon, generateWeapon,
    weaponIsDirty, canGenerateWeaponDetails, deleteWeaponAction,
    uploadWeaponImage, deleteWeaponImage, importMasterWeaponsToGlobal
  };
}
