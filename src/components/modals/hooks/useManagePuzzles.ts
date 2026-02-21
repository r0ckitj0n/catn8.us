import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IToast } from '../../../types/common';
import { BrandedConfirmFn } from '../../../hooks/useBrandedConfirm';

export function useManagePuzzles(open: boolean, onToast?: (toast: IToast) => void, confirm?: BrandedConfirmFn) {
  const [busy, setBusy] = React.useState(false);
  const [puzzles, setPuzzles] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [form, setForm] = React.useState({
    slug: '',
    title: '',
    description: '',
    grid_size: 15,
    is_active: 1,
    wordsText: ''
  });

  const loadList = React.useCallback(async () => {
    setBusy(true);
    try {
      const res = await ApiClient.get('/api/wordsearch/puzzles.php?action=list');
      setPuzzles(Array.isArray(res?.puzzles) ? res.puzzles : []);
    } catch (e: any) {
      onToast?.({ tone: 'error', message: e?.message || 'Failed to load puzzles' });
    } finally {
      setBusy(false);
    }
  }, [onToast]);

  const loadPuzzle = React.useCallback(async (id: number) => {
    setBusy(true);
    try {
      const res = await ApiClient.get(`/api/wordsearch/puzzles.php?action=get&id=${id}`);
      const p = res?.puzzle;
      if (!p) throw new Error('Puzzle not found');
      setActiveId(Number(p.id));
      setMode('edit');
      setForm({
        slug: String(p.slug || ''),
        title: String(p.title || ''),
        description: String(p.description || ''),
        grid_size: Number(p.grid_size) || 15,
        is_active: Number(p.is_active) ? 1 : 0,
        wordsText: Array.isArray(p.words) ? p.words.join('\n') : ''
      });
    } catch (e: any) {
      onToast?.({ tone: 'error', message: e?.message || 'Failed to load puzzle' });
    } finally {
      setBusy(false);
    }
  }, [onToast]);

  React.useEffect(() => {
    if (open) {
      setMode('create');
      setActiveId(null);
      setForm({ slug: '', title: '', description: '', grid_size: 15, is_active: 1, wordsText: '' });
      loadList();
    }
  }, [open, loadList]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        words: form.wordsText.split('\n').map(w => w.trim()).filter(w => w.length > 0)
      };
      if (mode === 'edit') {
        await ApiClient.post('/api/wordsearch/puzzles.php?action=update', { ...payload, id: activeId });
        onToast?.({ tone: 'success', message: 'Saved.' });
      } else {
        await ApiClient.post('/api/wordsearch/puzzles.php?action=create', payload);
        onToast?.({ tone: 'success', message: 'Created.' });
        setForm({ slug: '', title: '', description: '', grid_size: 15, is_active: 1, wordsText: '' });
      }
      await loadList();
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Save failed' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!activeId) return;
    const confirmed = confirm
      ? await confirm({
        title: 'Delete Puzzle?',
        message: 'Delete this puzzle?',
        confirmLabel: 'Delete Puzzle',
        tone: 'danger',
      })
      : true;
    if (!confirmed) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/wordsearch/puzzles.php?action=delete', { id: activeId });
      onToast?.({ tone: 'success', message: 'Deleted.' });
      setMode('create');
      setActiveId(null);
      setForm({ slug: '', title: '', description: '', grid_size: 15, is_active: 1, wordsText: '' });
      await loadList();
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Delete failed' });
    } finally {
      setBusy(false);
    }
  };

  return {
    busy, puzzles, activeId, mode, setMode, setActiveId, form, setForm,
    loadList, loadPuzzle, save, remove
  };
}
