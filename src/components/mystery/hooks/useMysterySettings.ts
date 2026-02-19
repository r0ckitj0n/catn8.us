import React from 'react';
import { useMysterySettingsCore } from './useMysterySettingsCore';
import { useMysterySettingsVoices } from './useMysterySettingsVoices';
import { useMysterySettingsImages } from './useMysterySettingsImages';
import { useMysterySettingsUtils } from './useMysterySettingsUtils';
import { IMysterySettingsFull, IMasterAssets } from '../../../types/mysteryHooks';
import { IMysterySettings } from '../../../types/game';

/**
 * useMysterySettings - Refactored Conductor Hook
 * COMPLIANCE: File size < 250 lines
 */
export function useMysterySettings(
  isAdmin: boolean,
  mysteryId: string | number,
  masterAssets: IMasterAssets,
  showMysteryToast: (t: any) => void,
  setError: (err: string) => void
): IMysterySettingsFull {
  // 1. Core State
  const core = useMysterySettingsCore(mysteryId, setError);
  const { setMysterySettingsObj, setMysterySettingsDraft, mysterySettingsObjRef } = core;
  
  // 2. Utils
  const utils = useMysterySettingsUtils();

  const updateDraft = React.useCallback((newObj: IMysterySettings) => {
    setMysterySettingsObj(newObj);
    setMysterySettingsDraft(JSON.stringify(newObj, null, 2));
    mysterySettingsObjRef.current = newObj;
  }, [setMysterySettingsObj, setMysterySettingsDraft, mysterySettingsObjRef]);

  // 3. Specialized State
  const voices = useMysterySettingsVoices(
    isAdmin, 
    core.mysterySettingsObj,
    masterAssets.masterCharacters,
    updateDraft,
    setError
  );
  
  const images = useMysterySettingsImages(core.mysterySettingsObjRef);

  // 4. Tab State
  const [mysterySettingsTab, setMysterySettingsTab] = React.useState('voice');
  const [mysterySettingsEditorTarget, setMysterySettingsEditorTarget] = React.useState('tts');
  const [mysterySettingsEditorText, setMysterySettingsEditorText] = React.useState('{}');
  const [mysterySettingsEditorError, setMysterySettingsEditorError] = React.useState('');

  // 5. Lifecycle
  React.useEffect(() => {
    if (mysteryId) {
      core.loadMysterySettings();
    }
  }, [mysteryId, core.loadMysterySettings]);

  React.useEffect(() => {
    if (mysteryId && isAdmin) {
      voices.loadAgentProfiles();
      voices.loadTtsVoices();
    }
  }, [mysteryId, isAdmin, voices.loadAgentProfiles, voices.loadTtsVoices]);

  const openMysterySettingsEditor = React.useCallback(() => {
    setMysterySettingsEditorText(JSON.stringify(core.mysterySettingsObj, null, 2));
    // Implementation would open the editor modal here
  }, [core.mysterySettingsObj]);

  // 6. Conductor Composition
  const returnValue = React.useMemo(() => ({
    ...core,
    ...voices,
    ...images,
    ...utils,
    mysterySettingsTab, setMysterySettingsTab,
    mysterySettingsEditorTarget, setMysterySettingsEditorTarget,
    mysterySettingsEditorText, setMysterySettingsEditorText,
    mysterySettingsEditorError, setMysterySettingsEditorError,
    openMysterySettingsEditor
  }), [
    core, voices, images, utils, 
    mysterySettingsTab, mysterySettingsEditorTarget, 
    mysterySettingsEditorText, mysterySettingsEditorError,
    openMysterySettingsEditor
  ]);

  return returnValue;
}
