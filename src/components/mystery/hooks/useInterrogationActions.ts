import React from 'react';
import { ApiClient } from '../../../core/ApiClient';

import { IToast } from '../../../types/common';
import { GeminiLiveClient } from '../../../core/GeminiLiveClient';

export function useInterrogationActions({
  scenarioId,
  interrogationEntityId,
  interviewTtsEnabled,
  loadConversationEvents,
  getActiveVoiceMapProvider,
  ensureInterrogationLiveClient,
  showVoiceToast,
  setError,
  setBusy,
  setMessage,
  setInterrogationInputText,
  setInterrogationOutputText
}: {
  scenarioId: string;
  interrogationEntityId: number;
  interviewTtsEnabled: boolean;
  loadConversationEvents: (opts?: { silent: boolean }) => Promise<void>;
  getActiveVoiceMapProvider: () => 'google' | 'live';
  ensureInterrogationLiveClient: (opts: { enableMic: boolean }) => Promise<GeminiLiveClient>;
  showVoiceToast: (t: IToast) => void;
  setError: (err: string) => void;
  setBusy: (busy: boolean) => void;
  setMessage: (msg: string) => void;
  setInterrogationInputText: (text: string) => void;
  setInterrogationOutputText: (text: string) => void;
}) {
  const [interrogationTypedQuestion, setInterrogationTypedQuestion] = React.useState('');
  const [interrogationTypedAudioUrl, setInterrogationTypedAudioUrl] = React.useState('');
  const interrogationTypedAudioRef = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => {
    if (!interrogationTypedAudioUrl) return;
    const el = interrogationTypedAudioRef.current;
    if (!el) return;
    try {
      el.pause();
      el.currentTime = 0;
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_err) {}
  }, [interrogationTypedAudioUrl]);

  const askInterrogationTyped = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const sid = Number(scenarioId);
    const eid = Number(interrogationEntityId);
    const q = interrogationTypedQuestion.trim();

    if (!sid || !eid || !q) {
      setError('Select a scenario and suspect first, then type a question.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    setInterrogationTypedAudioUrl('');

    try {
      if (getActiveVoiceMapProvider() === 'live') {
        try {
          const client = await ensureInterrogationLiveClient({ enableMic: false });
          setInterrogationInputText(q);
          setInterrogationTypedQuestion('');
          await ApiClient.post('/api/mystery/conversation_log.php', {
            scenario_id: sid,
            entity_id: eid,
            channel: 'suspect_live',
            provider: 'gemini_live',
            role: 'user',
            content_text: q,
            meta: { transcript_kind: 'typed' },
          });
          client.sendTextTurn(q);
          setMessage('Live question sent.');
          return;
        } catch (liveErr: any) {
          showVoiceToast({ tone: 'error', title: 'Interrogation', message: liveErr?.message || 'Gemini Live failed; falling back to text.' });
        }
      }

      const res = await ApiClient.post('/api/mystery/interrogate.php', {
        scenario_id: sid,
        entity_id: eid,
        question_text: q,
        tts_enabled: interviewTtsEnabled ? 1 : 0,
      });

      const answer = String(res?.answer_text || '');
      const audioUrl = (interviewTtsEnabled && !res?.meta?.tts_error) ? String(res?.audio_url || '') : '';

      setInterrogationInputText(q);
      setInterrogationOutputText(answer);
      setInterrogationTypedAudioUrl(audioUrl);
      setInterrogationTypedQuestion('');

      await loadConversationEvents({ silent: true });
      setMessage(res?.meta?.tts_error ? 'Interrogation recorded (text only).' : 'Interrogation recorded.');
    } catch (err: any) {
      setError(err?.message || 'Failed to interrogate suspect');
    } finally {
      setBusy(false);
    }
  }, [scenarioId, interrogationEntityId, interrogationTypedQuestion, interviewTtsEnabled, loadConversationEvents, getActiveVoiceMapProvider, ensureInterrogationLiveClient, showVoiceToast, setError, setBusy, setMessage, setInterrogationInputText, setInterrogationOutputText]);

  const returnValue = React.useMemo(() => ({
    interrogationTypedQuestion, setInterrogationTypedQuestion,
    interrogationTypedAudioUrl, setInterrogationTypedAudioUrl,
    interrogationTypedAudioRef,
    askInterrogationTyped
  }), [
    interrogationTypedQuestion, interrogationTypedAudioUrl, askInterrogationTyped
  ]);

  return returnValue;
}
