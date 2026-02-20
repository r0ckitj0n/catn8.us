import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IBackstory } from '../../../types/game';

export function useMysteryBackstoryCore(mysteryId: string, setBusy: (busy: boolean) => void, setError: (err: string) => void) {
  const [backstories, setBackstories] = useState<IBackstory[]>([]);
  const [backstoryId, setBackstoryId] = React.useState('');
  const [backstoryDetails, setBackstoryDetails] = useState<IBackstory | null>(null);

  const loadBackstories = React.useCallback(async (mid: string | number) => {
    if (!mid) {
      setBackstories([]);
      return [];
    }
    try {
      const res = await ApiClient.get<{ backstories: IBackstory[] }>(`/api/mystery/play.php?action=list_backstories&mystery_id=${String(mid)}`);
      const list = Array.isArray(res?.backstories) ? res.backstories : [];
      setBackstories(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  const loadBackstoryDetails = React.useCallback(async (id: string | number) => {
    if (!id) {
      setBackstoryDetails(null);
      return;
    }
    try {
      const res = await ApiClient.get<{ backstory: IBackstory }>(`/api/mystery/play.php?action=get_backstory&id=${String(id)}`);
      setBackstoryDetails(res?.backstory || null);
    } catch {}
  }, []);

  const loadBackstoryFullStory = React.useCallback(async (id: string | number) => {
    if (!id) return;
    try {
      const res = await ApiClient.get<{ full_story: string }>(`/api/mystery/play.php?action=get_backstory_full&id=${id}`);
      return res?.full_story || '';
    } catch {}
  }, []);

  const toggleBackstoryArchived = React.useCallback(async (id: string | number) => {
    if (!id) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=toggle_backstory_archived', { id });
      await loadBackstories(mysteryId);
    } catch (err: any) {
      setError(err?.message || 'Failed to toggle backstory archive status');
    } finally {
      setBusy(false);
    }
  }, [mysteryId, loadBackstories, setBusy, setError]);

  return {
    backstories,
    setBackstories,
    backstoryId,
    setBackstoryId,
    backstoryDetails,
    setBackstoryDetails,
    loadBackstories,
    loadBackstoryDetails,
    loadBackstoryFullStory,
    toggleBackstoryArchived,
  };
}
