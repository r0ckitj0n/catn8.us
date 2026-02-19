import React, { useState, useRef } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IMysterySettings } from '../../../types/game';

export function useMysterySettingsCore(
  mysteryId: string | number,
  setError: (err: string) => void
) {
  const [mysterySettingsObj, setMysterySettingsObj] = useState<IMysterySettings>({});
  const [mysterySettingsDraft, setMysterySettingsDraft] = React.useState('{}');
  const [mysterySettingsUpdatedAt, setMysterySettingsUpdatedAt] = React.useState('');
  const mysterySettingsObjRef = useRef<IMysterySettings>({});
  const mysterySettingsLoadSeqRef = React.useRef(0);

  const loadMysterySettings = React.useCallback(async () => {
    if (!mysteryId) return;
    const seq = ++mysterySettingsLoadSeqRef.current;
    try {
      const res = await ApiClient.get<{ settings: IMysterySettings, updated_at: string }>(`/api/mystery/admin.php?action=get_mystery_settings&mystery_id=${mysteryId}`);
      if (seq !== mysterySettingsLoadSeqRef.current) return;
      
      const settings = res?.settings || {};
      setMysterySettingsObj(settings);
      setMysterySettingsDraft(JSON.stringify(settings, null, 2));
      setMysterySettingsUpdatedAt(res?.updated_at || '');
      mysterySettingsObjRef.current = settings;
    } catch (e: any) {
      setError(e?.message || 'Failed to load mystery settings');
    }
  }, [mysteryId, setError]);

  const saveMysterySettingsObject = React.useCallback(async () => {
    if (!mysteryId) return;
    try {
      let settings: IMysterySettings = {};
      try {
        settings = JSON.parse(mysterySettingsDraft);
      } catch (e) {
        setError('Invalid JSON in mystery settings draft');
        return;
      }
      await ApiClient.post('/api/mystery/admin.php?action=save_mystery_settings', {
        mystery_id: mysteryId,
        settings
      });
      setMysterySettingsObj(settings);
      mysterySettingsObjRef.current = settings;
    } catch (e: any) {
      setError(e?.message || 'Failed to save mystery settings');
    }
  }, [mysteryId, mysterySettingsDraft, setError]);

  return React.useMemo(() => ({
    mysterySettingsObj, setMysterySettingsObj,
    mysterySettingsDraft, setMysterySettingsDraft,
    mysterySettingsUpdatedAt, setMysterySettingsUpdatedAt,
    mysterySettingsObjRef,
    loadMysterySettings,
    saveMysterySettingsObject
  }), [
    mysterySettingsObj, mysterySettingsDraft, mysterySettingsUpdatedAt, 
    loadMysterySettings, saveMysterySettingsObject
  ]);
}
