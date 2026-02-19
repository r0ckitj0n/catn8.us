import React, { useState, useRef } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { GeminiProvider } from '../../../core/ai/GeminiProvider';

import { IScenarioEntity, InterrogationStatus } from '../../../types/game';
import { IToast } from '../../../types/common';
import { GeminiLiveClient } from '../../../core/GeminiLiveClient';

export function useGeminiLiveSession({
  type,
  scenarioId,
  caseId,
  showVoiceToast,
  showMysteryToast,
  getActiveVoiceMapProvider,
  setScenarioEntities,
  setBusy,
  setError,
  setMessage
}: {
  type: 'sheriff' | 'csi';
  scenarioId: string;
  caseId: string;
  showVoiceToast: (t: IToast) => void;
  showMysteryToast: (t: IToast) => void;
  getActiveVoiceMapProvider: () => 'google' | 'live';
  setScenarioEntities: (entities: IScenarioEntity[]) => void;
  setBusy: (busy: boolean) => void;
  setError: (err: string) => void;
  setMessage: (msg: string) => void;
}) {
  const [model, setModel] = React.useState('');
  const [tokenName, setTokenName] = React.useState('');
  const [entityId, setEntityId] = React.useState(0);
  const [systemInstruction, setSystemInstruction] = React.useState('');
  const [status, setStatus] = useState<InterrogationStatus>('idle');
  const [inputText, setInputText] = React.useState('');
  const [outputText, setOutputText] = React.useState('');
  const [name, setName] = React.useState(type === 'sheriff' ? 'Sheriff' : 'CSI Detective');

  const clientRef = useRef<GeminiLiveClient | null>(null);
  const lastInputRef = React.useRef('');
  const lastOutputRef = React.useRef('');

  const stopStreaming = React.useCallback(async () => {
    const client = clientRef.current;
    clientRef.current = null;
    if (client) {
      console.log(`useGeminiLiveSession(${type}): Disconnecting client`);
      try {
        await client.disconnect();
      } catch (e: any) {
        showVoiceToast({ tone: 'error', title: `${type === 'sheriff' ? 'Sheriff' : 'CSI'} Live`, message: e?.message || 'Failed to stop streaming' });
      }
    }
    setStatus('idle');
    setInputText('');
    setOutputText('');
  }, [type, showVoiceToast]);

  React.useEffect(() => {
    return () => {
      if (clientRef.current) {
        console.log(`useGeminiLiveSession(${type}): Component unmounting, cleaning up client`);
        void clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [type]);

  const startSession = React.useCallback(async () => {
    if (getActiveVoiceMapProvider() !== 'live') {
      showVoiceToast({ tone: 'info', title: `${type === 'sheriff' ? 'Sheriff' : 'CSI'} Live`, message: 'Active voice provider is Google TTS. Switch Communications → Active voice map to Gemini Live to use Live streaming.' });
      return;
    }
    const sid = Number(scenarioId);
    if (!sid) {
      showMysteryToast({ tone: 'error', message: 'Select a scenario first.' });
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await stopStreaming();

      await ApiClient.post('/api/mystery/admin.php?action=ensure_default_scenario_for_case', {
        case_id: Number(caseId) || 0,
        scenario_id: sid,
        min_suspects: 8,
      });

      const seRes = await ApiClient.get<{ scenario_entities: IScenarioEntity[] }>('/api/mystery/admin.php?action=list_scenario_entities&scenario_id=' + String(sid));
      const seList = Array.isArray(seRes?.scenario_entities) ? seRes.scenario_entities : [];
      setScenarioEntities(seList);

      const endpoint = type === 'sheriff' ? 'sheriff_live_bootstrap.php' : 'csi_live_bootstrap.php';
      const res = await ApiClient.get<{ model: string, entity_id: number, token: { name: string }, system_instruction: string }>(`/api/mystery/${endpoint}?scenario_id=${sid}`);
      
      const m = String(res?.model || '').trim();
      const eid = Number(res?.entity_id || 0);
      const tn = String(res?.token?.name || '').trim();
      const sys = String(res?.system_instruction || '');

      if (!eid) throw new Error(`${type === 'sheriff' ? 'Sheriff' : 'CSI Detective'} is not attached to this scenario`);
      if (!tn) throw new Error('Live bootstrap succeeded but token name was missing');

      setModel(m);
      setTokenName(tn);
      setEntityId(eid);
      setSystemInstruction(sys);
      
      const entity = seList.find((e) => e.entity_id === eid);
      if (entity) setName(entity.entity_name);

      lastInputRef.current = '';
      lastOutputRef.current = '';
      setInputText('');
      setOutputText('');

      await ApiClient.post('/api/mystery/conversation_log.php', {
        scenario_id: sid,
        entity_id: eid,
        channel: `${type}_live`,
        provider: 'gemini_live',
        role: 'system',
        content_text: `${type === 'sheriff' ? 'Sheriff' : 'CSI'} Live session prepared.`,
        meta: { model: m, token_name: tn },
      });
      setMessage(`${type === 'sheriff' ? 'Sheriff' : 'CSI'} Live session prepared.`);
    } catch (e: any) {
      showVoiceToast({ tone: 'error', title: `${type === 'sheriff' ? 'Sheriff' : 'CSI'} Live`, message: e?.message || 'Failed to prepare session' });
    } finally {
      setBusy(false);
    }
  }, [type, scenarioId, caseId, getActiveVoiceMapProvider, showVoiceToast, showMysteryToast, setScenarioEntities, stopStreaming, setBusy, setMessage]);

  const startStreaming = React.useCallback(async () => {
    if (getActiveVoiceMapProvider() !== 'live') return;
    const sid = Number(scenarioId);
    if (!sid || !tokenName) return;

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await stopStreaming();
      setStatus('connecting');

      const client = GeminiProvider.createLiveClient({
        tokenName,
        model,
        systemInstruction,
        onState: (s: any) => {
          const st = (s?.status || '') as InterrogationStatus;
          if (st) setStatus(st);
        },
        onTranscript: async (t: any) => {
          const kind = String(t?.kind || '').trim();
          const text = String(t?.text || '').trim();
          if (!text) return;

          if (kind === 'input') {
            if (text === lastInputRef.current) return;
            lastInputRef.current = text;
            setInputText(text);
          } else if (kind === 'output') {
            if (text === lastOutputRef.current) return;
            lastOutputRef.current = text;
            setOutputText(text);
          }

          try {
            await ApiClient.post('/api/mystery/conversation_log.php', {
              scenario_id: sid,
              entity_id: entityId > 0 ? entityId : 0,
              channel: `${type}_live`,
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
          showVoiceToast({ tone: 'error', title: `${type === 'sheriff' ? 'Sheriff' : 'CSI'} Live`, message: err?.message || 'Streaming error' });
          setStatus('idle');
        },
      });

      clientRef.current = client;
      await client.connect();
      setMessage(`${type === 'sheriff' ? 'Sheriff' : 'CSI'} Live streaming started.`);
    } catch (e: any) {
      showVoiceToast({ tone: 'error', title: `${type === 'sheriff' ? 'Sheriff' : 'CSI'} Live`, message: e?.message || 'Failed to start streaming' });
      setStatus('idle');
    } finally {
      setBusy(false);
    }
  }, [type, scenarioId, tokenName, model, systemInstruction, entityId, getActiveVoiceMapProvider, showVoiceToast, stopStreaming, setBusy, setError, setMessage]);

  const returnValue = React.useMemo(() => ({
    status, setStatus,
    inputText, setInputText,
    outputText, setOutputText,
    name,
    startSession,
    startStreaming,
    stopStreaming
  }), [
    status, setStatus,
    inputText, setInputText,
    outputText, setOutputText,
    name,
    startSession,
    startStreaming,
    stopStreaming
  ]);

  return returnValue;
}
