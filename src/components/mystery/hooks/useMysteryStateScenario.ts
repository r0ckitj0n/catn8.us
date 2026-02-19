import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IScenarioEntity, IEvidence, IScenario } from '../../../types/game';
import { IMysteryStateScenario } from '../../../types/mysteryHooks';

export function useMysteryStateScenario(
  caseId: string,
  scenarioId: string,
  setBusy: (busy: boolean) => void,
  setError: (err: string) => void,
  setScenario: (s: IScenario | null) => void
): IMysteryStateScenario {
  const [characters, setCharacters] = useState<any[]>([]);
  const [scenarioEntities, setScenarioEntities] = useState<IScenarioEntity[]>([]);
  const [caseNotes, setCaseNotes] = useState<any[]>([]);
  const [lies, setLies] = useState<any[]>([]);
  const [evidenceList, setEvidenceList] = useState<IEvidence[]>([]);
  const [depositions, setDepositions] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  
  const [coldHardFacts, setColdHardFacts] = React.useState('');
  const [coldHardFactsUpdatedAt, setColdHardFactsUpdatedAt] = React.useState('');
  const [scenarioCrimeScene, setScenarioCrimeScene] = React.useState('');
  const [newScenario, setNewScenario] = React.useState({ title: '' });
  const [entityNameById, setEntityNameById] = useState<Record<string, string>>({});
  const [crimeSceneLocationIdDraft, setCrimeSceneLocationIdDraft] = React.useState('');
  const [deleteScenarioArmed, setDeleteScenarioArmed] = React.useState(false);

  const loadScenario = React.useCallback(async (sid: string | number) => {
    if (!sid) {
      setScenarioCrimeScene('');
      setScenario(null);
      return;
    }
    try {
      const res = await ApiClient.get<{ scenario: IScenario }>(`/api/mystery/play.php?action=get_scenario&id=${sid}`);
      const s = res?.scenario;
      setScenario(s || null);
      setScenarioCrimeScene(s?.crime_scene_location || '');
      if (s?.crime_scene_location_id) setCrimeSceneLocationIdDraft(String(s.crime_scene_location_id));
    } catch (err: any) {
      console.error('Failed to load scenario details:', err);
      setScenario(null);
    }
  }, [setScenario]);

  const loadScenarioEntities = React.useCallback(async (sid: string | number) => {
    if (!sid) {
      setScenarioEntities([]);
      return;
    }
    try {
      const res = await ApiClient.get('/api/mystery/play.php?action=list_scenario_entities&scenario_id=' + String(sid));
      setScenarioEntities(Array.isArray(res?.scenario_entities) ? res.scenario_entities : []);
    } catch (err: any) {
      console.error('Failed to load scenario entities:', err);
    }
  }, []);

  const loadCaseNotes = React.useCallback(async (sid: string | number) => {
    if (!sid) {
      setCaseNotes([]);
      return;
    }
    try {
      const res = await ApiClient.get('/api/mystery/play.php?action=list_case_notes&scenario_id=' + String(sid));
      setCaseNotes(Array.isArray(res?.case_notes) ? res.case_notes : []);
    } catch (err: any) {
      console.error('Failed to load case notes:', err);
    }
  }, []);

  const loadEvidence = React.useCallback(async (sid: string | number) => {
    if (!sid) {
      setEvidenceList([]);
      return;
    }
    try {
      const res = await ApiClient.get('/api/mystery/play.php?action=list_evidence&scenario_id=' + String(sid));
      setEvidenceList(Array.isArray(res?.evidence) ? res.evidence : []);
    } catch (err: any) {
      console.error('Failed to load evidence:', err);
    }
  }, []);

  const createScenario = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScenario.title.trim() || !caseId) return;
    setBusy(true);
    try {
      const res = await ApiClient.post<{ id: number }>('/api/mystery/admin.php?action=save_scenario', {
        id: 0,
        case_id: caseId,
        title: newScenario.title.trim()
      });
      if (res?.id) {
        setNewScenario({ title: '' });
        await loadScenarioEntities(res.id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create scenario');
    } finally {
      setBusy(false);
    }
  }, [newScenario.title, caseId, loadScenarioEntities, setBusy, setError]);

  const deleteScenario = React.useCallback(async (sid: string | number) => {
    if (!sid || !deleteScenarioArmed) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=delete_scenario', { id: sid });
      // Reset scenario state if current was deleted
      setScenarioCrimeScene('');
      setDeleteScenarioArmed(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete scenario');
    } finally {
      setBusy(false);
    }
  }, [deleteScenarioArmed, setBusy, setError]);

  const ensureDefaultScenarioForCase = React.useCallback(async (cid: string | number) => {
    if (!cid) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/mystery/play.php?action=ensure_default_scenario_for_case', { case_id: cid });
    } catch (err: any) {
      setError(err?.message || 'Failed to ensure default scenario');
    } finally {
      setBusy(false);
    }
  }, [setBusy, setError]);

  const reassignScenarioCase = React.useCallback(async (sid: string | number, cid: string | number) => {
    if (!sid || !cid) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=save_scenario', {
        id: sid,
        case_id: cid
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to reassign scenario');
    } finally {
      setBusy(false);
    }
  }, [setBusy, setError]);

  const saveCrimeSceneLocationId = React.useCallback(async () => {
    if (!scenarioId || !crimeSceneLocationIdDraft) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=save_scenario', {
        id: scenarioId,
        location_id: crimeSceneLocationIdDraft
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to save location');
    } finally {
      setBusy(false);
    }
  }, [scenarioId, crimeSceneLocationIdDraft, setBusy, setError]);

  return React.useMemo(() => ({
    characters, setCharacters,
    scenarioEntities, setScenarioEntities,
    caseNotes, setCaseNotes,
    lies, setLies,
    evidenceList, setEvidenceList,
    depositions, setDepositions,
    images, setImages,
    coldHardFacts, setColdHardFacts,
    coldHardFactsUpdatedAt, setColdHardFactsUpdatedAt,
    scenarioCrimeScene, setScenarioCrimeScene,
    newScenario, setNewScenario,
    entityNameById, setEntityNameById,
    crimeSceneLocationIdDraft, setCrimeSceneLocationIdDraft,
    deleteScenarioArmed, setDeleteScenarioArmed,
    loadScenario,
    loadScenarioEntities,
    loadCaseNotes,
    loadEvidence,
    createScenario,
    deleteScenario,
    ensureDefaultScenarioForCase,
    reassignScenarioCase,
    saveCrimeSceneLocationId
  }), [
    characters, scenarioEntities, caseNotes, lies, evidenceList, depositions, images,
    coldHardFacts, coldHardFactsUpdatedAt, scenarioCrimeScene, newScenario, entityNameById,
    crimeSceneLocationIdDraft, deleteScenarioArmed, loadScenario, loadScenarioEntities, 
    loadCaseNotes, loadEvidence, createScenario, deleteScenario, 
    ensureDefaultScenarioForCase, reassignScenarioCase, saveCrimeSceneLocationId
  ]);
}
