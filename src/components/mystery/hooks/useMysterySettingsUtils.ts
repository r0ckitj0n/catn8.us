import React from 'react';
import { IMysterySettings } from '../../../types/game';

export function useMysterySettingsUtils() {
  const countVoiceMapVoiceNames = React.useCallback((settings: IMysterySettings) => {
    const tts = (settings?.tts && typeof settings.tts === 'object') ? settings.tts : {};
    const legacy = (tts.voice_map && typeof tts.voice_map === 'object') ? (tts.voice_map as Record<string, any>) : {};
    const maps = (tts.voice_maps && typeof tts.voice_maps === 'object') ? tts.voice_maps : {};
    const google = (maps.google && typeof maps.google === 'object' && maps.google.voice_map && typeof maps.google.voice_map === 'object') ? maps.google.voice_map : {};
    const live = (maps.live && typeof maps.live === 'object' && maps.live.voice_map && typeof maps.live.voice_map === 'object') ? maps.live.voice_map : {};

    const all = [legacy, google, live];
    let count = 0;
    for (const vm of all) {
      for (const k of Object.keys(vm)) {
        const entry = vm[k];
        const vn = (entry && typeof entry === 'object') ? String(entry.voice_name || '').trim() : '';
        if (vn) count += 1;
      }
    }
    return count;
  }, []);

  const ensureAiModelSync = React.useCallback((s: IMysterySettings) => {
    if (!s.ai_model_sync || typeof s.ai_model_sync !== 'object') s.ai_model_sync = {};
    const sync = s.ai_model_sync;
    if (!sync.voice_ids || typeof sync.voice_ids !== 'object') sync.voice_ids = {};
    if (!sync.foundations || typeof sync.foundations !== 'object') sync.foundations = {};
    if (!sync.locks || typeof sync.locks !== 'object') sync.locks = {};
    if (!sync.foundation_locks || typeof sync.foundation_locks !== 'object') sync.foundation_locks = {};
    return sync;
  }, []);

  const ensureTtsVoiceMaps = React.useCallback((s: IMysterySettings) => {
    if (!s || typeof s !== 'object') return s;
    if (!s.tts || typeof s.tts !== 'object') s.tts = {};
    const tts: any = s.tts;
    if (!tts.voice_maps || typeof tts.voice_maps !== 'object') tts.voice_maps = {};
    if (!tts.voice_maps.google || typeof tts.voice_maps.google !== 'object') tts.voice_maps.google = {};
    if (!tts.voice_maps.live || typeof tts.voice_maps.live !== 'object') tts.voice_maps.live = {};
    if (!tts.voice_maps.google.voice_map || typeof tts.voice_maps.google.voice_map !== 'object') tts.voice_maps.google.voice_map = {};
    if (!tts.voice_maps.google.voice_map_locks || typeof tts.voice_maps.google.voice_map_locks !== 'object') tts.voice_maps.google.voice_map_locks = {};
    if (!tts.voice_maps.live.voice_map || typeof tts.voice_maps.live.voice_map !== 'object') tts.voice_maps.live.voice_map = {};
    if (!tts.voice_maps.live.voice_map_locks || typeof tts.voice_maps.live.voice_map_locks !== 'object') tts.voice_maps.live.voice_map_locks = {};

    const active = String(tts.voice_map_active || '').trim().toLowerCase();
    if (active !== 'google' && active !== 'live') {
      tts.voice_map_active = 'google';
    }
    return s;
  }, []);

  const stableHashInt = React.useCallback((raw: unknown) => {
    const s = String(raw || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }, []);

  return React.useMemo(() => ({
    countVoiceMapVoiceNames,
    ensureAiModelSync,
    ensureTtsVoiceMaps,
    stableHashInt
  }), [countVoiceMapVoiceNames, ensureAiModelSync, ensureTtsVoiceMaps, stableHashInt]);
}
