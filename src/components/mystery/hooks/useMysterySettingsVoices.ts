import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { ITtsVoice, IAgentProfile, IMysterySettings, IMasterCharacter } from '../../../types/game';
export function useMysterySettingsVoices(isAdmin: boolean, mysterySettingsObj: IMysterySettings, masterCharacters: IMasterCharacter[], updateDraft: (newObj: IMysterySettings) => void, setError: (err: string) => void) {
  const [ttsVoices, setTtsVoices] = useState<ITtsVoice[]>([]);
  const [ttsVoicesError, setTtsVoicesError] = React.useState('');
  const [ttsVoicesLoadedAt, setTtsVoicesLoadedAt] = React.useState('');
  const [agentProfiles, setAgentProfiles] = useState<IAgentProfile[]>([]);
  const [agentProfilesError, setAgentProfilesError] = React.useState('');
  const [agentProfilesLoadedAt, setAgentProfilesLoadedAt] = React.useState('');
  const languageCode = mysterySettingsObj?.tts?.language_code || 'en-US';
  const loadTtsVoices = React.useCallback(async () => {
    if (!isAdmin) return;
    setTtsVoicesError('');
    try {
      const lang = encodeURIComponent(String(languageCode).trim() || 'en-US');
      const res = await ApiClient.get<{ voices: ITtsVoice[] }>(`/api/mystery/admin.php?action=list_tts_voices&lang=${lang}`);
      setTtsVoices(Array.isArray(res?.voices) ? res.voices : []);
      setTtsVoicesLoadedAt(new Date().toISOString());
    } catch (e: any) {
      setTtsVoices([]);
      setTtsVoicesError(e?.message || 'Failed to load TTS voices');
    }
  }, [isAdmin, languageCode]);
  const loadAgentProfiles = React.useCallback(async () => {
    if (!isAdmin) {
      setAgentProfiles([]);
      return;
    }
    setAgentProfilesError('');
    try {
      const res = await ApiClient.get<{ profiles: IAgentProfile[] }>('/api/mystery/admin.php?action=list_agent_profiles');
      setAgentProfiles(Array.isArray(res?.profiles) ? res.profiles : []);
      setAgentProfilesLoadedAt(new Date().toISOString());
    } catch (e: any) {
      setAgentProfiles([]);
      setAgentProfilesError(e?.message || 'Failed to load agent profiles');
    }
  }, [isAdmin]);
  const getActiveVoiceMap = React.useCallback((settings: IMysterySettings) => {
    const tts = settings?.tts || {};
    const mode = tts.voice_map_active === 'live' ? 'live' : 'google';
    const maps = tts.voice_maps || {};
    return maps[mode] || { voice_map: {}, voice_map_locks: [] };
  }, []);
  const voiceIdSuggestions = React.useMemo(() => {
    const ids = new Set<string>();
    masterCharacters.forEach(c => {
      if (c.voice_id) ids.add(c.voice_id);
      // Also check roles/prefixes
      const prefix = c.is_law_enforcement ? 'sheriff_' : 'suspect_';
      ids.add(prefix + c.slug);
    });
    return Array.from(ids).sort();
  }, [masterCharacters]);
  const voiceMapRowIds = React.useMemo(() => {
    const ids = new Set<string>();
    const active = getActiveVoiceMap(mysterySettingsObj);
    const vm = (active.voice_map && typeof active.voice_map === 'object') ? active.voice_map : {};
    // 1. All keys already in the active voice map
    Object.keys(vm).forEach(k => ids.add(k));
    // 2. All character-based keys that should be there
    masterCharacters.forEach(c => {
      if (c.voice_id) ids.add(c.voice_id);
      const prefix = c.is_law_enforcement ? 'sheriff_' : 'suspect_';
      ids.add(prefix + c.slug);
    });
    return Array.from(ids).sort();
  }, [mysterySettingsObj, masterCharacters, getActiveVoiceMap]);
  const voiceIdToCharacters = React.useMemo(() => {
    const map = new Map<string, string[]>();
    masterCharacters.forEach(c => {
      const vid = c.voice_id;
      if (vid) {
        if (!map.has(vid)) map.set(vid, []);
        map.get(vid)!.push(c.name);
      }
      const prefix = c.is_law_enforcement ? 'sheriff_' : 'suspect_';
      const fullKey = prefix + c.slug;
      if (!map.has(fullKey)) map.set(fullKey, []);
      map.get(fullKey)!.push(c.name);
    });
    return map;
  }, [masterCharacters]);
  const addVoiceMapEntry = React.useCallback((voiceId: string) => {
    if (!voiceId) return;
    const s = JSON.parse(JSON.stringify(mysterySettingsObj)) as IMysterySettings;
    if (!s.tts) s.tts = {};
    if (!s.tts.voice_maps) s.tts.voice_maps = {};
    const mode = s.tts.voice_map_active === 'live' ? 'live' : 'google';
    if (!s.tts.voice_maps[mode]) s.tts.voice_maps[mode] = { voice_map: {}, voice_map_locks: [] };
    if (!s.tts.voice_maps[mode].voice_map) s.tts.voice_maps[mode].voice_map = {};
    if (!s.tts.voice_maps[mode].voice_map[voiceId]) {
      s.tts.voice_maps[mode].voice_map[voiceId] = {
        voice_name: '',
        language_code: s.tts.language_code || 'en-US'
      };
      updateDraft(s);
    }
  }, [mysterySettingsObj, updateDraft]);
  const deleteVoiceMapEntry = React.useCallback((voiceId: string) => {
    const s = JSON.parse(JSON.stringify(mysterySettingsObj)) as IMysterySettings;
    if (s.tts?.voice_maps) {
      const mode = s.tts.voice_map_active === 'live' ? 'live' : 'google';
      if (s.tts.voice_maps[mode]?.voice_map) {
        delete s.tts.voice_maps[mode].voice_map[voiceId];
        updateDraft(s);
      }
    }
  }, [mysterySettingsObj, updateDraft]);
  const toggleVoiceMapLock = React.useCallback((voiceId: string) => {
    const s = JSON.parse(JSON.stringify(mysterySettingsObj)) as IMysterySettings;
    if (s.tts?.voice_maps) {
      const mode = s.tts.voice_map_active === 'live' ? 'live' : 'google';
      if (!s.tts.voice_maps[mode]) return;
      if (!s.tts.voice_maps[mode].voice_map_locks) s.tts.voice_maps[mode].voice_map_locks = [];
      const locks = s.tts.voice_maps[mode].voice_map_locks as string[];
      if (locks.includes(voiceId)) {
        s.tts.voice_maps[mode].voice_map_locks = locks.filter(id => id !== voiceId);
      } else {
        s.tts.voice_maps[mode].voice_map_locks = [...locks, voiceId];
      }
      updateDraft(s);
    }
  }, [mysterySettingsObj, updateDraft]);
  const updateVoiceMapEntry = React.useCallback((voiceId: string, field: string, value: any) => {
    const s = JSON.parse(JSON.stringify(mysterySettingsObj)) as IMysterySettings;
    if (!s.tts) s.tts = {};
    if (voiceId === 'active_provider') {
      s.tts.voice_map_active = value;
      updateDraft(s);
      return;
    }
    if (s.tts.voice_maps) {
      const mode = s.tts.voice_map_active === 'live' ? 'live' : 'google';
      if (s.tts.voice_maps[mode]?.voice_map?.[voiceId]) {
        s.tts.voice_maps[mode].voice_map[voiceId] = {
          ...s.tts.voice_maps[mode].voice_map[voiceId],
          [field]: value
        };
        updateDraft(s);
      }
    }
  }, [mysterySettingsObj, updateDraft]);
  const addMissingVoiceIdsFromCharacters = React.useCallback(() => {
    const s = JSON.parse(JSON.stringify(mysterySettingsObj)) as IMysterySettings;
    if (!s.tts) s.tts = {};
    if (!s.tts.voice_maps) s.tts.voice_maps = {};
    const mode = s.tts.voice_map_active === 'live' ? 'live' : 'google';
    if (!s.tts.voice_maps[mode]) s.tts.voice_maps[mode] = { voice_map: {}, voice_map_locks: [] };
    if (!s.tts.voice_maps[mode].voice_map) s.tts.voice_maps[mode].voice_map = {};
    let changed = false;
    masterCharacters.forEach(c => {
      const prefix = c.is_law_enforcement ? 'sheriff_' : 'suspect_';
      const fullKey = prefix + c.slug;
      if (!s.tts!.voice_maps![mode].voice_map[fullKey]) {
        s.tts!.voice_maps![mode].voice_map[fullKey] = {
          voice_name: '',
          language_code: s.tts!.language_code || 'en-US'
        };
        changed = true;
      }
    });
    if (changed) {
      updateDraft(s);
    }
  }, [mysterySettingsObj, masterCharacters, updateDraft]);
  const autoAssignVoiceMapBestMatchAndSave = React.useCallback(async () => {
    const s = JSON.parse(JSON.stringify(mysterySettingsObj)) as IMysterySettings;
    if (!s.tts) s.tts = {};
    if (!s.tts.voice_maps) s.tts.voice_maps = {};
    const mode = s.tts.voice_map_active === 'live' ? 'live' : 'google';
    if (!s.tts.voice_maps[mode]) s.tts.voice_maps[mode] = { voice_map: {}, voice_map_locks: [] };
    if (!s.tts.voice_maps[mode].voice_map) s.tts.voice_maps[mode].voice_map = {};
    const locks = (s.tts.voice_maps[mode].voice_map_locks || []) as string[];
    let changed = false;
    masterCharacters.forEach(c => {
      const prefix = c.is_law_enforcement ? 'sheriff_' : 'suspect_';
      const fullKey = prefix + c.slug;
      if (locks.includes(fullKey)) return;
      const sync = s.ai_model_sync?.voice_ids?.[fullKey];
      if (sync?.foundation_id) {
        if (mode === 'live') {
          s.tts.voice_maps[mode].voice_map[fullKey] = {
            voice_name: 'Gemini 2.0 Flash',
            language_code: s.tts.language_code || 'en-US'
          };
        } else {
          s.tts.voice_maps[mode].voice_map[fullKey] = {
            voice_name: 'en-US-Studio-O',
            language_code: s.tts.language_code || 'en-US'
          };
        }
        changed = true;
      }
    });
    if (changed) {
      updateDraft(s);
    }
  }, [mysterySettingsObj, masterCharacters, updateDraft]);
  return { ttsVoices, setTtsVoices, ttsVoicesError, setTtsVoicesError, ttsVoicesLoadedAt, setTtsVoicesLoadedAt, agentProfiles, setAgentProfiles, agentProfilesError, setAgentProfilesError, agentProfilesLoadedAt, setAgentProfilesLoadedAt, voiceMapRowIds, voiceIdToCharacters, voiceIdSuggestions, getActiveVoiceMap, loadTtsVoices, loadAgentProfiles, addVoiceMapEntry, addMissingVoiceIdsFromCharacters, autoAssignVoiceMapBestMatchAndSave, deleteVoiceMapEntry, toggleVoiceMapLock, updateVoiceMapEntry };
}
