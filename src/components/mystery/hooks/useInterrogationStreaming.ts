import React from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { GeminiProvider } from '../../../core/ai/GeminiProvider';
import { GeminiLiveClient } from '../../../core/GeminiLiveClient';
import { InterrogationStatus } from '../../../types/game';
import { IToast } from '../../../types/common';

export function useInterrogationStreaming({
  scenarioId,
  interrogationEntityId,
  showVoiceToast,
  setError,
  setInterrogationStatus,
  setInterrogationInputText,
  setInterrogationOutputText
}: {
  scenarioId: string;
  interrogationEntityId: number;
  showVoiceToast: (t: IToast) => void;
  setError: (err: string) => void;
  setInterrogationStatus: (status: InterrogationStatus) => void;
  setInterrogationInputText: (text: string) => void;
  setInterrogationOutputText: (text: string) => void;
}) {
  const interrogationClientRef = React.useRef<GeminiLiveClient | null>(null);
  const interrogationLastInputRef = React.useRef('');
  const interrogationLastOutputRef = React.useRef('');

  const stopInterrogationStreaming = React.useCallback(async () => {
    const client = interrogationClientRef.current;
    interrogationClientRef.current = null;
    if (client) {
      try {
        await client.disconnect();
      } catch (e: any) {
        setError(e?.message || 'Failed to stop interrogation');
      }
    }
    setInterrogationStatus('idle');
  }, [setError, setInterrogationStatus]);

  const ensureInterrogationLiveClient = React.useCallback(async ({ enableMic }: { enableMic: boolean }) => {
    const sid = Number(scenarioId);
    const eid = Number(interrogationEntityId);
    if (!sid || !eid) {
      throw new Error('Select a scenario and suspect first.');
    }

    const existing = interrogationClientRef.current;
    if (existing) return existing;

    setInterrogationStatus('connecting');

    const res = await ApiClient.get(
      '/api/mystery/entity_live_bootstrap.php?scenario_id=' + String(sid) + '&entity_id=' + String(eid)
    );
    const model = String(res?.model || '').trim();
    const tokenName = String(res?.token?.name || '').trim();
    const sys = String(res?.system_instruction || '');
    if (!tokenName) {
      throw new Error('Interrogation bootstrap succeeded but token name was missing');
    }

    interrogationLastInputRef.current = '';
    interrogationLastOutputRef.current = '';
    setInterrogationInputText('');
    setInterrogationOutputText('');

    const client = GeminiProvider.createLiveClient({
      tokenName,
      model,
      systemInstruction: sys,
      enableMic: Boolean(enableMic),
      onState: (s: any) => {
        const st = (s?.status || '') as InterrogationStatus;
        if (st) setInterrogationStatus(st);
      },
      onTranscript: async (t: any) => {
        const kind = String(t?.kind || '').trim();
        const text = String(t?.text || '').trim();
        if (!text) return;

        if (kind === 'input') {
          if (text === interrogationLastInputRef.current) return;
          interrogationLastInputRef.current = text;
          setInterrogationInputText(text);
        } else if (kind === 'output') {
          if (text === interrogationLastOutputRef.current) return;
          interrogationLastOutputRef.current = text;
          setInterrogationOutputText(text);
        }

        try {
          await ApiClient.post('/api/mystery/conversation_log.php', {
            scenario_id: sid,
            entity_id: eid,
            channel: 'suspect_live',
            provider: 'gemini_live',
            role: kind === 'input' ? 'user' : 'assistant',
            content_text: text,
            meta: { transcript_kind: kind },
          });
        } catch (err: any) {
          setError(err?.message || 'Failed to write transcript event');
        }
      },
      onError: (err: any) => {
        showVoiceToast({ tone: 'error', title: 'Voice talk', message: err?.message || 'Interrogation streaming error' });
        setInterrogationStatus('idle');
      },
    });

    interrogationClientRef.current = client;
    await client.connect();
    return client;
  }, [interrogationEntityId, scenarioId, showVoiceToast, setError, setInterrogationStatus, setInterrogationInputText, setInterrogationOutputText]);

  React.useEffect(() => {
    return () => {
      if (interrogationClientRef.current) {
        console.log("useInterrogationStreaming: Component unmounting, cleaning up client");
        void interrogationClientRef.current.disconnect();
        interrogationClientRef.current = null;
      }
    };
  }, []);

  return React.useMemo(() => ({
    stopInterrogationStreaming,
    ensureInterrogationLiveClient,
    interrogationClientRef
  }), [stopInterrogationStreaming, ensureInterrogationLiveClient]);
}
