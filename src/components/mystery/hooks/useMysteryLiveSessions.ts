import React from 'react';
import { useGeminiLiveSession } from './useGeminiLiveSession';
import { IToast } from '../../../types/common';
import { IScenarioEntity } from '../../../types/game';
import { IMysteryLiveSessions } from '../../../types/mysteryHooks';

/**
 * useMysteryLiveSessions - Refactored Conductor Hook
 * COMPLIANCE: File size < 250 lines
 */
export function useMysteryLiveSessions({
  scenarioId,
  caseId,
  showMysteryToast,
  showVoiceToast,
  getActiveVoiceMapProvider,
  setScenarioEntities,
  setError,
  setMessage,
  setBusy
}: {
  scenarioId: string;
  caseId: string;
  showMysteryToast: (t: IToast) => void;
  showVoiceToast: (t: IToast) => void;
  getActiveVoiceMapProvider: () => 'google' | 'live';
  setScenarioEntities: (entities: IScenarioEntity[]) => void;
  setError: (err: string) => void;
  setMessage: (msg: string) => void;
  setBusy: (busy: boolean) => void;
}): IMysteryLiveSessions {
  const sheriff = useGeminiLiveSession({
    type: 'sheriff',
    scenarioId,
    caseId,
    showVoiceToast,
    showMysteryToast,
    getActiveVoiceMapProvider,
    setScenarioEntities,
    setBusy,
    setError,
    setMessage
  });

  const csi = useGeminiLiveSession({
    type: 'csi',
    scenarioId,
    caseId,
    showVoiceToast,
    showMysteryToast,
    getActiveVoiceMapProvider,
    setScenarioEntities,
    setBusy,
    setError,
    setMessage
  });

  const returnValue = React.useMemo(() => ({
    sheriffLiveStatus: sheriff.status,
    sheriffLiveInputText: sheriff.inputText,
    sheriffLiveOutputText: sheriff.outputText,
    csiLiveStatus: csi.status,
    csiLiveInputText: csi.inputText,
    csiLiveOutputText: csi.outputText,
    scenarioSheriffName: sheriff.name,
    scenarioCsiDetectiveName: csi.name,
    stopSheriffLiveStreaming: sheriff.stopStreaming,
    startSheriffLiveSession: sheriff.startSession,
    startSheriffLiveStreaming: sheriff.startStreaming,
    stopCsiLiveStreaming: csi.stopStreaming,
    startCsiLiveSession: csi.startSession,
    startCsiLiveStreaming: csi.startStreaming,
    setSheriffLiveStatus: sheriff.setStatus,
    setSheriffLiveInputText: sheriff.setInputText,
    setSheriffLiveOutputText: sheriff.setOutputText,
    setCsiLiveStatus: csi.setStatus,
    setCsiLiveInputText: csi.setInputText,
    setCsiLiveOutputText: csi.setOutputText
  }), [sheriff, csi]);

  return returnValue;
}
