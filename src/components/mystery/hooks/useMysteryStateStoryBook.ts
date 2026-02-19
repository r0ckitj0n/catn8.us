import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IStoryBookEntry } from '../../../types/game';
import { IMysteryStateStoryBook } from '../../../types/mysteryHooks';

export function useMysteryStateStoryBook(
  setBusy: (busy: boolean) => void,
  setError: (err: string) => void,
  showMysteryToast: (t: any) => void
): IMysteryStateStoryBook {
  const [seedStories, setSeedStories] = useState<IStoryBookEntry[]>([]);
  const [storyBookBusy, setStoryBookBusy] = React.useState(false);
  const [storyBookError, setStoryBookError] = React.useState('');
  const [storyBookIncludeArchived, setStoryBookIncludeArchived] = React.useState(false);
  const [storyBookSelectedId, setStoryBookSelectedId] = React.useState('');
  const [storyBookTitleDraft, setStoryBookTitleDraft] = React.useState('');
  const [storyBookSlugDraft, setStoryBookSlugDraft] = React.useState('');
  const [storyBookSourceDraft, setStoryBookSourceDraft] = React.useState('');
  const [storyBookMetaDraft, setStoryBookMetaDraft] = React.useState('{}');
  const [storyBookSelectedIsArchived, setStoryBookSelectedIsArchived] = React.useState(false);

  const [backstoryId, setBackstoryId] = React.useState('');
  const [backStoryCreateSource, setBackStoryCreateSource] = React.useState('');
  const [backStoryCreateTitle, setBackStoryCreateTitle] = React.useState('');
  const [backStoryCreateSlug, setBackStoryCreateSlug] = React.useState('');
  const [backStoryCreateLocationMasterId, setBackStoryCreateLocationMasterId] = React.useState('');
  const [backStoryCreateFromSeed, setBackStoryCreateFromSeed] = React.useState(false);
  const [backStoryCreateMeta, setBackStoryCreateMeta] = React.useState('{}');
  const [storyLongDraft, setStoryLongDraft] = React.useState('');

  const loadStoryBookEntries = React.useCallback(async () => {
    setStoryBookBusy(true);
    setStoryBookError('');
    try {
      const res = await ApiClient.get<{ entries: IStoryBookEntry[] }>(
        `/api/mystery/play.php?action=list_story_book_entries&include_archived=${storyBookIncludeArchived ? 1 : 0}`
      );
      setSeedStories(Array.isArray(res?.entries) ? res.entries : []);
    } catch (e: any) {
      setStoryBookError(e?.message || 'Failed to load Story Book');
    } finally {
      setStoryBookBusy(false);
    }
  }, [storyBookIncludeArchived]);

  const loadStoryBookEntry = React.useCallback(async (id: string | number) => {
    if (!id) return;
    setStoryBookBusy(true);
    setStoryBookError('');
    try {
      const res = await ApiClient.get<{ entry: IStoryBookEntry }>(`/api/mystery/play.php?action=get_story_book_entry&id=${id}`);
      if (res?.entry) {
        setStoryBookSelectedId(String(res.entry.id));
        setStoryBookTitleDraft(res.entry.title || '');
        setStoryBookSlugDraft(res.entry.slug || '');
        setStoryBookSourceDraft(res.entry.source_text || '');
        setStoryBookMetaDraft(JSON.stringify(res.entry.meta || {}, null, 2));
        setStoryBookSelectedIsArchived(Boolean(res.entry.is_archived));
        
        // Also sync to backstory creation fields
        // FIX: backStoryCreateSource should keep the ID for the dropdown, not the source text
        setBackStoryCreateSource(String(res.entry.id));
        setBackStoryCreateTitle(res.entry.title || '');
        setBackStoryCreateSlug(res.entry.slug || '');
        setBackStoryCreateFromSeed(true);
        setBackStoryCreateMeta(JSON.stringify(res.entry.meta || {}, null, 2));
      }
    } catch (e: any) {
      setStoryBookError(e?.message || 'Failed to load Story Book entry');
    } finally {
      setStoryBookBusy(false);
    }
  }, []);

  const saveStoryBookEntry = React.useCallback(async () => {
    const title = storyBookTitleDraft.trim();
    if (!title) {
      setStoryBookError('Title is required.');
      return;
    }
    let meta = {};
    try {
      meta = JSON.parse(storyBookMetaDraft || '{}');
    } catch (_err) {
      setStoryBookError('Meta must be valid JSON.');
      return;
    }
    setStoryBookBusy(true);
    setStoryBookError('');
    try {
      const res = await ApiClient.post<{ id?: string | number }>('/api/mystery/admin.php?action=upsert_story_book_entry', {
        id: Number(storyBookSelectedId) || 0,
        title,
        slug: storyBookSlugDraft.trim(),
        source_text: storyBookSourceDraft,
        meta,
        is_archived: storyBookSelectedIsArchived ? 1 : 0
      });
      if (res?.id) {
        await loadStoryBookEntries();
        showMysteryToast({ tone: 'success', message: 'Story Book entry saved.' });
      }
    } catch (e: any) {
      setStoryBookError(e?.message || 'Failed to save Story Book entry');
    } finally {
      setStoryBookBusy(false);
    }
  }, [storyBookTitleDraft, storyBookMetaDraft, storyBookSelectedId, storyBookSlugDraft, storyBookSourceDraft, storyBookSelectedIsArchived, loadStoryBookEntries, showMysteryToast]);

  const archiveStoryBookEntry = React.useCallback(async (id: string | number, archived: boolean) => {
    if (!id) return;
    setStoryBookBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=archive_story_book_entry', { id, is_archived: archived ? 1 : 0 });
      await loadStoryBookEntries();
      showMysteryToast({ tone: 'success', message: archived ? 'Entry archived.' : 'Entry unarchived.' });
    } catch (e: any) {
      setStoryBookError(e?.message || 'Failed to archive entry');
    } finally {
      setStoryBookBusy(false);
    }
  }, [loadStoryBookEntries, showMysteryToast]);

  const deleteStoryBookEntry = React.useCallback(async (id: string | number) => {
    if (!id) return;
    setStoryBookBusy(true);
    try {
      await ApiClient.post('/api/mystery/admin.php?action=delete_story_book_entry', { id });
      await loadStoryBookEntries();
      setStoryBookSelectedId('');
      showMysteryToast({ tone: 'success', message: 'Entry deleted.' });
    } catch (e: any) {
      setStoryBookError(e?.message || 'Failed to delete entry');
    } finally {
      setStoryBookBusy(false);
    }
  }, [loadStoryBookEntries, showMysteryToast]);

  React.useEffect(() => {
    void loadStoryBookEntries();
  }, [loadStoryBookEntries]);

  return React.useMemo(() => ({
    seedStories, setSeedStories,
    storyBookBusy, setStoryBookBusy,
    storyBookError, setStoryBookError,
    storyBookIncludeArchived, setStoryBookIncludeArchived,
    storyBookSelectedId, setStoryBookSelectedId,
    storyBookTitleDraft, setStoryBookTitleDraft,
    storyBookSlugDraft, setStoryBookSlugDraft,
    storyBookSourceDraft, setStoryBookSourceDraft,
    storyBookMetaDraft, setStoryBookMetaDraft,
    storyBookSelectedIsArchived, setStoryBookSelectedIsArchived,
    backstoryId, setBackstoryId,
    backStoryCreateSource, setBackStoryCreateSource,
    backStoryCreateTitle, setBackStoryCreateTitle,
    backStoryCreateSlug, setBackStoryCreateSlug,
    backStoryCreateLocationMasterId, setBackStoryCreateLocationMasterId,
    backStoryCreateFromSeed, setBackStoryCreateFromSeed,
    backStoryCreateMeta, setBackStoryCreateMeta,
    storyLongDraft, setStoryLongDraft,
    loadStoryBookEntries,
    loadStoryBookEntry,
    saveStoryBookEntry,
    archiveStoryBookEntry,
    deleteStoryBookEntry
  }), [
    seedStories, storyBookBusy, storyBookError, storyBookIncludeArchived,
    storyBookSelectedId, storyBookTitleDraft, storyBookSlugDraft,
    storyBookSourceDraft, storyBookMetaDraft, storyBookSelectedIsArchived,
    backstoryId, backStoryCreateSource, backStoryCreateTitle,
    backStoryCreateSlug, backStoryCreateLocationMasterId,
    backStoryCreateMeta, storyLongDraft,
    loadStoryBookEntries, loadStoryBookEntry, saveStoryBookEntry,
    archiveStoryBookEntry, deleteStoryBookEntry
  ]);
}
