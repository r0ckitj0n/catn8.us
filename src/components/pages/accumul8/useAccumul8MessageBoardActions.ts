import React from 'react';

import { ApiClient } from '../../../core/ApiClient';
import {
  Accumul8AIcountantHousekeepingResponse,
  Accumul8AIcountantWatchlistResponse,
  Accumul8BalanceBooksResponse,
  Accumul8MessageBoardMessage,
  Accumul8MessageBoardResponse,
} from '../../../types/accumul8';

interface UseAccumul8MessageBoardActionsOptions {
  activeOwnerUserId: number;
  balancingBooks: boolean;
  load: () => Promise<unknown>;
  onToast?: (toast: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
  runningAIcountantHousekeeping: boolean;
  runningAIcountantWatchlist: boolean;
  scopedActionUrl: (action: string) => string;
  selectedOwnerUserId: number;
  setBalancingBooks: React.Dispatch<React.SetStateAction<boolean>>;
  setMessageBoardLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setMessageBoardMessages: React.Dispatch<React.SetStateAction<Accumul8MessageBoardMessage[]>>;
  setMessageBoardUnacknowledgedCount: React.Dispatch<React.SetStateAction<number>>;
  setRunningAIcountantHousekeeping: React.Dispatch<React.SetStateAction<boolean>>;
  setRunningAIcountantWatchlist: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAccumul8MessageBoardActions({
  activeOwnerUserId,
  balancingBooks,
  load,
  onToast,
  runningAIcountantHousekeeping,
  runningAIcountantWatchlist,
  scopedActionUrl,
  selectedOwnerUserId,
  setBalancingBooks,
  setMessageBoardLoading,
  setMessageBoardMessages,
  setMessageBoardUnacknowledgedCount,
  setRunningAIcountantHousekeeping,
  setRunningAIcountantWatchlist,
}: UseAccumul8MessageBoardActionsOptions) {
  const applyMessageBoardResponse = React.useCallback((response: Accumul8MessageBoardResponse | null | undefined) => {
    setMessageBoardMessages(Array.isArray(response?.messages) ? response.messages : []);
    setMessageBoardUnacknowledgedCount(Number(response?.unacknowledged_count || 0));
  }, [setMessageBoardMessages, setMessageBoardUnacknowledgedCount]);

  const loadMessageBoard = React.useCallback(async () => {
    const ownerUserId = Number(selectedOwnerUserId || activeOwnerUserId || 0);
    if (ownerUserId <= 0) {
      setMessageBoardMessages([]);
      setMessageBoardUnacknowledgedCount(0);
      return;
    }
    setMessageBoardLoading(true);
    try {
      applyMessageBoardResponse(await ApiClient.get<Accumul8MessageBoardResponse>(scopedActionUrl('list_message_board_messages')));
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Failed to load the message board') });
    } finally {
      setMessageBoardLoading(false);
    }
  }, [
    activeOwnerUserId,
    applyMessageBoardResponse,
    onToast,
    scopedActionUrl,
    selectedOwnerUserId,
    setMessageBoardLoading,
    setMessageBoardMessages,
    setMessageBoardUnacknowledgedCount,
  ]);

  const acknowledgeMessageBoardMessage = React.useCallback(async (messageId: number) => {
    if (messageId <= 0) {
      return;
    }
    setMessageBoardLoading(true);
    try {
      applyMessageBoardResponse(await ApiClient.post<Accumul8MessageBoardResponse>(
        scopedActionUrl('acknowledge_message_board_messages'),
        { ids: [messageId] },
      ));
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Failed to acknowledge message') });
    } finally {
      setMessageBoardLoading(false);
    }
  }, [applyMessageBoardResponse, onToast, scopedActionUrl, setMessageBoardLoading]);

  const acknowledgeAllMessageBoardMessages = React.useCallback(async () => {
    setMessageBoardLoading(true);
    try {
      applyMessageBoardResponse(await ApiClient.post<Accumul8MessageBoardResponse>(
        scopedActionUrl('acknowledge_message_board_messages'),
        { all: 1 },
      ));
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Failed to acknowledge all messages') });
    } finally {
      setMessageBoardLoading(false);
    }
  }, [applyMessageBoardResponse, onToast, scopedActionUrl, setMessageBoardLoading]);

  const handleRunAIcountantHousekeeping = React.useCallback(async () => {
    if (runningAIcountantHousekeeping || balancingBooks || runningAIcountantWatchlist) {
      return;
    }
    setRunningAIcountantHousekeeping(true);
    try {
      const response = await ApiClient.post<Accumul8AIcountantHousekeepingResponse>(
        scopedActionUrl('run_aicountant_housekeeping'),
        {
          send_email: 0,
          create_notification_rule: 1,
          email_on_attention_only: 1,
          run_entity_maintenance: 0,
        },
      );
      applyMessageBoardResponse(response);
      await load();
      const ledgerSyncResult = response?.ledger_sync;
      const balanceResult = response?.balance_books;
      const openingBalanceResult = response?.opening_balance_reconciliation;
      const watchlistResult = response?.watchlist;
      const createdLedgerRows = Number(ledgerSyncResult?.created || 0);
      const reconciledCount = Number(openingBalanceResult?.reconciled_count || 0);
      const overdueCount = Number(watchlistResult?.overdue_count || 0);
      const dueSoonCount = Number(watchlistResult?.due_soon_count || 0);
      const recurringSoonCount = Number(watchlistResult?.recurring_soon_count || 0);
      const syncedCount = Number(balanceResult?.synced_connection_count || 0);
      const riskCount = overdueCount + dueSoonCount + recurringSoonCount;
      const tone = Number(balanceResult?.error_connection_count || 0) > 0 || Number(response?.attention_needed || 0) === 1
        ? 'warning'
        : 'success';
      onToast?.({
        tone,
        message: `AIcountant housekeeping finished: Synced ${syncedCount} bank connection${syncedCount === 1 ? '' : 's'}, created ${createdLedgerRows} recurring ledger item${createdLedgerRows === 1 ? '' : 's'} through ${String(ledgerSyncResult?.window_end || '').trim() || 'the 90-day window'}, ${reconciledCount > 0 ? `adjusted ${reconciledCount} opening balance${reconciledCount === 1 ? '' : 's'}` : 'did not need opening-balance adjustments'}, flagged ${riskCount} upcoming risk${riskCount === 1 ? '' : 's'}. Check Alerts for the full run log.`,
      });
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'AIcountant housekeeping failed') });
    } finally {
      setRunningAIcountantHousekeeping(false);
    }
  }, [
    applyMessageBoardResponse,
    balancingBooks,
    load,
    onToast,
    runningAIcountantHousekeeping,
    runningAIcountantWatchlist,
    scopedActionUrl,
    setRunningAIcountantHousekeeping,
  ]);

  const handleBalanceBooks = React.useCallback(async () => {
    if (balancingBooks || runningAIcountantHousekeeping) {
      return;
    }
    setBalancingBooks(true);
    try {
      const response = await ApiClient.post<Accumul8BalanceBooksResponse>(scopedActionUrl('balance_books'), {});
      applyMessageBoardResponse(response);
      await load();
      if (Number(response?.synced_connection_count || 0) <= 0) {
        onToast?.({ tone: 'warning', message: 'No Teller bank connections were available to sync.' });
        return;
      }
      const openingBalanceResult = response?.opening_balance_reconciliation;
      onToast?.({
        tone: Number(response?.error_connection_count || 0) > 0 || Number(openingBalanceResult?.review_needed_count || 0) > 0 ? 'warning' : 'success',
        message: Number(openingBalanceResult?.reconciled_count || 0) > 0
          ? `Balance the Books finished and adjusted ${Number(openingBalanceResult?.reconciled_count || 0)} opening balance${Number(openingBalanceResult?.reconciled_count || 0) === 1 ? '' : 's'}. Check the message board for dates and ledger links.`
          : 'Balance the Books finished. Check the message board for the full run log.',
      });
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Balance the Books failed') });
    } finally {
      setBalancingBooks(false);
    }
  }, [applyMessageBoardResponse, balancingBooks, load, onToast, runningAIcountantHousekeeping, scopedActionUrl, setBalancingBooks]);

  const handleRunAIcountantWatchlist = React.useCallback(async () => {
    if (runningAIcountantWatchlist || runningAIcountantHousekeeping) {
      return;
    }
    setRunningAIcountantWatchlist(true);
    try {
      const response = await ApiClient.post<Accumul8AIcountantWatchlistResponse>(
        scopedActionUrl('run_aicountant_watchlist'),
        { send_email: 0, create_notification_rule: 1 },
      );
      applyMessageBoardResponse(response);
      onToast?.({
        tone: Number(response?.overdue_count || 0) > 0 ? 'warning' : 'success',
        message: 'AIcountant watchlist posted to the message board.',
      });
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'AIcountant watchlist failed') });
    } finally {
      setRunningAIcountantWatchlist(false);
    }
  }, [applyMessageBoardResponse, onToast, runningAIcountantHousekeeping, runningAIcountantWatchlist, scopedActionUrl, setRunningAIcountantWatchlist]);

  return {
    acknowledgeAllMessageBoardMessages,
    acknowledgeMessageBoardMessage,
    handleBalanceBooks,
    handleRunAIcountantHousekeeping,
    handleRunAIcountantWatchlist,
    loadMessageBoard,
  };
}
