import React from 'react';
import { useMysteryStateCore } from './useMysteryStateCore';
import { useMysteryStateScenario } from './useMysteryStateScenario';
import { useMysteryStateActions } from './useMysteryStateActions';
import { useMysteryStateCaseMgmt } from './useMysteryStateCaseMgmt';
import { useMysteryStateStoryBook } from './useMysteryStateStoryBook';
import { useMysteryStateInvestigation } from './useMysteryStateInvestigation';
import { useMysteryStateSync } from './useMysteryStateSync';
import { useJobTracking } from './useJobTracking';
import { IMysteryState } from '../../../types/mysteryHooks';

/**
 * useMysteryState - Refactored Conductor Hook
 * COMPLIANCE: File size < 250 lines
 */
export function useMysteryState(
  isAuthed: boolean,
  setError: (err: string) => void,
  setBusy: (busy: boolean) => void,
  showMysteryToast: (t: any) => void
): IMysteryState {
  // 1. Modular Hooks
  const core = useMysteryStateCore(isAuthed, setError, setBusy);
  const scenario = useMysteryStateScenario(core.caseId, core.scenarioId, setBusy, setError, core.setScenario);
  const caseMgmt = useMysteryStateCaseMgmt(core.mysteryId, core.caseId, setBusy, setError, showMysteryToast);
  const storyBook = useMysteryStateStoryBook(setBusy, setError, showMysteryToast);
  const investigation = useMysteryStateInvestigation(core.scenarioId, setError);
  const sync = useMysteryStateSync();
  const { watchJobToast } = useJobTracking(showMysteryToast);

  // 2. Actions Dispatcher
  const actions = useMysteryStateActions({
    setBusy,
    setError,
    showMysteryToast,
    scenarioId: core.scenarioId,
    caseId: core.caseId,
    mysteryId: core.mysteryId,
    backstoryId: storyBook.backstoryId,
    backstoryTitleDraft: storyBook.backStoryCreateTitle,
    backstorySlugDraft: storyBook.backStoryCreateSlug,
    backstoryTextDraft: storyBook.backStoryCreateSource,
    backstoryLocationMasterIdDraft: storyBook.backStoryCreateLocationMasterId,
    backstoryMetaDraft: storyBook.backStoryCreateMeta,
    backstoryFullTextDraft: storyBook.storyLongDraft,
    loadEvidence: scenario.loadEvidence,
    loadJobs: core.loadJobs,
    loadCases: core.loadCases,
    loadMysteries: core.loadMysteries,
    loadBackstories: core.loadBackstories,
    loadBackstoryDetails: core.loadBackstoryDetails,
    loadCaseMgmtBriefingForScenarioId: caseMgmt.loadCaseMgmtBriefingForScenarioId,
    loadScenarios: core.loadScenarios,
    loadScenarioEntities: scenario.loadScenarioEntities,
    loadScenario: scenario.loadScenario,
    watchJobToast
  });

  React.useEffect(() => {
    // When scenarios list is loaded for a case, auto-pick the first one if none selected
    // BUT only do this if we don't already have a scenarioId selected
    const scenariosList = Array.isArray(core.scenarios) ? core.scenarios : [];
    if (core.caseId && scenariosList.length > 0 && !core.scenarioId) {
      const firstScenarioId = String(scenariosList[0].id);
      core.setScenarioId(firstScenarioId);
    }
  }, [core.caseId, core.scenarios, core.scenarioId, core.setScenarioId]);

  React.useEffect(() => {
    // When scenarioId is set (either by user or auto-pick), load its details
    // We stabilize the call by ensuring the scenarioId exists and is not empty
    const sid = String(core.scenarioId || '').trim();
    if (sid) {
      void scenario.loadScenario(sid);
      void scenario.loadScenarioEntities(sid);
      void scenario.loadCaseNotes(sid);
      void scenario.loadEvidence(sid);
    }
  }, [core.scenarioId, scenario.loadScenario, scenario.loadScenarioEntities, scenario.loadCaseNotes, scenario.loadEvidence]);

  const scenarioCast = React.useMemo(() => {
    const list = Array.isArray(scenario.scenarioEntities) ? scenario.scenarioEntities : [];
    return list.map(se => {
      const agentId = Number(se.agent_id || se.data?.agent_id || se.data_json?.agent_id || 0);
      const data = se.data || se.data_json || {};
      const irFallback = agentId >= 1 && agentId <= 100 ? `/images/mystery/agent${agentId}_ir_angry.png` : '/images/mystery/interrogation_room_empty.png';
      
      console.log(`[useMysteryState] Entity: ${se.entity_name}, agentId: ${agentId}, irImageUrl: ${irFallback}`);

      return {
        entityId: se.entity_id,
        agentId: agentId,
        role: se.role,
        name: se.entity_name || 'Character',
        thumbUrl: se.role === 'sheriff' ? '/images/mystery/sheriff.png' : (data.mugshot_url || '/images/mystery/interrogation_room_empty.png'),
        irImageUrl: irFallback,
        blurb: data.questioning_blurb || data.description || ''
      };
    });
  }, [scenario.scenarioEntities]);

  const selectedMystery = React.useMemo(() => {
    if (!core.mysteryId || !Array.isArray(core.mysteries)) return null;
    return core.mysteries.find(m => String(m.id) === String(core.mysteryId)) || null;
  }, [core.mysteries, core.mysteryId]);

  // 4. Stabilize Return Object
  return React.useMemo(() => ({
    // Core
    ...core,
    // Scenario
    ...scenario,
    // Case Management
    ...caseMgmt,
    // Story Book
    ...storyBook,
    // Investigation
    ...investigation,
    // Sync
    ...sync,
    // Actions
    ...actions,
    // Derived
    scenarioCast,
    selectedMystery,
    showMysteryToast
  }), [
    core, scenario, caseMgmt, storyBook, investigation, sync, actions,
    scenarioCast, selectedMystery, showMysteryToast
  ]);
}
