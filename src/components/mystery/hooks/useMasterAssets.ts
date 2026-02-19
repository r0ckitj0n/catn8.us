import React from 'react';
import { useMasterAssetsCore } from './useMasterAssetsCore';
import { useMasterAssetsDetails } from './useMasterAssetsDetails';
import { useMasterAssetsActions } from './useMasterAssetsActions';
import { IMasterAssets } from '../../../types/mysteryHooks';

/**
 * useMasterAssets - Refactored Conductor Hook
 * COMPLIANCE: File size < 250 lines
 */
export function useMasterAssets(
  isAdmin: boolean,
  mysteryId: string | number,
  caseId: string | number,
  scenarioId: string | number,
  scenarioEntities: any[],
  enqueueSpecificJob: (params: { action: string, spec: any, requireScenario: boolean, entityId?: any }) => Promise<any>,
  watchJobToast: (params: { caseId: number; jobId: number; label: string; onDone?: (result: any) => void }) => Promise<void>,
  showMysteryToast: (t: any) => void,
  setError: (err: string) => void,
  setBusy: (busy: boolean) => void
): IMasterAssets {
  // 1. Core State & Loaders
  const core = useMasterAssetsCore(mysteryId, caseId, setError);

  // 2. Details Management
  const details = useMasterAssetsDetails(mysteryId, setError);

  // 2.1 Calculate derived scenario context
  const masterCharacterScenarioEntityId = React.useMemo(() => {
    if (details.masterAssetDetailsType !== 'character' || !details.masterAssetDetailsItem) return null;
    const char = scenarioEntities.find(e => 
      String(e.name).toLowerCase().trim() === String(details.masterAssetDetailsName).toLowerCase().trim() ||
      (e.master_id && Number(e.master_id) === Number(details.masterAssetDetailsItem.id))
    );
    return char ? Number(char.entityId) : null;
  }, [details.masterAssetDetailsType, details.masterAssetDetailsItem, details.masterAssetDetailsName, scenarioEntities]);

  // 3. Actions & Upserts
  const actions = useMasterAssetsActions(
    isAdmin,
    mysteryId,
    caseId,
    scenarioId,
    setError,
    showMysteryToast,
    setBusy,
    watchJobToast,
    {
      loadMasterCharacters: core.loadMasterCharacters,
      loadMasterLocations: core.loadMasterLocations,
      loadMasterWeapons: core.loadMasterWeapons,
      loadMasterMotives: core.loadMasterMotives,
      loadMasterCharacterImages: core.loadMasterCharacterImages
    },
    {
      ...core,
      ...details,
      masterCharacterScenarioEntityId,
      buildMasterAssetDetailsSnapshot: details.buildMasterAssetDetailsSnapshot,
      isMasterAssetFieldLocked: details.isMasterAssetFieldLocked
    }
  );

  // 3.1 Auto-load deposition when character is opened
  React.useEffect(() => {
    if (details.masterAssetDetailsType === 'character' && masterCharacterScenarioEntityId && scenarioId) {
      void actions.loadMasterCharacterDeposition();
    }
  }, [details.masterAssetDetailsType, masterCharacterScenarioEntityId, scenarioId, actions.loadMasterCharacterDeposition]);

  // 4. Conductor Logic & Composition
  const returnValue = React.useMemo(() => ({
    ...core,
    ...details,
    ...actions,
    caseId,
    scenarioId,
    masterCharacterScenarioEntityId,
    enqueueSpecificJob
  }), [core, details, actions, caseId, scenarioId, masterCharacterScenarioEntityId, enqueueSpecificJob]);

  return returnValue;
}
