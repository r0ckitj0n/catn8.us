import React from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IJob, IMysterySettings } from '../../../types/game';
import { IMysteryStateDarkroom } from '../../../types/mysteryHooks';

export function useMysteryStateDarkroom(
  isAdmin: boolean,
  mysteryId: string | number,
  caseId: string | number,
  scenarioId: string | number,
  setBusy: (busy: boolean) => void,
  setError: (err: string) => void,
  showMysteryToast: (t: any) => void,
  loadJobs: (cid: string | number) => Promise<void>,
  getImageStyleSettings: () => { master: string; location: string; weapon: string; mugshot: string },
  mysterySettingsObj: IMysterySettings,
  setMysterySettingsObj: (s: IMysterySettings) => void,
  setMysterySettingsDraft: (s: string) => void,
  setMysterySettingsUpdatedAt: (s: string) => void,
  openJsonPreview: (opts: { title: string; payload: any }) => void
): IMysteryStateDarkroom {
  const [jobAction, setJobAction] = React.useState('regenerate');
  const [jobSpecText, setJobSpecText] = React.useState('{}');
  const [jobScopeCharacter, setJobScopeCharacter] = React.useState(true);
  const [jobScopeLocation, setJobScopeLocation] = React.useState(true);
  const [jobScopeWeapon, setJobScopeWeapon] = React.useState(true);
  const [jobScopeMotive, setJobScopeMotive] = React.useState(true);

  const [imageStyleMasterDraft, setImageStyleMasterDraft] = React.useState('');
  const [locationImageStyleDraft, setLocationImageStyleDraft] = React.useState('');
  const [mugshotImageStyleDraft, setMugshotImageStyleDraft] = React.useState('');
  const [weaponImageStyleDraft, setWeaponImageStyleDraft] = React.useState('');

  // Sync drafts when settings are loaded or changed
  React.useEffect(() => {
    const st = getImageStyleSettings();
    setImageStyleMasterDraft(st.master || '');
    setLocationImageStyleDraft(st.location || '');
    setMugshotImageStyleDraft(st.mugshot || '');
    setWeaponImageStyleDraft(st.weapon || '');
  }, [getImageStyleSettings, mysterySettingsObj]);

  const enqueueJob = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const cid = Number(caseId);
    if (!cid) return;
    setBusy(true);
    setError('');
    try {
      const spec = JSON.parse(String(jobSpecText || '{}'));
      if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
        throw new Error('Spec JSON must be an object');
      }
      spec.image_styles = getImageStyleSettings();
      spec.scope = {
        character: jobScopeCharacter ? 1 : 0,
        location: jobScopeLocation ? 1 : 0,
        weapon: jobScopeWeapon ? 1 : 0,
        motive: jobScopeMotive ? 1 : 0,
      };
      await ApiClient.post('/api/mystery/admin.php?action=enqueue_job', {
        case_id: cid,
        scenario_id: Number(scenarioId) || 0,
        action: String(jobAction || '').trim() || 'regenerate',
        spec,
      });
      await loadJobs(cid);
      showMysteryToast({ tone: 'success', message: 'Job queued.' });
    } catch (err: any) {
      setError(err?.message || 'Failed to enqueue job (invalid JSON?)');
    } finally {
      setBusy(false);
    }
  }, [caseId, jobSpecText, getImageStyleSettings, jobScopeCharacter, jobScopeLocation, jobScopeWeapon, jobScopeMotive, scenarioId, jobAction, loadJobs, setBusy, setError, showMysteryToast]);

  const previewEnqueueJobJson = React.useCallback(() => {
    const cid = Number(caseId);
    if (!cid) return;
    try {
      const spec = JSON.parse(String(jobSpecText || '{}'));
      if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
        throw new Error('Spec JSON must be an object');
      }
      spec.image_styles = getImageStyleSettings();
      spec.scope = {
        character: jobScopeCharacter ? 1 : 0,
        location: jobScopeLocation ? 1 : 0,
        weapon: jobScopeWeapon ? 1 : 0,
        motive: jobScopeMotive ? 1 : 0,
      };
      openJsonPreview({
        title: 'enqueue_job: ' + String(jobAction || 'regenerate'),
        payload: {
          endpoint: '/api/mystery/admin.php?action=enqueue_job',
          method: 'POST',
          body: {
            case_id: cid,
            scenario_id: Number(scenarioId) || 0,
            action: String(jobAction || '').trim() || 'regenerate',
            spec,
          },
        },
      });
    } catch (err: any) {
      openJsonPreview({
        title: 'enqueue_job: invalid spec_json',
        payload: {
          error: String(err?.message || 'Invalid JSON'),
          spec_text: String(jobSpecText || ''),
        },
      });
    }
  }, [caseId, jobSpecText, getImageStyleSettings, jobScopeCharacter, jobScopeLocation, jobScopeWeapon, jobScopeMotive, jobAction, scenarioId, openJsonPreview]);

  const clearQueuedJobs = React.useCallback(async () => {
    const cid = Number(caseId);
    if (!cid) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=clear_queued_jobs', { case_id: cid });
      await loadJobs(cid);
      showMysteryToast({ tone: 'success', message: 'Queued jobs cleared.' });
    } catch (err: any) {
      setError(err?.message || 'Failed to clear queued jobs');
    } finally {
      setBusy(false);
    }
  }, [caseId, loadJobs, setBusy, setError, showMysteryToast]);

  const clearCompletedJobs = React.useCallback(async () => {
    const cid = Number(caseId);
    if (!cid) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=clear_completed_jobs', { case_id: cid });
      await loadJobs(cid);
      showMysteryToast({ tone: 'success', message: 'Completed jobs cleared.' });
    } catch (err: any) {
      setError(err?.message || 'Failed to clear completed jobs');
    } finally {
      setBusy(false);
    }
  }, [caseId, loadJobs, setBusy, setError, showMysteryToast]);

  const deleteQueuedJob = React.useCallback(async (jobId: number | string) => {
    const cid = Number(caseId);
    const jid = Number(jobId);
    if (!cid || !jid) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=delete_queued_job', {
        case_id: cid,
        id: jid,
      });
      await loadJobs(cid);
      showMysteryToast({ tone: 'success', message: 'Job deleted.' });
    } catch (err: any) {
      setError(err?.message || 'Failed to delete queued job');
    } finally {
      setBusy(false);
    }
  }, [caseId, loadJobs, setBusy, setError, showMysteryToast]);

  const saveImageStyleSetting = React.useCallback(async ({ key, value }: { key: string; value: string }) => {
    if (!isAdmin) return;
    const mid = Number(mysteryId);
    if (!mid) return;
    
    const base = JSON.parse(JSON.stringify(mysterySettingsObj));
    if (!base.image_styles || typeof base.image_styles !== 'object' || Array.isArray(base.image_styles)) {
      base.image_styles = {};
    }
    base.image_styles[key] = String(value || '');

    setMysterySettingsObj(base);
    setMysterySettingsDraft(JSON.stringify(base, null, 2));

    try {
      const res = await ApiClient.post<any>('/api/mystery/admin.php?action=update_mystery_settings', {
        mystery_id: mid,
        settings: base,
      });
      if (res?.updated_at) setMysterySettingsUpdatedAt(res.updated_at);
      showMysteryToast({ tone: 'success', message: `Image style '${key}' saved.` });
    } catch (e: any) {
      setError(e?.message || 'Failed to save image styles');
    }
  }, [isAdmin, mysteryId, mysterySettingsObj, setMysterySettingsObj, setMysterySettingsDraft, setMysterySettingsUpdatedAt, showMysteryToast, setError]);

  return {
    jobAction, setJobAction,
    jobSpecText, setJobSpecText,
    jobScopeCharacter, setJobScopeCharacter,
    jobScopeLocation, setJobScopeLocation,
    jobScopeWeapon, setJobScopeWeapon,
    jobScopeMotive, setJobScopeMotive,
    imageStyleMasterDraft, setImageStyleMasterDraft,
    locationImageStyleDraft, setLocationImageStyleDraft,
    mugshotImageStyleDraft, setMugshotImageStyleDraft,
    weaponImageStyleDraft, setWeaponImageStyleDraft,
    enqueueJob,
    previewEnqueueJobJson,
    clearQueuedJobs,
    clearCompletedJobs,
    deleteQueuedJob,
    saveImageStyleSetting
  };
}
