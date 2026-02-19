import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IToast } from '../../../types/common';
import { IMasterMotive } from '../../../types/game';
import { useMotivesDraft } from './useMotivesDraft';

/**
 * useMotivesManager - Refactored Hook
 * COMPLIANCE: File size < 250 lines
 */
export function useMotivesManager(
  isAdmin: boolean,
  mysteryId: string | number,
  caseId: string | number,
  showMysteryToast: (t: Partial<IToast>) => void
) {
  const [motivesBusy, setMotivesBusy] = React.useState(false);
  const [motivesError, setMotivesError] = React.useState('');
  const [motivesIncludeArchived, setMotivesIncludeArchived] = React.useState(false);
  const [motives, setMotives] = useState<IMasterMotive[]>([]);
  const [motiveSelectedId, setMotiveSelectedId] = React.useState('');
  const [motiveSelectedIsLocked, setMotiveSelectedIsLocked] = React.useState(false);
  const [motiveBaseline, setMotiveBaseline] = useState<Partial<IMasterMotive>>({ id: 0, slug: '', name: '', description: '', is_archived: 0 });

  const draft = useMotivesDraft();

  const loadMotives = React.useCallback(async () => {
    setMotivesBusy(true);
    setMotivesError('');
    try {
      const caseIdParam = !isAdmin && caseId ? `&case_id=${caseId}` : '';
      const res = await ApiClient.get<{ success: boolean, motives?: IMasterMotive[] }>(`/api/mystery/admin.php?action=list_motives&include_archived=${motivesIncludeArchived ? 1 : 0}${caseIdParam}`);
      if (res?.success) {
        const items = Array.isArray(res?.motives) ? res.motives : [];
        setMotives(items);
        if (motiveSelectedId) {
          const found = items.find((x) => String(x?.id || '') === motiveSelectedId);
          setMotiveSelectedIsLocked(Boolean(found && Number(found?.is_locked || 0) === 1));
        }
      }
    } catch (e: any) {
      setMotivesError(e?.message || 'Failed to load motives');
    } finally {
      setMotivesBusy(false);
    }
  }, [motiveSelectedId, motivesIncludeArchived]);

  const selectMotiveById = React.useCallback((id: string, list: IMasterMotive[]) => {
    const sid = String(id || '');
    setMotiveSelectedId(sid);
    const found = (Array.isArray(list) ? list : []).find((x) => String(x?.id || '') === sid);
    if (!found) {
      setMotiveSelectedIsLocked(false);
      draft.resetDraft();
      setMotiveBaseline({ id: 0, slug: '', name: '', description: '', is_archived: 0 });
      return;
    }
    setMotiveSelectedIsLocked(Boolean(Number(found?.is_locked || 0) === 1));
    draft.setDraftFromMotive(found);
    setMotiveBaseline({
      id: Number(found?.id || 0),
      slug: String(found?.slug || ''),
      name: String(found?.name || ''),
      description: String(found?.description || ''),
      is_archived: Number(found?.is_archived || 0) === 1 ? 1 : 0,
    });
  }, [draft]);

  const saveMotive = React.useCallback(async () => {
    if (!isAdmin || motiveSelectedIsLocked) return;
    setMotivesBusy(true);
    try {
      const idNum = motiveSelectedId ? Number(motiveSelectedId) : 0;
      const res = await ApiClient.post<{ id?: string | number, image?: any }>('/api/mystery/admin.php?action=save_motive', {
        id: idNum > 0 ? idNum : 0,
        slug: draft.motiveSlugDraft,
        name: draft.motiveNameDraft,
        description: draft.motiveDescriptionDraft,
        is_archived: draft.motiveIsArchivedDraft ? 1 : 0,
      });
      const newId = String(res?.id || '');
      if (res?.image) draft.setMotiveImageDraft(res.image);
      await loadMotives();
      if (newId) {
        const refreshed = await ApiClient.get<{ motives: IMasterMotive[] }>(`/api/mystery/admin.php?action=list_motives&include_archived=${motivesIncludeArchived ? 1 : 0}`);
        const items = Array.isArray(refreshed?.motives) ? refreshed.motives : [];
        setMotives(items);
        selectMotiveById(newId, items);
      }
    } catch (e: any) {
      setMotivesError(e?.message || 'Failed to save motive');
    } finally {
      setMotivesBusy(false);
    }
  }, [isAdmin, motiveSelectedIsLocked, motiveSelectedId, draft, loadMotives, motivesIncludeArchived, selectMotiveById]);

  const generateMotive = React.useCallback(async (fillMissingOnly: boolean) => {
    if (!isAdmin || motiveSelectedIsLocked) return;
    setMotivesBusy(true);
    try {
      const idNum = motiveSelectedId ? Number(motiveSelectedId) : 0;
      const res = await ApiClient.post<{ motive?: IMasterMotive }>('/api/mystery/admin.php?action=generate_motive', {
        id: idNum > 0 ? idNum : 0,
        fill_missing_only: fillMissingOnly ? 1 : 0,
        with_image: 1,
        name: draft.motiveNameDraft,
        description: draft.motiveDescriptionDraft,
      });
      const m = res?.motive;
      if (m) {
        setMotiveSelectedId(String(m.id || ''));
        draft.setDraftFromMotive(m);
        setMotiveSelectedIsLocked(Boolean(Number(m.is_locked || 0) === 1));
      }
      await loadMotives();
    } catch (e: any) {
      setMotivesError(e?.message || 'Failed to generate motive');
    } finally {
      setMotivesBusy(false);
    }
  }, [isAdmin, motiveSelectedIsLocked, motiveSelectedId, draft, loadMotives]);

  React.useEffect(() => { loadMotives(); }, [loadMotives]);

  React.useEffect(() => {
    if (motivesError) {
      showMysteryToast({ tone: 'error', message: String(motivesError) });
      setMotivesError('');
    }
  }, [motivesError, showMysteryToast]);

  const motiveIsDirty = React.useMemo(() => {
    const base = motiveBaseline || {};
    const norm = (v: any) => String(v ?? '');
    const normBool = (v: any) => (Boolean(v) ? 1 : 0);
    return (
      norm(base.slug) !== norm(draft.motiveSlugDraft) ||
      norm(base.name) !== norm(draft.motiveNameDraft) ||
      norm(base.description) !== norm(draft.motiveDescriptionDraft) ||
      normBool(base.is_archived) !== normBool(draft.motiveIsArchivedDraft)
    );
  }, [motiveBaseline, draft]);

  const canGenerateMotiveDetails = React.useMemo(() => {
    return Boolean(draft.motiveNameDraft.trim());
  }, [draft.motiveNameDraft]);

  const deleteMotiveAction = React.useCallback(async () => {
    if (!isAdmin || !motiveSelectedId || motiveSelectedIsLocked) return;
    setMotivesBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=delete_motive', { id: Number(motiveSelectedId) });
      showMysteryToast({ tone: 'success', message: 'Motive deleted.' });
      setMotiveSelectedId('');
      draft.resetDraft();
      await loadMotives();
    } catch (e: any) {
      setMotivesError(e?.message || 'Failed to delete motive');
    } finally {
      setMotivesBusy(false);
    }
  }, [isAdmin, motiveSelectedId, motiveSelectedIsLocked, draft, loadMotives, showMysteryToast]);

  const importMasterMotivesToGlobal = React.useCallback(async () => {
    if (!isAdmin || !mysteryId) return;
    setMotivesBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=import_master_motives_to_global', { mystery_id: mysteryId });
      showMysteryToast({ tone: 'success', message: 'Motives imported.' });
      await loadMotives();
    } catch (e: any) {
      setMotivesError(e?.message || 'Failed to import motives');
    } finally {
      setMotivesBusy(false);
    }
  }, [isAdmin, mysteryId, loadMotives, showMysteryToast]);

  return {
    motivesBusy, motivesIncludeArchived, setMotivesIncludeArchived,
    motives, motiveSelectedId, setMotiveSelectedId, motiveSelectedIsLocked,
    ...draft, loadMotives, selectMotiveById, saveMotive, generateMotive,
    motiveIsDirty, canGenerateMotiveDetails, deleteMotiveAction, importMasterMotivesToGlobal
  };
}
