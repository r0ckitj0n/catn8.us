import React from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IMysteryStateActions } from '../../../types/mysteryHooks';
import { IMysteryStateActionsProps } from '../../../types/mysteryStateActions';

export function useMysteryStateActions({
  setBusy, setError, showMysteryToast, scenarioId, caseId, mysteryId, backstoryId, backstoryTitleDraft, backstorySlugDraft, backstoryTextDraft, backstoryLocationMasterIdDraft, backstoryMetaDraft, backstoryFullTextDraft, loadEvidence, loadJobs, loadCases, loadMysteries, loadBackstories, loadBackstoryDetails, loadCaseMgmtBriefingForScenarioId, loadScenarios, loadScenarioEntities, loadScenario, watchJobToast
}: IMysteryStateActionsProps): IMysteryStateActions {
  const generateCsiReport = React.useCallback(async (sid?: string | number) => {
    const targetSid = sid || scenarioId;
    if (!targetSid) return;
    setBusy(true);
    try {
      const res = await ApiClient.post<any>('/api/mystery/admin.php?action=generate_scenario_csi_report', {
        scenario_id: targetSid
      });
      if (res?.success) {
        showMysteryToast({ tone: 'success', message: 'CSI Report generated and clues woven in.' });
        await loadScenario(targetSid);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to generate CSI report');
    } finally {
      setBusy(false);
    }
  }, [scenarioId, loadScenario, setBusy, setError, showMysteryToast]);

  const addEvidenceNote = React.useCallback(async (evidenceId: number, noteText: string) => {
    if (!evidenceId || !noteText.trim()) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/mystery/play.php?action=add_evidence_note', {
        evidence_id: evidenceId,
        note_text: noteText,
        author_role: 'detective'
      });
      showMysteryToast({ tone: 'success', message: 'Note added to evidence.' });
      if (scenarioId) await loadEvidence(scenarioId);
    } catch (e: any) {
      setError(e?.message || 'Failed to add note');
    } finally {
      setBusy(false);
    }
  }, [scenarioId, loadEvidence, setBusy, setError, showMysteryToast]);

  const enqueueSpecificJob = React.useCallback(async ({ action, spec, requireScenario, entityId }: { action: string, spec: any, requireScenario: boolean, entityId?: any }) => {
    const sid = Number(scenarioId);
    const cid = Number(caseId);
    if (requireScenario && !sid) {
      setError('Select a scenario first.');
      return;
    }
    if (!cid) {
      setError('Select a case first.');
      return;
    }
    setBusy(true);
    try {
      const res = await ApiClient.post<any>('/api/mystery/play.php?action=enqueue_job', {
        case_id: cid,
        scenario_id: sid || 0,
        entity_id: entityId || null,
        job_action: action,
        job_spec: spec
      });
      
      if (res?.id) {
        void watchJobToast({
          caseId: cid,
          jobId: res.id,
          label: action.replace('generate_', '').replace(/_/g, ' '),
          onDone: async () => {
            if (action === 'generate_evidence' && sid) {
              await loadEvidence(sid);
            } else if (action === 'generate_deposition' && sid) {
              await loadScenarioEntities(sid);
            }
            await loadJobs(cid);
          }
        });
        await loadJobs(cid);
      }
      return res;
    } catch (e: any) {
      console.error('useMysteryState: Failed to enqueue job:', e);
      setError(e?.message || 'Failed to enqueue job');
    } finally {
      setBusy(false);
    }
  }, [caseId, scenarioId, loadJobs, setBusy, setError, showMysteryToast, watchJobToast, loadEvidence, loadScenarioEntities]);

  const saveCaseSetup = React.useCallback(async (params: any) => {
    const sid = Number(scenarioId);
    if (!sid) {
      setError('No scenario selected for setup.');
      return;
    }
    setBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=save_case_setup', {
        scenario_id: sid,
        ...params
      });
      showMysteryToast({ tone: 'success', message: 'Case setup saved.' });
      await loadScenarioEntities(sid);
    } catch (e: any) {
      setError(e?.message || 'Failed to save case setup');
    } finally {
      setBusy(false);
    }
  }, [scenarioId, loadScenarioEntities, setBusy, setError, showMysteryToast]);

  const spawnCaseFromBackstory = React.useCallback(async (bid?: string | number) => {
    const targetBid = bid || backstoryId;
    if (!mysteryId || !targetBid) return;
    setBusy(true);
    try {
      const res = await ApiClient.post<{ case_id: number }>('/api/mystery/admin.php?action=spawn_case_from_backstory', {
        mystery_id: mysteryId,
        backstory_id: targetBid
      });
      if (res?.case_id) {
        showMysteryToast({ tone: 'success', message: 'Case spawned successfully.' });
        await loadCases(mysteryId);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to spawn case');
    } finally {
      setBusy(false);
    }
  }, [mysteryId, backstoryId, loadCases, setBusy, setError, showMysteryToast]);

  const createBackstory = React.useCallback(async (params: any) => {
    if (!mysteryId) return;
    setBusy(true);
    try {
      const res = await ApiClient.post('/api/mystery/admin.php?action=generate_backstory', {
        mystery_id: mysteryId,
        ...params
      });
      if (res?.backstory_id) {
        await loadBackstories(mysteryId);
      }
      return res;
    } catch (e: any) {
      setError(e?.message || 'Failed to create backstory');
      throw e;
    } finally {
      setBusy(false);
    }
  }, [mysteryId, loadBackstories, setError, setBusy]);

  const saveBackstoryDetails = React.useCallback(async () => {
    if (!backstoryId) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=save_backstory_details', {
        id: backstoryId,
        title: backstoryTitleDraft,
        slug: backstorySlugDraft,
        backstory_summary: backstoryTextDraft,
        location_master_id: backstoryLocationMasterIdDraft,
        meta_json: backstoryMetaDraft
      });
      showMysteryToast({ tone: 'success', message: 'Backstory details saved.' });
      await loadBackstoryDetails(backstoryId);
    } catch (e: any) {
      setError(e?.message || 'Failed to save backstory details');
    } finally {
      setBusy(false);
    }
  }, [backstoryId, backstoryTitleDraft, backstorySlugDraft, backstoryTextDraft, backstoryLocationMasterIdDraft, backstoryMetaDraft, loadBackstoryDetails, setBusy, setError, showMysteryToast]);

  const saveBackstoryFullStory = React.useCallback(async () => {
    if (!backstoryId) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=save_backstory_full', {
        id: backstoryId,
        full_story: backstoryFullTextDraft
      });
      showMysteryToast({ tone: 'success', message: 'Full backstory saved.' });
    } catch (e: any) {
      setError(e?.message || 'Failed to save full backstory');
    } finally {
      setBusy(false);
    }
  }, [backstoryId, backstoryFullTextDraft, setBusy, setError, showMysteryToast]);

  return {
    addEvidenceNote,
    enqueueSpecificJob,
    createBackstory,
    spawnCaseFromBackstory,
    saveCaseSetup,
    saveBackstoryDetails,
    saveBackstoryFullStory,
    generateCsiReport,
    loadBackstories,
    loadBackstoryDetails,
    loadScenarios,
    watchJobToast
  };
}
