import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IToast } from '../../../types/common';
import { ICase, IScenario, IScenarioEntity } from '../../../types/game';
import { IMysteryStateCaseMgmt } from '../../../types/mysteryHooks';

export function useMysteryStateCaseMgmt(mysteryId: string, caseId: string, setBusy: (busy: boolean) => void, setError: (err: string) => void, showMysteryToast: (t: Partial<IToast>) => void): IMysteryStateCaseMgmt {
  const [caseMgmtMysteryId, setCaseMgmtMysteryId] = React.useState(mysteryId || '');
  const [caseMgmtCases, setCaseMgmtCases] = useState<ICase[]>([]);
  const [caseMgmtCaseId, setCaseMgmtCaseId] = React.useState(caseId || '');
  const [caseMgmtScenarios, setCaseMgmtScenarios] = useState<IScenario[]>([]);
  const [caseMgmtScenarioId, setCaseMgmtScenarioId] = React.useState('');
  const [caseMgmtBriefingDraft, setCaseMgmtBriefingDraft] = React.useState('');
  const [caseMgmtCaseTitleDraft, setCaseMgmtCaseTitleDraft] = React.useState('');
  const [caseMgmtCaseSlugDraft, setCaseMgmtCaseSlugDraft] = React.useState('');
  const [caseMgmtCaseDescriptionDraft, setCaseMgmtCaseDescriptionDraft] = React.useState('');
  const [caseMgmtCaseArchivedDraft, setCaseMgmtCaseArchivedDraft] = React.useState(false);
  const [caseMgmtCaseTemplateDraft, setCaseMgmtCaseTemplateDraft] = React.useState(false);
  const [caseMgmtScenarioSnapshot, setCaseMgmtScenarioSnapshot] = useState<any>(null);
  const [caseMgmtScenarioEntities, setCaseMgmtScenarioEntities] = useState<IScenarioEntity[]>([]);
  const [csiDetectiveEntityIdDraft, setCsiDetectiveEntityIdDraft] = React.useState('');
  const [csiReportTextDraft, setCsiReportTextDraft] = React.useState('');
  const [csiReportJsonDraft, setCsiReportJsonDraft] = React.useState('');
  
  const [caseMgmtInvolvedCharacters, setCaseMgmtInvolvedCharacters] = useState<IScenarioEntity[]>([]);
  const [caseMgmtExpandedEntityIds, setCaseMgmtExpandedEntityIds] = useState<number[]>([]);
  const [caseMgmtDepositionBusyByEntityId, setCaseMgmtDepositionBusyByEntityId] = useState<Record<string, boolean>>({});
  const [caseMgmtDepositionErrorByEntityId, setCaseMgmtDepositionErrorByEntityId] = useState<Record<string, string>>({});
  const [caseMgmtDepositionByEntityId, setCaseMgmtDepositionByEntityId] = useState<Record<string, { text: string; updated_at: string }>>({});

  const [caseAvailableMasterCharacterIds, setCaseAvailableMasterCharacterIds] = useState<number[]>([]);
  const [caseAvailableMasterLocationIds, setCaseAvailableMasterLocationIds] = useState<number[]>([]);
  const [caseAvailableMasterWeaponIds, setCaseAvailableMasterWeaponIds] = useState<number[]>([]);
  const [caseAvailableMasterMotiveIds, setCaseAvailableMasterMotiveIds] = useState<number[]>([]);

  const loadCaseMgmtCases = React.useCallback(async (mid: string | number) => {
    if (!mid) {
      setCaseMgmtCases([]);
      return;
    }
    try {
      const res = await ApiClient.get<{ cases: ICase[] }>('/api/mystery/play.php?action=list_cases&mystery_id=' + String(mid));
      setCaseMgmtCases(Array.isArray(res?.cases) ? res.cases : []);
    } catch (err: any) {
      console.error('Failed to load case mgmt cases:', err);
    }
  }, []);

  const loadCaseMgmtScenariosAndBriefing = React.useCallback(async () => {
    const cid = Number(caseMgmtCaseId);
    if (!cid) return;
    try {
      const res = await ApiClient.get<{ scenarios: IScenario[] }>('/api/mystery/play.php?action=list_scenarios&case_id=' + String(cid));
      setCaseMgmtScenarios(Array.isArray(res?.scenarios) ? res.scenarios : []);
    } catch (err: any) {
      console.error('Failed to load case mgmt scenarios:', err);
    }
  }, [caseMgmtCaseId]);

  const loadCaseMgmtBriefingForScenarioId = React.useCallback(async (sid: number) => {
    if (!sid) return;
    try {
      const res = await ApiClient.get<{ briefing_text: string, snapshot: any, entities: IScenarioEntity[] }>(`/api/mystery/play.php?action=get_scenario_briefing&id=${sid}`);
      setCaseMgmtBriefingDraft(res?.briefing_text || '');
      setCaseMgmtScenarioSnapshot(res?.snapshot || null);
      setCaseMgmtInvolvedCharacters(Array.isArray(res?.entities) ? res.entities : []);
    } catch (err: any) {
      console.error('Failed to load case mgmt briefing:', err);
    }
  }, []);

  const saveCaseMgmtCaseDetails = React.useCallback(async () => {
    const cid = Number(caseMgmtCaseId || 0);
    if (!cid) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=save_case_details', {
        id: cid,
        title: caseMgmtCaseTitleDraft,
        slug: caseMgmtCaseSlugDraft,
        description: caseMgmtCaseDescriptionDraft,
        is_archived: caseMgmtCaseArchivedDraft ? 1 : 0,
        is_template: caseMgmtCaseTemplateDraft ? 1 : 0
      });
      showMysteryToast({ tone: 'success', message: 'Case details saved.' });
    } catch (e: any) {
      setError(e?.message || 'Failed to save case details');
    } finally {
      setBusy(false);
    }
  }, [caseMgmtCaseId, caseMgmtCaseTitleDraft, caseMgmtCaseSlugDraft, caseMgmtCaseDescriptionDraft, caseMgmtCaseArchivedDraft, caseMgmtCaseTemplateDraft, setBusy, setError, showMysteryToast]);

  const saveCaseMgmtBriefing = React.useCallback(async () => {
    const sid = Number(caseMgmtScenarioId);
    if (!sid) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=save_scenario_briefing', {
        id: sid,
        briefing_text: caseMgmtBriefingDraft
      });
      showMysteryToast({ tone: 'success', message: 'Scenario briefing saved.' });
    } catch (e: any) {
      setError(e?.message || 'Failed to save briefing');
    } finally {
      setBusy(false);
    }
  }, [caseMgmtScenarioId, caseMgmtBriefingDraft, setBusy, setError, showMysteryToast]);

  const loadCaseMgmtDepositionForEntity = React.useCallback(async (eid: number) => {
    const sid = Number(caseMgmtScenarioId);
    if (!sid || !eid) return;
    setCaseMgmtDepositionBusyByEntityId(prev => ({ ...prev, [eid]: true }));
    try {
      const res = await ApiClient.get<{ text: string, updated_at: string }>(`/api/mystery/play.php?action=get_deposition&scenario_id=${sid}&entity_id=${eid}`);
      setCaseMgmtDepositionByEntityId(prev => ({ ...prev, [eid]: { text: res?.text || '', updated_at: res?.updated_at || '' } }));
    } catch (err: any) {
      setCaseMgmtDepositionErrorByEntityId(prev => ({ ...prev, [eid]: err?.message || 'Failed' }));
    } finally {
      setCaseMgmtDepositionBusyByEntityId(prev => ({ ...prev, [eid]: false }));
    }
  }, [caseMgmtScenarioId]);

  const enqueueCaseMgmtGenerateDeposition = React.useCallback(async (eid: number) => {
    const sid = Number(caseMgmtScenarioId);
    if (!sid || !eid) return;
    setBusy(true);
    try {
      const res = await ApiClient.post<{ job_id: number }>('/api/mystery/play.php?action=enqueue_job', {
        case_id: Number(caseMgmtCaseId),
        scenario_id: sid,
        job_action: 'generate_deposition',
        job_spec: { entity_id: eid }
      });
      if (res?.job_id) {
        showMysteryToast({ tone: 'info', message: 'Deposition generation enqueued.' });
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to enqueue');
    } finally {
      setBusy(false);
    }
  }, [caseMgmtCaseId, caseMgmtScenarioId, setBusy, setError, showMysteryToast]);

  const removeCaseMgmtLawEnforcementCharacter = React.useCallback(async (sei: number) => {
    if (!sei) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=delete_scenario_entity', { id: sei });
      showMysteryToast({ tone: 'success', message: 'Character removed.' });
      if (caseMgmtScenarioId) await loadCaseMgmtBriefingForScenarioId(Number(caseMgmtScenarioId));
    } catch (e: any) {
      setError(e?.message || 'Failed to remove');
    } finally {
      setBusy(false);
    }
  }, [caseMgmtScenarioId, loadCaseMgmtBriefingForScenarioId, setBusy, setError, showMysteryToast]);

  const recomputeCaseMgmtRoles = React.useCallback(async () => {
    const sid = Number(caseMgmtScenarioId);
    if (!sid) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=recompute_scenario_roles', { scenario_id: sid });
      showMysteryToast({ tone: 'success', message: 'Roles recomputed.' });
      await loadCaseMgmtBriefingForScenarioId(sid);
    } catch (e: any) {
      setError(e?.message || 'Failed to recompute');
    } finally {
      setBusy(false);
    }
  }, [caseMgmtScenarioId, loadCaseMgmtBriefingForScenarioId, setBusy, setError, showMysteryToast]);

  const saveCsiReport = React.useCallback(async () => {
    const sid = Number(caseMgmtScenarioId);
    if (!sid) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=save_csi_report', {
        scenario_id: sid,
        report_text: csiReportTextDraft,
        report_json: csiReportJsonDraft,
        detective_entity_id: csiDetectiveEntityIdDraft
      });
      showMysteryToast({ tone: 'success', message: 'CSI report saved.' });
    } catch (e: any) {
      setError(e?.message || 'Failed to save CSI report');
    } finally {
      setBusy(false);
    }
  }, [caseMgmtScenarioId, csiReportTextDraft, csiReportJsonDraft, csiDetectiveEntityIdDraft, setBusy, setError, showMysteryToast]);

  React.useEffect(() => {
    if (mysteryId && !caseMgmtMysteryId) {
      setCaseMgmtMysteryId(mysteryId);
    }
  }, [mysteryId, caseMgmtMysteryId]);

  React.useEffect(() => {
    if (caseId && !caseMgmtCaseId) {
      setCaseMgmtCaseId(caseId);
    }
  }, [caseId, caseMgmtCaseId]);

  React.useEffect(() => {
    if (caseMgmtMysteryId) loadCaseMgmtCases(caseMgmtMysteryId);
    else setCaseMgmtCases([]);
  }, [caseMgmtMysteryId, loadCaseMgmtCases]);

  return { caseMgmtMysteryId, setCaseMgmtMysteryId, caseMgmtCases, setCaseMgmtCases, caseMgmtCaseId, setCaseMgmtCaseId, caseMgmtScenarios, setCaseMgmtScenarios, caseMgmtScenarioId, setCaseMgmtScenarioId, caseMgmtBriefingDraft, setCaseMgmtBriefingDraft, caseMgmtCaseTitleDraft, setCaseMgmtCaseTitleDraft, caseMgmtCaseSlugDraft, setCaseMgmtCaseSlugDraft, caseMgmtCaseDescriptionDraft, setCaseMgmtCaseDescriptionDraft, caseMgmtCaseArchivedDraft, setCaseMgmtCaseArchivedDraft, caseMgmtCaseTemplateDraft, setCaseMgmtCaseTemplateDraft, caseMgmtScenarioSnapshot, setCaseMgmtScenarioSnapshot, csiDetectiveEntityIdDraft, setCsiDetectiveEntityIdDraft, csiReportTextDraft, setCsiReportTextDraft, csiReportJsonDraft, setCsiReportJsonDraft, caseMgmtScenarioEntities, setCaseMgmtScenarioEntities, caseMgmtInvolvedCharacters, setCaseMgmtInvolvedCharacters, caseMgmtExpandedEntityIds, setCaseMgmtExpandedEntityIds, caseMgmtDepositionBusyByEntityId, setCaseMgmtDepositionBusyByEntityId, caseMgmtDepositionErrorByEntityId, setCaseMgmtDepositionErrorByEntityId, caseMgmtDepositionByEntityId, setCaseMgmtDepositionByEntityId, loadCaseMgmtCases, loadCaseMgmtScenariosAndBriefing, loadCaseMgmtBriefingForScenarioId, saveCaseMgmtCaseDetails, saveCaseMgmtBriefing, loadCaseMgmtDepositionForEntity, enqueueCaseMgmtGenerateDeposition, removeCaseMgmtLawEnforcementCharacter, recomputeCaseMgmtRoles, saveCsiReport, caseAvailableMasterCharacterIds, setCaseAvailableMasterCharacterIds, caseAvailableMasterLocationIds, setCaseAvailableMasterLocationIds, caseAvailableMasterWeaponIds, setCaseAvailableMasterWeaponIds, caseAvailableMasterMotiveIds, setCaseAvailableMasterMotiveIds };
}
