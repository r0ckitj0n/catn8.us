import React from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { catn8LocalStorageGet, catn8LocalStorageSet } from '../../../utils/storageUtils';
import { formatTestResult } from '../../../utils/textUtils';
import { IToast } from '../../../types/common';
import { buildAiVoiceSnapshot } from './aiVoiceSnapshot';
const LS_VOICE_GCP = 'catn8.last_test.ai_voice.gcp_service_account';
const LS_VOICE_GEMINI_TOKEN = 'catn8.last_test.ai_voice.gemini_live_token';
export function useAIVoiceCommunication(open: boolean, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const cleanSnapshotRef = React.useRef('');
  const [lastGcpServiceAccountTest, setLastGcpServiceAccountTest] = React.useState('');
  const [lastGeminiLiveTokenTest, setLastGeminiLiveTokenTest] = React.useState('');
  const [ttsVoiceMapActive, setTtsVoiceMapActive] = React.useState('google');
  const [ttsOutputFormat, setTtsOutputFormat] = React.useState('mp3');
  const [ttsLanguageCode, setTtsLanguageCode] = React.useState('en-US');
  const [ttsVoiceName, setTtsVoiceName] = React.useState('');
  const [ttsSpeakingRate, setTtsSpeakingRate] = React.useState(1.0);
  const [ttsPitch, setTtsPitch] = React.useState(0.0);
  const [hasMysteryServiceAccount, setHasMysteryServiceAccount] = React.useState(0);
  const [hasMysteryGeminiKey, setHasMysteryGeminiKey] = React.useState(0);
  const [mysteryServiceAccountJson, setMysteryServiceAccountJson] = React.useState('');
  const [mysteryGeminiApiKey, setMysteryGeminiApiKey] = React.useState('');
  const [mysteryGeminiKeyName, setMysteryGeminiKeyName] = React.useState('');
  const [mysteryGeminiProjectName, setMysteryGeminiProjectName] = React.useState('');
  const [mysteryGeminiProjectNumber, setMysteryGeminiProjectNumber] = React.useState('');
  const buildSnapshot = React.useCallback(() => {
    return buildAiVoiceSnapshot({
      mysteryGeminiKeyName,
      mysteryGeminiProjectName,
      mysteryGeminiProjectNumber,
      ttsVoiceMapActive,
      ttsOutputFormat,
      ttsLanguageCode,
      ttsVoiceName,
      ttsSpeakingRate,
      ttsPitch,
    });
  }, [mysteryGeminiKeyName, mysteryGeminiProjectName, mysteryGeminiProjectNumber, ttsVoiceMapActive, ttsOutputFormat, ttsLanguageCode, ttsVoiceName, ttsSpeakingRate, ttsPitch]);
  React.useEffect(() => {
    if (!open) return;
    setBusy(true);
    setError('');
    setMessage('');
    setLastGcpServiceAccountTest(catn8LocalStorageGet(LS_VOICE_GCP));
    setLastGeminiLiveTokenTest(catn8LocalStorageGet(LS_VOICE_GEMINI_TOKEN));
    setMysteryServiceAccountJson('');
    setMysteryGeminiApiKey('');
    Promise.all([
      ApiClient.get('/api/settings/mystery_gcp.php'),
      ApiClient.get('/api/settings/mystery_gemini.php'),
      ApiClient.get('/api/settings/mystery_tts_defaults.php'),
    ])
      .then(([resGcp, resGemini, resTtsDefaults]) => {
        setHasMysteryServiceAccount(Number(resGcp?.has_service_account_json || 0));
        setHasMysteryGeminiKey(Number(resGemini?.has_api_key || 0));
        const td = (resTtsDefaults?.tts_defaults && typeof resTtsDefaults.tts_defaults === 'object') ? resTtsDefaults.tts_defaults : {};
        setTtsVoiceMapActive(String(td?.voice_map_active || 'google'));
        setTtsOutputFormat(String(td?.output_format || 'mp3'));
        setTtsLanguageCode(String(td?.language_code || 'en-US'));
        setTtsVoiceName(String(td?.voice_name || ''));
        const sr = td?.speaking_rate;
        setTtsSpeakingRate(typeof sr === 'number' ? sr : Number(sr || 1.0));
        const p = td?.pitch;
        setTtsPitch(typeof p === 'number' ? p : Number(p || 0.0));
        const kn = String(resGemini?.key_name || '');
        const pn = String(resGemini?.project_name || '');
        const pnum = String(resGemini?.project_number || '');
        setMysteryGeminiKeyName(kn);
        setMysteryGeminiProjectName(pn);
        setMysteryGeminiProjectNumber(pnum);
        cleanSnapshotRef.current = buildAiVoiceSnapshot({
          mysteryGeminiKeyName: kn,
          mysteryGeminiProjectName: pn,
          mysteryGeminiProjectNumber: pnum,
          ttsVoiceMapActive: String(td?.voice_map_active || 'google'),
          ttsOutputFormat: String(td?.output_format || 'mp3'),
          ttsLanguageCode: String(td?.language_code || 'en-US'),
          ttsVoiceName: String(td?.voice_name || ''),
          ttsSpeakingRate: typeof sr === 'number' ? sr : Number(sr || 1.0),
          ttsPitch: typeof p === 'number' ? p : Number(p || 0.0),
        });
      })
      .catch((e) => setError(e?.message || 'Failed to load voice configuration'))
      .finally(() => setBusy(false));
  }, [open]);
  React.useEffect(() => {
    if (error && onToast) {
      onToast({ tone: 'error', message: error });
      setError('');
    }
  }, [error, onToast]);
  React.useEffect(() => {
    if (message && onToast) {
      onToast({ tone: 'success', message: message });
      setMessage('');
    }
  }, [message, onToast]);
  const isDirty = React.useMemo(() => {
    return cleanSnapshotRef.current !== buildSnapshot();
  }, [buildSnapshot]);
  const testGeminiLiveToken = async () => {
    setLastGeminiLiveTokenTest('Running…');
    setBusy(true);
    try {
      const res = await ApiClient.get('/api/mystery/gemini_ephemeral_token.php');
      const tokenName = String(res?.token?.name || '').trim();
      if (!tokenName) throw new Error('Response missing token name');
      const next = formatTestResult('success', tokenName);
      setLastGeminiLiveTokenTest(next);
      catn8LocalStorageSet(LS_VOICE_GEMINI_TOKEN, next);
      setMessage('Gemini Live token OK: ' + tokenName);
    } catch (e: any) {
      const next = formatTestResult('failure', String(e?.message || 'Failed'));
      setLastGeminiLiveTokenTest(next);
      catn8LocalStorageSet(LS_VOICE_GEMINI_TOKEN, next);
      setError(e?.message || 'Failed to request Gemini Live token');
    } finally {
      setBusy(false);
    }
  };
  const testMysteryGcpServiceAccount = async () => {
    setLastGcpServiceAccountTest('Running…');
    setBusy(true);
    try {
      const res = await ApiClient.get('/api/settings/mystery_gcp_test.php?mode=service_account');
      const next = formatTestResult('success', `HTTP ${res?.http_status}, voices: ${res?.voice_count}`);
      setLastGcpServiceAccountTest(next);
      catn8LocalStorageSet(LS_VOICE_GCP, next);
      setMessage('GCP service account OK');
    } catch (e: any) {
      const next = formatTestResult('failure', String(e?.message || 'Failed'));
      setLastGcpServiceAccountTest(next);
      catn8LocalStorageSet(LS_VOICE_GCP, next);
      setError(e?.message || 'Failed to test GCP service account');
    } finally {
      setBusy(false);
    }
  };
  const save = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setBusy(true);
    try {
      const geminiPayload: any = {};
      if (mysteryGeminiApiKey.trim()) geminiPayload.api_key = mysteryGeminiApiKey;
      if (mysteryGeminiKeyName.trim()) geminiPayload.key_name = mysteryGeminiKeyName;
      if (mysteryGeminiProjectName.trim()) geminiPayload.project_name = mysteryGeminiProjectName;
      if (mysteryGeminiProjectNumber.trim()) geminiPayload.project_number = mysteryGeminiProjectNumber;
      const [resGcp, resGemini] = await Promise.all([
        mysteryServiceAccountJson.trim() ? ApiClient.post('/api/settings/mystery_gcp.php', { service_account_json: mysteryServiceAccountJson }) : Promise.resolve(null),
        Object.keys(geminiPayload).length > 0 ? ApiClient.post('/api/settings/mystery_gemini.php', geminiPayload) : Promise.resolve(null),
      ]);
      const resTtsDefaults = await ApiClient.post('/api/settings/mystery_tts_defaults.php', {
        voice_map_active: ttsVoiceMapActive,
        output_format: ttsOutputFormat,
        language_code: ttsLanguageCode,
        voice_name: ttsVoiceName,
        speaking_rate: Number(ttsSpeakingRate),
        pitch: Number(ttsPitch),
      });
      if (resGcp) setHasMysteryServiceAccount(Number(resGcp?.has_service_account_json || 0));
      if (resGemini) {
        setHasMysteryGeminiKey(Number(resGemini?.has_api_key || 0));
        setMysteryGeminiKeyName(String(resGemini?.key_name || ''));
        setMysteryGeminiProjectName(String(resGemini?.project_name || ''));
        setMysteryGeminiProjectNumber(String(resGemini?.project_number || ''));
      }
      setMysteryServiceAccountJson('');
      setMysteryGeminiApiKey('');
      const td = resTtsDefaults?.tts_defaults || {};
      setTtsVoiceMapActive(String(td?.voice_map_active || 'google'));
      setTtsOutputFormat(String(td?.output_format || 'mp3'));
      setTtsLanguageCode(String(td?.language_code || 'en-US'));
      setTtsVoiceName(String(td?.voice_name || ''));
      setTtsSpeakingRate(Number(td?.speaking_rate ?? 1.0));
      setTtsPitch(Number(td?.pitch ?? 0.0));
      cleanSnapshotRef.current = buildAiVoiceSnapshot({
        mysteryGeminiKeyName: String(resGemini?.key_name || mysteryGeminiKeyName || ''),
        mysteryGeminiProjectName: String(resGemini?.project_name || mysteryGeminiProjectName || ''),
        mysteryGeminiProjectNumber: String(resGemini?.project_number || mysteryGeminiProjectNumber || ''),
        ttsVoiceMapActive: String(td?.voice_map_active || 'google'),
        ttsOutputFormat: String(td?.output_format || 'mp3'),
        ttsLanguageCode: String(td?.language_code || 'en-US'),
        ttsVoiceName: String(td?.voice_name || ''),
        ttsSpeakingRate: Number(td?.speaking_rate ?? 1.0),
        ttsPitch: Number(td?.pitch ?? 0.0),
      });
      setMessage('Saved.');
    } catch (err: any) {
      setError(err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };
  return {
    busy, isDirty,
    ttsVoiceMapActive, setTtsVoiceMapActive,
    ttsOutputFormat, setTtsOutputFormat,
    ttsLanguageCode, setTtsLanguageCode,
    ttsVoiceName, setTtsVoiceName,
    ttsSpeakingRate, setTtsSpeakingRate,
    ttsPitch, setTtsPitch,
    hasMysteryServiceAccount, hasMysteryGeminiKey,
    mysteryServiceAccountJson, setMysteryServiceAccountJson,
    mysteryGeminiApiKey, setMysteryGeminiApiKey,
    mysteryGeminiKeyName, setMysteryGeminiKeyName,
    mysteryGeminiProjectName, setMysteryGeminiProjectName,
    mysteryGeminiProjectNumber, setMysteryGeminiProjectNumber,
    lastGcpServiceAccountTest, lastGeminiLiveTokenTest,
    testGeminiLiveToken, testMysteryGcpServiceAccount, save
  };
}
