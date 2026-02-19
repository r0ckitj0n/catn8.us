import React from 'react';
import { useInterrogationImages } from './useInterrogationImages';
import { useInterrogationStreaming } from './useInterrogationStreaming';
import { useInterrogationActions } from './useInterrogationActions';

/**
 * useInterrogation - Refactored Conductor Hook
 * COMPLIANCE: File size < 250 lines
 */
import { IConversationEvent, InterrogationStatus } from '../../../types/game';
import { IToast } from '../../../types/common';

export function useInterrogation({
  scenarioId,
  showVoiceToast,
  getActiveVoiceMapProvider,
  interviewTtsEnabled,
  loadConversationEvents,
  setError,
  setMessage,
  setBusy
}: {
  scenarioId: string;
  showVoiceToast: (t: IToast) => void;
  getActiveVoiceMapProvider: () => 'google' | 'live';
  interviewTtsEnabled: boolean;
  loadConversationEvents: (opts?: { silent: boolean }) => Promise<void>;
  setError: (err: string) => void;
  setMessage: (msg: string) => void;
  setBusy: (busy: boolean) => void;
}) {
  const [interrogationEntityId, setInterrogationEntityId] = React.useState(0);
  const [interrogationEntityName, setInterrogationEntityName] = React.useState('');
  const [interrogationAgentId, setInterrogationAgentId] = React.useState(0);
  const [interrogationStatus, setInterrogationStatus] = React.useState<InterrogationStatus>('idle');
  const [interrogationInputText, setInterrogationInputText] = React.useState('');
  const [interrogationOutputText, setInterrogationOutputText] = React.useState('');

  // 1. Image Logic
  const images = useInterrogationImages(interrogationAgentId);

  // 2. Streaming Logic
  const streaming = useInterrogationStreaming({
    scenarioId,
    interrogationEntityId,
    showVoiceToast,
    setError,
    setInterrogationStatus: (s: InterrogationStatus) => setInterrogationStatus(s),
    setInterrogationInputText,
    setInterrogationOutputText
  });

  // 3. Actions Logic
  const actions = useInterrogationActions({
    scenarioId,
    interrogationEntityId,
    interviewTtsEnabled,
    loadConversationEvents,
    getActiveVoiceMapProvider,
    ensureInterrogationLiveClient: streaming.ensureInterrogationLiveClient,
    showVoiceToast,
    setError,
    setBusy,
    setMessage,
    setInterrogationInputText,
    setInterrogationOutputText
  });

  const startInterrogationStreaming = async () => {
    if (getActiveVoiceMapProvider() !== 'live') {
      showVoiceToast({ tone: 'info', title: 'Voice talk', message: 'Active voice provider is Google TTS. Switch Communications → Active voice map to Gemini Live to use Live streaming.' });
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await streaming.stopInterrogationStreaming();
      await streaming.ensureInterrogationLiveClient({ enableMic: true });
      setMessage('Interrogation started.');
    } catch (e: any) {
      showVoiceToast({ tone: 'error', title: 'Voice talk', message: e?.message || 'Failed to start interrogation' });
      setInterrogationStatus('idle');
    } finally {
      setBusy(false);
    }
  };

  const returnValue = React.useMemo(() => ({
    interrogationEntityId, setInterrogationEntityId,
    interrogationEntityName, setInterrogationEntityName,
    interrogationAgentId, setInterrogationAgentId,
    interrogationStatus, setInterrogationStatus,
    interrogationInputText, setInterrogationInputText,
    interrogationOutputText, setInterrogationOutputText,
    ...images,
    ...actions,
    stopInterrogationStreaming: streaming.stopInterrogationStreaming,
    startInterrogationStreaming
  }), [
    interrogationEntityId, interrogationEntityName, interrogationAgentId,
    interrogationStatus, interrogationInputText, interrogationOutputText,
    images, actions, streaming
  ]);

  return returnValue;
}
