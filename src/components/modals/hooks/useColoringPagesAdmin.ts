import React from 'react';

import { ApiClient } from '../../../core/ApiClient';
import {
  ColoringAdminCategory,
  ColoringAdminDifficulty,
  ColoringAdminListResponse,
  ColoringAdminPage,
  ColoringAdminTheme,
  ColoringPageGenerateRequest,
} from '../../../types/coloringAdmin';
import { IToast } from '../../../types/common';

type TabKey = 'categories' | 'themes' | 'difficulties' | 'pages' | 'generate';

const EMPTY_LISTS: ColoringAdminListResponse = {
  categories: [],
  themes: [],
  difficulties: [],
  pages: [],
};

export function useColoringPagesAdmin(open: boolean, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabKey>('categories');
  const [data, setData] = React.useState<ColoringAdminListResponse>(EMPTY_LISTS);

  const [categoryForm, setCategoryForm] = React.useState({ id: 0, slug: '', name: '', description: '', sort_order: 10, is_active: 1 });
  const [themeForm, setThemeForm] = React.useState({ id: 0, category_id: 0, slug: '', name: '', description: '', sort_order: 10, is_active: 1 });
  const [difficultyForm, setDifficultyForm] = React.useState({ id: 0, slug: '', name: '', description: '', complexity_level: 2, sort_order: 10, is_active: 1 });
  const [pageForm, setPageForm] = React.useState({ id: 0, title: '', description: '', category_id: 0, theme_id: 0, difficulty_id: 0, image_url: '', is_active: 1 });
  const [generateForm, setGenerateForm] = React.useState<ColoringPageGenerateRequest>({
    title: '',
    description: '',
    category_id: 0,
    theme_id: 0,
    difficulty_id: 0,
  });

  const toast = React.useCallback((tone: IToast['tone'], message: string) => {
    if (typeof onToast === 'function') onToast({ tone, message });
  }, [onToast]);

  const loadAll = React.useCallback(async () => {
    setBusy(true);
    try {
      const res = await ApiClient.get<{ success: boolean } & ColoringAdminListResponse>('/api/coloring/admin.php?action=list_all');
      setData({
        categories: Array.isArray(res?.categories) ? res.categories : [],
        themes: Array.isArray(res?.themes) ? res.themes : [],
        difficulties: Array.isArray(res?.difficulties) ? res.difficulties : [],
        pages: Array.isArray(res?.pages) ? res.pages : [],
      });
    } catch (error: any) {
      toast('error', error?.message || 'Failed to load coloring settings');
    } finally {
      setBusy(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (!open) return;
    setActiveTab('categories');
    void loadAll();
  }, [open, loadAll]);

  React.useEffect(() => {
    if (data.categories.length && themeForm.category_id <= 0) {
      setThemeForm((prev) => ({ ...prev, category_id: data.categories[0].id }));
    }
    if (data.categories.length && pageForm.category_id <= 0) {
      setPageForm((prev) => ({ ...prev, category_id: data.categories[0].id }));
    }
    if (data.categories.length && generateForm.category_id <= 0) {
      setGenerateForm((prev) => ({ ...prev, category_id: data.categories[0].id }));
    }
  }, [data.categories, themeForm.category_id, pageForm.category_id, generateForm.category_id]);

  React.useEffect(() => {
    if (data.themes.length && pageForm.theme_id <= 0) {
      setPageForm((prev) => ({ ...prev, theme_id: data.themes[0].id }));
    }
    if (data.themes.length && generateForm.theme_id <= 0) {
      setGenerateForm((prev) => ({ ...prev, theme_id: data.themes[0].id }));
    }
  }, [data.themes, pageForm.theme_id, generateForm.theme_id]);

  React.useEffect(() => {
    if (data.difficulties.length && pageForm.difficulty_id <= 0) {
      setPageForm((prev) => ({ ...prev, difficulty_id: data.difficulties[0].id }));
    }
    if (data.difficulties.length && generateForm.difficulty_id <= 0) {
      setGenerateForm((prev) => ({ ...prev, difficulty_id: data.difficulties[0].id }));
    }
  }, [data.difficulties, pageForm.difficulty_id, generateForm.difficulty_id]);

  const postAndReload = React.useCallback(async (action: string, payload: Record<string, any>, successMessage: string) => {
    setBusy(true);
    try {
      await ApiClient.post(`/api/coloring/admin.php?action=${encodeURIComponent(action)}`, payload);
      toast('success', successMessage);
      await loadAll();
      return true;
    } catch (error: any) {
      toast('error', error?.message || 'Save failed');
      return false;
    } finally {
      setBusy(false);
    }
  }, [loadAll, toast]);

  const editCategory = (item: ColoringAdminCategory) => setCategoryForm({ ...item });
  const editTheme = (item: ColoringAdminTheme) => setThemeForm({ ...item });
  const editDifficulty = (item: ColoringAdminDifficulty) => setDifficultyForm({ ...item });
  const editPage = (item: ColoringAdminPage) => setPageForm({
    id: item.id,
    title: item.title,
    description: item.description,
    category_id: item.category_id,
    theme_id: item.theme_id,
    difficulty_id: item.difficulty_id,
    image_url: item.image_url,
    is_active: item.is_active,
  });

  const resetCategory = () => setCategoryForm({ id: 0, slug: '', name: '', description: '', sort_order: 10, is_active: 1 });
  const resetTheme = () => setThemeForm({ id: 0, category_id: data.categories[0]?.id || 0, slug: '', name: '', description: '', sort_order: 10, is_active: 1 });
  const resetDifficulty = () => setDifficultyForm({ id: 0, slug: '', name: '', description: '', complexity_level: 2, sort_order: 10, is_active: 1 });
  const resetPage = () => setPageForm({ id: 0, title: '', description: '', category_id: data.categories[0]?.id || 0, theme_id: data.themes[0]?.id || 0, difficulty_id: data.difficulties[0]?.id || 0, image_url: '', is_active: 1 });

  const generatePage = async () => {
    const ok = await postAndReload('generate_page', generateForm, 'Coloring page generated');
    if (ok) {
      setGenerateForm((prev) => ({ ...prev, title: '', description: '' }));
      setActiveTab('pages');
    }
  };

  return {
    busy,
    activeTab,
    setActiveTab,
    data,
    loadAll,
    categoryForm,
    setCategoryForm,
    themeForm,
    setThemeForm,
    difficultyForm,
    setDifficultyForm,
    pageForm,
    setPageForm,
    generateForm,
    setGenerateForm,
    editCategory,
    editTheme,
    editDifficulty,
    editPage,
    resetCategory,
    resetTheme,
    resetDifficulty,
    resetPage,
    postAndReload,
    generatePage,
  };
}
