import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import { IToast } from '../../types/common';
import {
  Valid8CategoriesListResponse,
  Valid8CategoryMutationResponse,
  Valid8LookupItem,
  Valid8OwnerMutationResponse,
  Valid8OwnersListResponse,
} from '../../types/valid8';

type LookupMutation = {
  createOwner: (name: string) => Promise<void>;
  updateOwner: (ownerId: string, name: string) => Promise<void>;
  archiveOwner: (ownerId: string) => Promise<void>;
  setOwnerArchived: (ownerId: string, isArchived: number) => Promise<void>;
  deleteOwner: (ownerId: string) => Promise<void>;
  createCategory: (name: string) => Promise<void>;
  updateCategory: (categoryId: string, name: string) => Promise<void>;
  archiveCategory: (categoryId: string) => Promise<void>;
  setCategoryArchived: (categoryId: string, isArchived: number) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
};

export function useValid8Lookups(
  includeInactive: boolean,
  reloadEntries: () => Promise<void>,
  onToast?: (toast: IToast) => void,
): {
  owners: Valid8LookupItem[];
  categories: Valid8LookupItem[];
  setOwners: React.Dispatch<React.SetStateAction<Valid8LookupItem[]>>;
  setCategories: React.Dispatch<React.SetStateAction<Valid8LookupItem[]>>;
  loadOwners: () => Promise<void>;
  loadCategories: () => Promise<void>;
  refreshLookups: () => Promise<void>;
} & LookupMutation {
  const [owners, setOwners] = React.useState<Valid8LookupItem[]>([]);
  const [categories, setCategories] = React.useState<Valid8LookupItem[]>([]);

  const loadOwners = React.useCallback(async () => {
    const res = await ApiClient.get<Valid8OwnersListResponse>('/api/valid8.php?action=list_owners&include_archived=1');
    setOwners(Array.isArray(res?.owners) ? res.owners : []);
  }, []);

  const loadCategories = React.useCallback(async () => {
    const res = await ApiClient.get<Valid8CategoriesListResponse>('/api/valid8.php?action=list_categories&include_archived=1');
    setCategories(Array.isArray(res?.categories) ? res.categories : []);
  }, []);

  const refreshLookups = React.useCallback(async () => {
    try {
      await Promise.all([loadOwners(), loadCategories()]);
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Failed to refresh owners/categories') });
    }
  }, [loadCategories, loadOwners, onToast]);

  const reloadVisibleData = React.useCallback(async () => {
    await reloadEntries();
  }, [reloadEntries]);

  const createOwner = React.useCallback(async (name: string) => {
    await ApiClient.post<Valid8OwnerMutationResponse>('/api/valid8.php?action=create_owner', { name });
    await loadOwners();
  }, [loadOwners]);

  const updateOwner = React.useCallback(async (ownerId: string, name: string) => {
    await ApiClient.post<Valid8OwnerMutationResponse>('/api/valid8.php?action=update_owner', { owner_id: ownerId, name });
    await reloadVisibleData();
  }, [reloadVisibleData]);

  const archiveOwner = React.useCallback(async (ownerId: string) => {
    await ApiClient.post<Valid8OwnerMutationResponse>('/api/valid8.php?action=archive_owner', { owner_id: ownerId });
    await reloadVisibleData();
  }, [reloadVisibleData]);

  const setOwnerArchived = React.useCallback(async (ownerId: string, isArchived: number) => {
    await ApiClient.post<Valid8OwnerMutationResponse>('/api/valid8.php?action=set_owner_archived', { owner_id: ownerId, is_archived: isArchived ? 1 : 0 });
    await reloadVisibleData();
  }, [reloadVisibleData]);

  const deleteOwner = React.useCallback(async (ownerId: string) => {
    await ApiClient.post<Valid8OwnerMutationResponse>('/api/valid8.php?action=delete_owner', { owner_id: ownerId });
    await reloadVisibleData();
  }, [reloadVisibleData]);

  const createCategory = React.useCallback(async (name: string) => {
    await ApiClient.post<Valid8CategoryMutationResponse>('/api/valid8.php?action=create_category', { name });
    await loadCategories();
  }, [loadCategories]);

  const updateCategory = React.useCallback(async (categoryId: string, name: string) => {
    await ApiClient.post<Valid8CategoryMutationResponse>('/api/valid8.php?action=update_category', { category_id: categoryId, name });
    await reloadVisibleData();
  }, [reloadVisibleData]);

  const archiveCategory = React.useCallback(async (categoryId: string) => {
    await ApiClient.post<Valid8CategoryMutationResponse>('/api/valid8.php?action=archive_category', { category_id: categoryId });
    await reloadVisibleData();
  }, [reloadVisibleData]);

  const setCategoryArchived = React.useCallback(async (categoryId: string, isArchived: number) => {
    await ApiClient.post<Valid8CategoryMutationResponse>('/api/valid8.php?action=set_category_archived', { category_id: categoryId, is_archived: isArchived ? 1 : 0 });
    await reloadVisibleData();
  }, [reloadVisibleData]);

  const deleteCategory = React.useCallback(async (categoryId: string) => {
    await ApiClient.post<Valid8CategoryMutationResponse>('/api/valid8.php?action=delete_category', { category_id: categoryId });
    await reloadVisibleData();
  }, [reloadVisibleData]);

  return {
    owners,
    categories,
    setOwners,
    setCategories,
    loadOwners,
    loadCategories,
    refreshLookups,
    createOwner,
    updateOwner,
    archiveOwner,
    setOwnerArchived,
    deleteOwner,
    createCategory,
    updateCategory,
    archiveCategory,
    setCategoryArchived,
    deleteCategory,
  };
}
