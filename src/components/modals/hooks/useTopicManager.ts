import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { normalizeWord } from '../../../utils/wordsearchUtils';
import { IToast } from '../../../types/common';
import { BrandedConfirmFn } from '../../../hooks/useBrandedConfirm';

export function useTopicManager(open: boolean, onChanged: () => void, confirm: BrandedConfirmFn, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [topics, setTopics] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [form, setForm] = React.useState({ slug: '', title: '', description: '', words_per_page: 15, is_active: 1, wordsText: '' });
  const [mode, setMode] = useState<'create' | 'edit'>('create');

  const loadList = React.useCallback(async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await ApiClient.get('/api/wordsearch/topics.php?action=list');
      setTopics(Array.isArray(res?.topics) ? res.topics : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load topics');
    } finally {
      setBusy(false);
    }
  }, []);

  const loadTopic = React.useCallback(async (id: number) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await ApiClient.get('/api/wordsearch/topics.php?action=get&id=' + String(id));
      const t = res?.topic;
      if (!t) throw new Error('Topic not found');
      setActiveId(Number(t.id));
      setMode('edit');
      setForm({
        slug: String(t.slug || ''),
        title: String(t.title || ''),
        description: String(t.description || ''),
        words_per_page: Number.isFinite(Number(t.words_per_page)) ? Number(t.words_per_page) : 15,
        is_active: Number(t.is_active || 0) ? 1 : 0,
        wordsText: Array.isArray(t.words) ? t.words.join('\n') : '',
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to load topic');
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setMode('create');
    setActiveId(null);
    setForm({ slug: '', title: '', description: '', words_per_page: 15, is_active: 1, wordsText: '' });
    loadList();
  }, [open, loadList]);

  React.useEffect(() => {
    if (error && onToast) {
      onToast({ tone: 'error', message: error });
      setError('');
    }
  }, [error, onToast]);

  React.useEffect(() => {
    if (message && onToast) {
      onToast({ tone: 'success', message: message });
      setMessage('');
    }
  }, [message, onToast]);

  const wordsFromText = (text: string) => {
    const raw = String(text || '').split(/\r?\n/g);
    return raw.map((w) => normalizeWord(w)).filter((w) => w.length >= 3);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        slug: form.slug,
        title: form.title,
        description: form.description,
        words_per_page: Number.isFinite(Number(form.words_per_page)) ? Number(form.words_per_page) : 15,
        is_active: form.is_active,
        words: wordsFromText(form.wordsText),
      };

      if (mode === 'edit') {
        await ApiClient.post('/api/wordsearch/topics.php?action=update', { ...payload, id: activeId });
        setMessage('Saved.');
      } else {
        await ApiClient.post('/api/wordsearch/topics.php?action=create', payload);
        setMessage('Created.');
        setForm({ slug: '', title: '', description: '', words_per_page: 15, is_active: 1, wordsText: '' });
      }

      await loadList();
      if (onChanged) onChanged();
    } catch (err: any) {
      setError(err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!activeId) return;
    const confirmed = await confirm({
      title: 'Delete Topic?',
      message: 'Are you sure you want to delete this topic?',
      confirmLabel: 'Delete Topic',
      tone: 'danger',
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/wordsearch/topics.php?action=delete', { id: activeId });
      setMessage('Deleted.');
      setMode('create');
      setActiveId(null);
      setForm({ slug: '', title: '', description: '', words_per_page: 15, is_active: 1, wordsText: '' });
      await loadList();
      if (onChanged) onChanged();
    } catch (err: any) {
      setError(err?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return {
    busy, topics, activeId, form, setForm, mode, setMode, setActiveId,
    loadList, loadTopic, save, remove
  };
}
