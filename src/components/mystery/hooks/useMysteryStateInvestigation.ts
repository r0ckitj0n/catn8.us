import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IConversationEvent, IRapSheet } from '../../../types/game';
import { IMysteryStateInvestigation } from '../../../types/mysteryHooks';

export function useMysteryStateInvestigation(
  scenarioId: string,
  setError: (err: string) => void
): IMysteryStateInvestigation {
  const [rapSheet, setRapSheet] = useState<IRapSheet | null>(null);
  const [rapSheetBusy, setRapSheetBusy] = React.useState(false);
  const [rapSheetError, setRapSheetError] = React.useState('');

  const [conversationEvents, setConversationEvents] = useState<IConversationEvent[]>([]);
  const [conversationEventsBusy, setConversationEventsBusy] = React.useState(false);
  const [conversationEventsError, setConversationEventsError] = React.useState('');

  const loadRapSheet = React.useCallback(async (sid: string | number, eid: string | number) => {
    const scenario = Number(sid);
    const entity = Number(eid);
    if (!scenario || !entity) {
      setRapSheet(null);
      setRapSheetError('Select a scenario and suspect first.');
      return;
    }
    setRapSheetBusy(true);
    setRapSheetError('');
    try {
      const res = await ApiClient.get(`/api/mystery/rap_sheet.php?scenario_id=${scenario}&entity_id=${entity}`);
      setRapSheet(res?.rap_sheet || null);
    } catch (e: any) {
      setRapSheetError(e?.message || 'Failed to load rap sheet');
    } finally {
      setRapSheetBusy(false);
    }
  }, []);

  const loadConversationEvents = React.useCallback(async (opts?: { silent?: boolean }) => {
    if (!scenarioId) {
      setConversationEvents([]);
      return;
    }
    setConversationEventsBusy(true);
    setConversationEventsError('');
    try {
      const res = await ApiClient.get(`/api/mystery/conversation_log.php?scenario_id=${scenarioId}&limit=200`);
      setConversationEvents(Array.isArray(res?.events) ? res.events : []);
    } catch (e: any) {
      setConversationEventsError(e?.message || 'Failed to load investigation log');
    } finally {
      setConversationEventsBusy(false);
    }
  }, [scenarioId]);

  return React.useMemo(() => ({
    rapSheet, setRapSheet,
    rapSheetBusy, setRapSheetBusy,
    rapSheetError, setRapSheetError,
    conversationEvents, setConversationEvents,
    conversationEventsBusy, setConversationEventsBusy,
    conversationEventsError, setConversationEventsError,
    loadRapSheet,
    loadConversationEvents
  }), [
    rapSheet, rapSheetBusy, rapSheetError,
    conversationEvents, conversationEventsBusy, conversationEventsError,
    loadRapSheet, loadConversationEvents
  ]);
}
