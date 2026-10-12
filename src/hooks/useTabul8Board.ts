import React from 'react';

import { ApiClient } from '../core/ApiClient';
import { Tabul8Board, Tabul8Category, Tabul8Entry } from '../types/tabul8';

type ToastFn = ((t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void) | undefined;

export function useTabul8Board(partyId: number, onToast?: ToastFn) {
  const [busy, setBusy] = React.useState(false);
  const [board, setBoard] = React.useState<Tabul8Board | null>(null);
  const [categories, setCategories] = React.useState<Tabul8Category[]>([]);
  const [entries, setEntries] = React.useState<Tabul8Entry[]>([]);
  const [partyTitle, setPartyTitle] = React.useState('');

  const refresh = React.useCallback(async () => {
    if (partyId <= 0) return;
    setBusy(true);
    try {
      const ensured = await ApiClient.get<{
        success: boolean;
        board: Tabul8Board;
        categories: Tabul8Category[];
        party?: { title?: string };
      }>(`/api/tabul8.php?action=ensure_board&party_id=${partyId}`);
      setBoard(ensured.board);
      setCategories(ensured.categories || []);
      setPartyTitle(ensured.party?.title || '');
      const tallies = await ApiClient.get<{
        success: boolean;
        entries: Tabul8Entry[];
        categories: Tabul8Category[];
        board: Tabul8Board;
      }>(`/api/tabul8.php?action=get_tallies&board_id=${ensured.board.id}`);
      setBoard(tallies.board);
      setCategories(tallies.categories || []);
      setEntries(tallies.entries || []);
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Failed to load Tabul8' });
    } finally {
      setBusy(false);
    }
  }, [partyId, onToast]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const post = React.useCallback(async (action: string, body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await ApiClient.post(`/api/tabul8.php?action=${action}`, body);
      await refresh();
      return res;
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Action failed' });
      throw error;
    } finally {
      setBusy(false);
    }
  }, [refresh, onToast]);

  return {
    busy, board, categories, entries, partyTitle, refresh, post, setCategories, setEntries, setBoard,
  };
}
